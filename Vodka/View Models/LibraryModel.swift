//
//  LibraryModel.swift
//  Vodka
//
//  This file is part of Vodka, a fork of Whisky.
//
//  Vodka is free software: you can redistribute it and/or modify it under the terms
//  of the GNU General Public License as published by the Free Software Foundation,
//  either version 3 of the License, or (at your option) any later version.
//
//  Vodka is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
//  without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
//  See the GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License along with Vodka.
//  If not, see https://www.gnu.org/licenses/.
//

import AppKit
import Combine
import Foundation
import VodkaKit

/// How the library grid is ordered.
enum LibrarySort: String, CaseIterable, Identifiable {
    case recent
    case name
    case bottle

    var id: String { rawValue }

    var label: LocalizedStringResource {
        switch self {
        case .recent: "library.sort.recent"
        case .name: "library.sort.name"
        case .bottle: "library.sort.bottle"
        }
    }
}

/// A library entry plus what the grid needs to draw it. `bottleName` and
/// `lastPlayed` are presentation, which is why they live here rather than in
/// ``LibraryEntry``.
struct LibraryRow: Identifiable {
    let item: LibraryEntry
    let bottleName: String?
    let lastPlayed: Date?
    /// What a Steam game takes on disk, from its manifest.
    var sizeOnDisk: Int64?
    /// Where a Steam game is installed.
    var installURL: URL?

    var id: String { item.id }
}

/// Builds the library and owns what is currently starting or running.
///
/// A view model rather than view state because the running half comes from a
/// ``SteamClientOrchestrator`` per bottle, and those are long-lived objects with
/// their own pollers: the library previously made one per launch and threw it
/// away, so everything it published (the launch phase, the running App IDs, the
/// launch error) went nowhere.
@MainActor
final class LibraryModel: ObservableObject {
    @Published private(set) var rows: [LibraryRow] = []
    @Published var launchError: String?
    @Published var toast: ToastData?
    /// Set when a DirectX 12 game starts without Apple's D3DMetal installed.
    @Published var gptkNotice: String?

    /// App IDs with a launch in flight, per bottle.
    @Published private var steamLaunching: [URL: Set<Int>] = [:]
    /// App IDs whose own processes are in the bottle's process list.
    @Published private var steamRunning: [URL: Set<Int>] = [:]
    /// Programs whose launch call has not returned yet.
    @Published private var programLaunching: Set<URL> = []
    /// Bottles whose Steam client is running, whoever started it.
    @Published private(set) var steamClientRunning: Set<URL> = []

    var sort: LibrarySort = .recent {
        didSet {
            guard sort != oldValue else { return }
            rows = sorted(rows)
        }
    }

    private var orchestrators: [URL: SteamClientOrchestrator] = [:]
    private var cancellables: Set<AnyCancellable> = []

    // MARK: - State

    /// What a card should be showing.
    ///
    /// Running is checked before launching because a Steam launch stays in its
    /// grace period for up to two minutes while shaders precompile, which can
    /// outlast the game actually appearing.
    func state(for entry: LibraryEntry) -> LibraryEntryState {
        switch entry.launch {
        case let .program(url):
            programLaunching.contains(url) ? .launching : .idle
        case let .steam(appID):
            if steamRunning[entry.bottleURL]?.contains(appID) == true {
                .running
            } else if steamLaunching[entry.bottleURL]?.contains(appID) == true {
                .launching
            } else {
                .idle
            }
        }
    }

    // MARK: - Building

