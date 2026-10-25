//
//  LibraryView.swift
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
import SwiftUI
import VodkaKit

// swiftlint:disable type_body_length
/// The home screen: Steam, its installed games, and any other apps pinned.
///
/// This is the thing people open Vodka to do. A bottle (a "Windows PC" on
/// screen) is a Wine prefix, which is an implementation detail of running a
/// Windows program on a Mac, and it only earns space on screen once there is
/// more than one of them.
///
/// Steam gets a panel of its own rather than a card among the games: it is
/// how the games are reached, so it says whether it is running and offers to
/// open it or its store. Each game's card carries the actions a player wants
/// (Play, how it renders, its files, its store page, Uninstall) in a menu,
/// not only in a right-click.
///
/// Entries come from ``LibraryCatalogue``, so Steam games sit beside pinned
/// programs and a future launcher needs no change here.
struct LibraryView: View {
    @EnvironmentObject var bottleVM: BottleVM
    @Binding var selectedBottle: URL?
    /// Toggled when Vodka comes back to the front. Folded into the reload trigger
    /// because the bottle list is unchanged by a refresh, so watching only that
    /// would rebuild nothing.
    @Binding var refresh: Bool

    @AppStorage("librarySort") private var sort: LibrarySort = .recent

    @StateObject private var model = LibraryModel()
    @State private var search: String = ""
    @State private var showSteamGuide = false
    @State private var uninstalling: LibraryRow?
    /// Counts up while the grid shows, so a game Steam installs or removes
    /// appears or goes without a manual refresh. Cheap: the Steam scan is
    /// cached until a library folder changes.
    @State private var libraryTick = 0
    /// Counts up while the guide shows, so a game finishing its download in
    /// Steam brings up the grid without a manual refresh.
    @State private var guideTick = 0

    private var bottles: [Bottle] { bottleVM.bottles.filter(\.isAvailable) }

    private var hasSteamGames: Bool {
        _ = refresh
        _ = guideTick
        return bottles.contains { !SteamLibrary.enumerate(bottleURL: $0.url).isEmpty }
    }

    private var visible: [LibraryRow] {
        guard !search.isEmpty else { return model.rows }
        return model.rows.filter { $0.item.name.localizedCaseInsensitiveContains(search) }
    }

    /// Every input that changes what the grid should contain. Pins live in
    /// bottle settings, so a program pinned in the bottle screen shows up here
    /// without a relaunch.
    private var reloadTrigger: String {
        let pins = bottles.flatMap { $0.settings.pins.map(\.name) }
        return (bottles.map(\.url.path) + pins + ["\(refresh)", "\(guideTick)", "\(libraryTick)"])
            .joined(separator: "\u{1F}")
    }

    var body: some View {
        Group {
            // Until a Steam game is installed, the guide is what to do next,
            // whatever else the bottles hold.
            if model.rows.isEmpty || !hasSteamGames {
                emptyState
                    .task {
                        while !Task.isCancelled {
                            try? await Task.sleep(for: .seconds(5))
                            guideTick += 1
                        }
                    }
            } else {
                content
                    .task {
                        while !Task.isCancelled {
                            try? await Task.sleep(for: .seconds(8))
                            libraryTick += 1
                        }
                    }
            }
        }
        .navigationTitle("library.title")
        .searchable(text: $search, prompt: Text("library.search"))
        .toolbar { sortMenu }
        .toast($model.toast)
        .sheet(isPresented: $showSteamGuide) {
            SteamSetupGuideView { showSteamGuide = false }
                .frame(minWidth: 620, minHeight: 640)
        }
        .task(id: reloadTrigger) {
            await model.reload(bottles: bottles)
        }
        .onChange(of: sort, initial: true) {
            model.sort = sort
        }
        .onDisappear {
            model.stopTracking()
        }
        .alert(
            uninstallTitle,
            isPresented: Binding(
                get: { uninstalling != nil },
                set: { if !$0 { uninstalling = nil } }
            ),
            presenting: uninstalling
        ) { row in
            Button("Uninstall", role: .destructive) {
                if case let .steam(appID) = row.item.launch {
                    model.sendToSteam("steam://uninstall/\(appID)", in: row.item.bottleURL, bottles: bottles)
                }
            }
            Button("button.cancel", role: .cancel) {}
        } message: { row in
            Text(uninstallMessage(row))
        }
        .alert(
            "library.launch.failed",
            isPresented: Binding(
                get: { model.launchError != nil },
                set: { if !$0 { model.launchError = nil } }
            )
        ) {
            Button("button.ok") { model.launchError = nil }
        } message: {
            Text(model.launchError ?? "")
        }
        .alert(
            "Game Porting Toolkit needed",
            isPresented: Binding(
                get: { model.gptkNotice != nil },
                set: { if !$0 { model.gptkNotice = nil } }
            )
        ) {
            Button("Set Up") {
                model.gptkNotice = nil
                showSteamGuide = true
            }
            Button("button.ok", role: .cancel) { model.gptkNotice = nil }
        } message: {
            Text(model.gptkNotice ?? "")
        }
    }