    /// Rebuilds every row in one pass.
    ///
    /// Rebuilt whole rather than per card: enumerating Steam walks
    /// `libraryfolders.vdf` and every run log lookup is a plist read, so doing
    /// it inside a card turns scrolling into disk traffic.
    func reload(bottles: [Bottle]) async {
        var built: [LibraryRow] = []
        let showBottleName = bottles.count > 1
        let routed = GameRouting().lastLaunches()

        for bottle in bottles {
            let url = bottle.url
            // Pins come straight from settings, which is a main-actor read.
            // Steam is the part that walks the filesystem, so only that goes
            // off the main actor, and it needs nothing but the bottle URL.
            let pinned = PinnedLibrarySource.items(inBottleAt: url, settings: bottle.settings)
            let (steam, installed) = await Task.detached {
                (SteamLibrarySource.entries(inBottleAt: url), SteamLibrary.enumerate(bottleURL: url))
            }.value
            let games = Dictionary(installed.map { ($0.appId, $0) }) { first, _ in first }

            for item in LibraryCatalogue.merge([pinned, steam]) {
                var game: SteamGame?
                if case let .steam(appID) = item.launch { game = games[appID] }
                built.append(
                    LibraryRow(
                        item: item,
                        bottleName: showBottleName ? bottle.settings.name : nil,
                        // Steam's own record counts too, for a game played
                        // from Steam rather than from here.
                        lastPlayed: [lastPlayed(for: item, routed: routed), game?.manifest.lastPlayed]
                            .compactMap { $0 }.max(),
                        sizeOnDisk: game?.manifest.sizeOnDisk,
                        installURL: game?.installURL
                    )
                )
            }

            trackSteam(in: bottle)
        }

        rows = sorted(built)
    }

    /// When an entry was last started in Vodka.
    private func lastPlayed(
        for item: LibraryEntry, routed: [Int: Date]
    ) -> Date? {
        switch item.launch {
        case let .program(url):
            RunLogStore.load(for: url.lastPathComponent, in: item.bottleURL)
                .entries.map(\.startTime).max()
        case let .steam(appID):
            routed[appID]
        }
    }

    /// Launchers last whatever the sort is. A storefront client is how you reach
    /// a game, not one of them, and it would otherwise take the top of the grid
    /// on recency because every game launch runs it.
    private func sorted(_ rows: [LibraryRow]) -> [LibraryRow] {
        rows.sorted { first, second in
            if first.item.isLauncher != second.item.isLauncher {
                return second.item.isLauncher
            }
            return switch sort {
            case .recent: byRecency(first, second)
            case .name: byName(first, second)
            case .bottle: byBottle(first, second)
            }
        }
    }

    private func byRecency(_ first: LibraryRow, _ second: LibraryRow) -> Bool {
        switch (first.lastPlayed, second.lastPlayed) {
        case let (lhs?, rhs?): lhs > rhs
        case (_?, nil): true
        case (nil, _?): false
        case (nil, nil): byName(first, second)
        }
    }

    private func byName(_ first: LibraryRow, _ second: LibraryRow) -> Bool {
        first.item.name.localizedStandardCompare(second.item.name) == .orderedAscending
    }

    private func byBottle(_ first: LibraryRow, _ second: LibraryRow) -> Bool {
        let lhs = first.bottleName ?? ""
        let rhs = second.bottleName ?? ""
        guard lhs == rhs else { return lhs.localizedStandardCompare(rhs) == .orderedAscending }
        return byName(first, second)
    }
}

// MARK: - Launching

extension LibraryModel {
    func launch(_ row: LibraryRow, bottles: [Bottle]) {
        guard let bottle = bottles.first(where: { $0.url == row.item.bottleURL }) else { return }

        switch row.item.launch {
        case let .program(url):
            launchProgram(at: url, in: bottle)
        case let .steam(appID):
            let games = SteamLibrary.enumerate(bottleURL: bottle.url)
            guard let game = games.first(where: { $0.appId == appID }) else {
                launchError = String(localized: "library.launch.steamGameMissing")
                return
            }
            noteMissingD3DMetal(for: game)
            orchestrator(for: bottle).launch(game)
        }
    }

    /// DirectX 12 runs through D3DMetal, from Apple's Game Porting Toolkit,
    /// which Vodka can't ship. Without it the game falls back to Wine's own
    /// renderer, which is slow at best, so say why before it disappoints.
    private func noteMissingD3DMetal(for game: SteamGame) {
        guard !GPTKImporter.isDeployed(),
              GraphicsAPIDetector.detect(executables: SteamLibrary.executableURLs(under: game.installURL)) == .d3d12
        else { return }
        gptkNotice = "\(game.name) uses DirectX 12, which needs Apple's Game Porting Toolkit. "
            + "Without it the game may not start, or run slowly. Add it under Steam Setup › Choose your graphics."
    }

    /// Stops a running Steam game. Programs have no per-entry stop: the launch
    /// path returns long before the program exits, so there is nothing tracked
    /// to stop. The bottle's own stop is what reaches those.
    func stop(_ row: LibraryRow, bottles: [Bottle]) {
        guard case let .steam(appID) = row.item.launch,
              let bottle = bottles.first(where: { $0.url == row.item.bottleURL })
        else { return }

        let games = SteamLibrary.enumerate(bottleURL: bottle.url)
        guard let game = games.first(where: { $0.appId == appID }) else { return }
        Task { await orchestrator(for: bottle).stop(game) }
    }

    /// Hands a `steam://` link or a command to a bottle's Steam client:
    /// opening the client, a store page, Steam's own uninstall for a game, or
    /// `-shutdown`.
    func sendToSteam(_ argument: String, in bottleURL: URL, bottles: [Bottle]) {
        guard let bottle = bottles.first(where: { $0.url == bottleURL }) else { return }
        do {
            try SteamLauncher.send(argument, bottle: bottle)
        } catch {
            launchError = error.localizedDescription
        }
    }

    private func launchProgram(at url: URL, in bottle: Bottle) {
        // Through the bottle's own program list where possible, so the launch
        // picks up that program's overrides rather than only the bottle's.
        guard let program = bottle.programs.first(where: { $0.url == url }) else {
            programLaunching.insert(url)
            Task {
                defer { programLaunching.remove(url) }
                do {
                    try await Wine.runProgram(at: url, bottle: bottle)
                } catch {
                    launchError = error.localizedDescription
                }
            }
            return
        }

        programLaunching.insert(url)
        let useTerminal = NSEvent.modifierFlags.contains(.shift)
        Task {
            let result = await program.launchWithUserMode(useTerminal: useTerminal)
            programLaunching.remove(url)
            toast = result.toastData
        }
    }

    /// The orchestrator for a bottle, made once and kept.
    ///
    /// Its `phases` and `runningAppIds` are what the cards read, so it has to
    /// outlive the launch that created it.
    private func orchestrator(for bottle: Bottle) -> SteamClientOrchestrator {
        if let existing = orchestrators[bottle.url] {
            return existing
        }

        let made = SteamClientOrchestrator(bottle: bottle, driver: AppSteamClientDriver(bottle: bottle))
        let url = bottle.url
        made.$phases
            .sink { [weak self] phases in
                self?.steamLaunching[url] = Set(phases.keys)
            }
            .store(in: &cancellables)
        made.$runningAppIds
            .sink { [weak self] running in
                self?.steamRunning[url] = running
            }
            .store(in: &cancellables)
        made.$isClientRunning
            .sink { [weak self] running in
                if running {
                    self?.steamClientRunning.insert(url)
                } else {
                    self?.steamClientRunning.remove(url)
                }
            }
            .store(in: &cancellables)
        made.$launchError
            .compactMap { $0 }
            .sink { [weak self] error in
                self?.launchError = error
            }
            .store(in: &cancellables)

        orchestrators[bottle.url] = made
        return made
    }

    /// Starts (or restarts) running-state polling for a bottle's Steam client
    /// and games. The client counts even with no game installed: it is what
    /// the library offers to open, and it must not offer to open one already
    /// running.
    private func trackSteam(in bottle: Bottle) {
        guard SteamLibrary.detectInstall(bottleURL: bottle.url) != nil else { return }
        orchestrator(for: bottle).startTracking(games: SteamLibrary.enumerate(bottleURL: bottle.url))
    }

    /// Stops every poller. Called when the library leaves the screen.
    func stopTracking() {
        for orchestrator in orchestrators.values {
            orchestrator.stop()
        }
    }
}