    @ToolbarContentBuilder
    private var sortMenu: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            Button {
                showSteamGuide = true
            } label: {
                Label("Steam Setup", systemImage: "gamecontroller")
            }
            .help("Set up Steam, step by step")
        }
        ToolbarItem(placement: .primaryAction) {
            Menu {
                Picker("library.sort", selection: $sort) {
                    ForEach(LibrarySort.allCases) { option in
                        Text(option.label).tag(option)
                    }
                }
                .pickerStyle(.inline)
            } label: {
                Label("library.sort", systemImage: "arrow.up.arrow.down")
            }
            .accessibilityIdentifier("library.sort")
        }
    }

    // MARK: - Layout

    private var launcherRows: [LibraryRow] { visible.filter { $0.item.launcher == .steam } }
    private var gameRows: [LibraryRow] { visible.filter { $0.item.source == .steam && !$0.item.isLauncher } }
    private var otherRows: [LibraryRow] {
        visible.filter { $0.item.source != .steam && $0.item.launcher != .steam }
    }

    /// Bottles with Steam in them, each getting a panel. A bottle whose Steam
    /// shortcut was unpinned still has its games, so it still gets one.
    private var steamBottles: [Bottle] {
        let urls = Set((launcherRows + gameRows).map(\.item.bottleURL))
        return bottles.filter { urls.contains($0.url) }.sorted()
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                ForEach(steamBottles) { bottle in
                    SteamPanel(
                        bottleName: steamBottles.count > 1 ? bottle.settings.name : nil,
                        icon: launcherRows.first { $0.item.bottleURL == bottle.url }?.item.iconURL,
                        isRunning: model.steamClientRunning.contains(bottle.url),
                        games: gameRows.filter { $0.item.bottleURL == bottle.url },
                        send: { model.sendToSteam($0, in: bottle.url, bottles: bottles) }
                    )
                }

                LibrarySection(title: "Installed Games", count: gameRows.count) {
                    grid(gameRows, trailing: steamBottles.first.map { bottle in
                        AnyView(GetMoreGamesTile {
                            model.sendToSteam("steam://store", in: bottle.url, bottles: bottles)
                        })
                    })
                }

                if !otherRows.isEmpty {
                    LibrarySection(title: "Other Apps", count: otherRows.count) {
                        grid(otherRows, trailing: nil)
                    }
                }
            }
            .padding(20)
        }
    }

    private func grid(_ rows: [LibraryRow], trailing: AnyView?) -> some View {
        LazyVGrid(
            // 180 rather than 220 so two columns fit at the window's own
            // minimum width, where the sidebar leaves about 330pt: one
            // column of landscape cards is a list with wasted space.
            columns: [GridItem(.adaptive(minimum: 180, maximum: 320), spacing: 14)],
            spacing: 14
        ) {
            ForEach(rows) { row in
                LibraryCard(
                    item: row.item,
                    bottleName: row.bottleName,
                    lastPlayed: row.lastPlayed,
                    sizeOnDisk: row.sizeOnDisk,
                    state: model.state(for: row.item),
                    launch: { model.launch(row, bottles: bottles) },
                    actions: { menu(for: row) }
                )
                .contextMenu { menu(for: row) }
            }
            if let trailing {
                trailing
            }
        }
    }

    private var uninstallTitle: String {
        guard let uninstalling else { return "" }
        return "Uninstall \(uninstalling.item.name)?"
    }

    private func uninstallMessage(_ row: LibraryRow) -> String {
        let size = row.sizeOnDisk.map {
            " and frees \(ByteCountFormatter.string(fromByteCount: $0, countStyle: .file))"
        }
        return "Steam asks once more, then removes the game\(size ?? ""). "
            + "Saves kept in Steam Cloud stay, and you can install it again from your Steam library."
    }

    @ViewBuilder
    private func menu(for row: LibraryRow) -> some View {
        if model.state(for: row.item) == .running {
            Button("Quit Game", systemImage: "stop.fill") { model.stop(row, bottles: bottles) }
        } else {
            Button("Play", systemImage: "play.fill") { model.launch(row, bottles: bottles) }
        }
        if let bottle = bottles.first(where: { $0.url == row.item.bottleURL }) {
            Button("Add to Dock", systemImage: "dock.rectangle") { addToDock(row, bottle: bottle) }
        }
        Divider()
        if case let .steam(appID) = row.item.launch,
           let bottle = bottles.first(where: { $0.url == row.item.bottleURL }),
           bottle.settings.nativeResolution {
            resolutionMenu(appID: appID, bottle: bottle)
            Divider()
        }
        if let installURL = row.installURL {
            Button("Show Game Files", systemImage: "folder") {
                NSWorkspace.shared.activateFileViewerSelecting([installURL])
            }
        }
        if case let .steam(appID) = row.item.launch {
            Button("Store Page", systemImage: "bag") {
                model.sendToSteam("steam://store/\(appID)", in: row.item.bottleURL, bottles: bottles)
            }
            Divider()
            Button("Uninstall…", systemImage: "trash", role: .destructive) {
                uninstalling = row
            }
        }
        if case let .program(url) = row.item.launch {
            Button("button.showInFinder", systemImage: "folder") {
                NSWorkspace.shared.activateFileViewerSelecting([url])
            }
            Button("library.card.unpin", systemImage: "pin.slash", role: .destructive) {
                unpin(url, in: row.item.bottleURL)
            }
        }
        Divider()
        // Per-program settings live inside the bottle's own navigation stack,
        // which the library cannot push onto, so this is as close as the menu
        // gets without a deep link into it.
        Button("Settings…", systemImage: "gearshape") {
            selectedBottle = row.item.bottleURL
        }
    }

    /// Sharp draws every Retina pixel; Faster draws a quarter of them and the
    /// engine upscales them with MetalFX, for a game short of frames. Takes
    /// effect next launch.
    private func resolutionMenu(appID: Int, bottle: Bottle) -> some View {
        Picker("Graphics", selection: Binding(
            get: { bottle.settings.fasterSteamApps.contains(appID) },
            set: { faster in
                if faster {
                    bottle.settings.fasterSteamApps.insert(appID)
                } else {
                    bottle.settings.fasterSteamApps.remove(appID)
                }
                model.toast = ToastData(
                    message: faster ? "Faster from the next time you play"
                        : "Sharp from the next time you play",
                    style: .success
                )
            }
        )) {
            Text("Sharp: Full Resolution").tag(false)
            Text("Faster: Upscaled, Higher Frame Rate").tag(true)
        }
    }

    /// Puts a shortcut in the Dock that starts the game without opening
    /// Vodka.
    private func addToDock(_ row: LibraryRow, bottle: Bottle) {
        Task {
            do {
                try await ProgramShortcut.addToDock(row.item, bottle: bottle)
                model.toast = ToastData(message: "\(row.item.name) is in your Dock", style: .success)
            } catch {
                model.toast = ToastData(
                    message: "Couldn't add \(row.item.name) to the Dock: \(error.localizedDescription)",
                    style: .error
                )
            }
        }
    }

    private func unpin(_ url: URL, in bottleURL: URL) {
        guard let bottle = bottles.first(where: { $0.url == bottleURL }) else { return }
        bottle.settings.pins.removeAll { $0.url == url }
        if let program = bottle.programs.first(where: { $0.url == url }) {
            program.pinned = false
        }
    }

    /// Nothing to play yet: the Steam guide, which is the whole way in for now.
    private var emptyState: some View {
        SteamSetupGuideView()
    }
}

// swiftlint:enable type_body_length
