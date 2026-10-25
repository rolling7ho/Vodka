//
//  StatisticsView.swift
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

import SwiftUI
import VodkaKit

/// One game's numbers, whichever record they came from.
struct GameStatistics: Identifiable, Sendable {
    let id: String
    let name: String
    let bottleName: String?
    let artworkURL: URL?
    let iconURL: URL?
    let total: TimeInterval
    let lastTwoWeeks: TimeInterval
    let lastPlayed: Date?
    /// Only known for programs Vodka started itself: Steam records a total,
    /// not the sessions that made it.
    let sessions: Int?
    let longestSession: TimeInterval?
    let sizeOnDisk: Int64?
}

/// Builds the statistics page from Steam's playtime records and Vodka's own.
@MainActor
final class StatisticsModel: ObservableObject {
    @Published private(set) var games: [GameStatistics] = []
    @Published private(set) var loaded = false

    var played: [GameStatistics] { games.filter { $0.total > 0 } }
    var unplayed: [GameStatistics] { games.filter { $0.total == 0 } }
    var totalPlaytime: TimeInterval { games.map(\.total).reduce(0, +) }
    var lastTwoWeeks: TimeInterval { games.map(\.lastTwoWeeks).reduce(0, +) }
    var storage: Int64 { games.compactMap(\.sizeOnDisk).reduce(0, +) }
    var mostPlayed: GameStatistics? { played.first }
    var lastPlayedGame: GameStatistics? {
        games.compactMap { game in game.lastPlayed.map { (game, $0) } }
            .max { $0.1 < $1.1 }?.0
    }
    var longestSession: (game: GameStatistics, length: TimeInterval)? {
        games.compactMap { game in game.longestSession.map { (game, $0) } }
            .filter { $0.1 > 0 }
            .max { $0.1 < $1.1 }
    }

    func reload(bottles: [Bottle]) async {
        var built: [GameStatistics] = []
        let showBottleName = bottles.count > 1

        for bottle in bottles {
            let url = bottle.url
            let name = showBottleName ? bottle.settings.name : nil
            let pinned = PinnedLibrarySource.items(inBottleAt: url, settings: bottle.settings)
            built += await Task.detached {
                Self.statistics(inBottleAt: url, bottleName: name, pinned: pinned)
            }.value
        }

        games = built.sorted { first, second in
            if first.total != second.total { return first.total > second.total }
            return first.name.localizedStandardCompare(second.name) == .orderedAscending
        }
        loaded = true
    }

    /// Off the main actor: this parses every Steam manifest and the account's
    /// `localconfig.vdf`, which runs to hundreds of kilobytes.
    nonisolated private static func statistics(
        inBottleAt url: URL, bottleName: String?, pinned: [LibraryEntry]
    ) -> [GameStatistics] {
        let steamGames = Dictionary(SteamLibrary.enumerate(bottleURL: url).map { ($0.appId, $0) }) { first, _ in first }
        let steamPlaytime = SteamLibrary.detectInstall(bottleURL: url)
            .map(SteamPlaytimeReader.read(steamRoot:)) ?? [:]
        // A pinned game that is also a Steam game is merged into the pin, the
        // same as the library does; Steam's record for it still counts.
        let appIDByName = Dictionary(steamGames.values.map { ($0.name.lowercased(), $0.appId) }) { first, _ in first }
        let twoWeeksAgo = Date.now.addingTimeInterval(-14 * 24 * 3600)

        let entries = LibraryCatalogue.merge([pinned, SteamLibrarySource.entries(inBottleAt: url)])
        return entries.filter { !$0.isLauncher }.map { entry in
            var appID: Int?
            var program: ProgramPlaytime?
            var programRecent: TimeInterval = 0

            switch entry.launch {
            case let .steam(id):
                appID = id
            case let .program(programURL):
                let file = programURL.lastPathComponent
                program = PlaytimeStore.load(for: file, in: url)
                programRecent = RunLogStore.load(for: file, in: url).entries.reduce(0) { sum, run in
                    guard let end = run.endTime, end > twoWeeksAgo else { return sum }
                    return sum + end.timeIntervalSince(max(run.startTime, twoWeeksAgo))
                }
                appID = appIDByName[entry.name.lowercased()]
            }

            let steam = appID.flatMap { steamPlaytime[$0] }
            let game = appID.flatMap { steamGames[$0] }
            // A pinned Steam game started directly is usually relaunched by
            // Steam, so both records saw the same hours; the larger one is the
            // better guess, where adding them would count it twice.
            return GameStatistics(
                id: entry.id,
                name: entry.name,
                bottleName: bottleName,
                artworkURL: entry.artworkURL,
                iconURL: entry.iconURL,
                total: max(steam?.total ?? 0, program?.total ?? 0),
                lastTwoWeeks: max(steam?.lastTwoWeeks ?? 0, programRecent),
                lastPlayed: [steam?.lastPlayed, program?.lastPlayed, game?.manifest.lastPlayed].compactMap { $0 }.max(),
                sessions: program.flatMap { $0.sessions > 0 ? $0.sessions : nil },
                longestSession: program.flatMap { $0.longestSession > 0 ? $0.longestSession : nil },
                sizeOnDisk: game?.manifest.sizeOnDisk
            )
        }
    }
}

/// Playtime and the rest: how long has gone into each game, what was played
/// lately, and what the library takes on disk.
struct StatisticsView: View {
    @EnvironmentObject var bottleVM: BottleVM
    /// Toggled when Vodka comes back to the front, so the numbers catch up
    /// with a session that just ended.
    @Binding var refresh: Bool

    @StateObject private var model = StatisticsModel()

    private var bottles: [Bottle] { bottleVM.bottles.filter(\.isAvailable) }

    var body: some View {
        Group {
            if !model.loaded {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if model.games.isEmpty {
                ContentUnavailableView(
                    "No games yet",
                    systemImage: "chart.bar",
                    description: Text("Install a game through Steam or pin a program, and its playtime shows up here.")
                )
            } else {
                content
            }
        }
        .navigationTitle("Statistics")
        .task(id: "\(refresh)\(bottles.map(\.url.path))") {
            await model.reload(bottles: bottles)
        }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                tiles
                if !model.played.isEmpty {
                    section("Most played") {
                        VStack(spacing: 0) {
                            ForEach(Array(model.played.enumerated()), id: \.element.id) { index, game in
                                if index > 0 { Divider().padding(.leading, 92) }
                                StatisticsRow(game: game, maximum: model.played.first?.total ?? 1)
                            }
                        }
                        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }
                if !model.unplayed.isEmpty {
                    section("Not played yet") {
                        Text(model.unplayed.map(\.name).formatted(.list(type: .and)))
                            .foregroundStyle(.secondary)
                    }
                }
                Text("Steam games use Steam's own playtime, which Steam saves every few minutes while a game runs. "
                    + "Other apps count the time Vodka has them open.")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(24)
            .frame(maxWidth: 900, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
    }

    private var tiles: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 190), spacing: 12)], spacing: 12) {
            StatisticsTile(
                title: "Total playtime",
                value: Self.duration(model.totalPlaytime),
                detail: model.games.count == 1
                    ? "across 1 game" : "across \(model.played.count) of \(model.games.count) games",
                systemImage: "clock"
            )
            StatisticsTile(
                title: "Last two weeks",
                value: Self.duration(model.lastTwoWeeks),
                detail: model.lastPlayedGame.map { "last: \($0.name)" },
                systemImage: "calendar"
            )
            if let top = model.mostPlayed {
                StatisticsTile(
                    title: "Most played",
                    value: top.name,
                    detail: Self.duration(top.total),
                    systemImage: "trophy"
                )
            }
            if let longest = model.longestSession {
                StatisticsTile(
                    title: "Longest session",
                    value: Self.duration(longest.length),
                    detail: longest.game.name,
                    systemImage: "hourglass"
                )
            }
            if model.storage > 0 {
                StatisticsTile(
                    title: "Storage used",
                    value: model.storage.formatted(.byteCount(style: .file)),
                    detail: "by installed Steam games",
                    systemImage: "internaldrive"
                )
            }
        }
    }

    private func section(_ title: LocalizedStringKey, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.title3.weight(.semibold))
            content()
        }
    }

    /// "102 h 28 min", "45 min", or "—" for nothing at all. Hours rather than
    /// days, because "4 days" of a game reads as a calendar span.
    static func duration(_ seconds: TimeInterval) -> String {
        guard seconds >= 60 else { return seconds > 0 ? "< 1 min" : "—" }
        let minutes = Int(seconds / 60)
        let hours = minutes / 60
        if hours == 0 { return "\(minutes) min" }
        return minutes % 60 == 0 || hours >= 100 ? "\(hours) h" : "\(hours) h \(minutes % 60) min"
    }
}

private struct StatisticsTile: View {
    let title: LocalizedStringKey
    let value: String
    let detail: String?
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: systemImage)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title2.weight(.semibold))
                .lineLimit(1)
                .truncationMode(.tail)
            Text(detail ?? " ")
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

private struct StatisticsRow: View {
    let game: GameStatistics
    let maximum: TimeInterval

    @State private var image: Image?
    @State private var isArtwork = false

    private var subtitle: String {
        var parts: [String] = []
        if let bottle = game.bottleName { parts.append(bottle) }
        if let lastPlayed = game.lastPlayed {
            parts.append("last played \(lastPlayed.formatted(.relative(presentation: .named)))")
        }
        if game.lastTwoWeeks > 0 {
            parts.append("\(StatisticsView.duration(game.lastTwoWeeks)) in the last two weeks")
        }
        if let sessions = game.sessions {
            parts.append(sessions == 1 ? "1 session" : "\(sessions) sessions")
        }
        return parts.joined(separator: " · ")
    }

    var body: some View {
        HStack(spacing: 12) {
            thumbnail
            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline) {
                    Text(game.name)
                        .font(.headline)
                        .lineLimit(1)
                    Spacer()
                    Text(StatisticsView.duration(game.total))
                        .font(.body.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
                ProgressView(value: min(game.total, maximum), total: max(maximum, 1))
                    .progressViewStyle(.linear)
                    .tint(.accentColor)
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .task(id: game.id) { await loadImage() }
        .accessibilityElement(children: .combine)
    }

    private var thumbnail: some View {
        RoundedRectangle(cornerRadius: 6, style: .continuous)
            .fill(.quaternary)
            .frame(width: 68, height: 32)
            .overlay {
                if let image, isArtwork {
                    image.resizable().scaledToFill()
                } else if let image {
                    // An executable's icon is square and small; cropped to the
                    // banner's shape it would lose most of itself.
                    image.resizable().scaledToFit().padding(3)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
    }

    private func loadImage() async {
        if let artworkURL = game.artworkURL,
           let sampled = await IconCache.shared.sampledArtwork(for: artworkURL) {
            image = Image(nsImage: sampled.image)
            isArtwork = true
        } else if let iconURL = game.iconURL {
            image = Image(nsImage: await IconCache.shared.sampledIcon(for: iconURL).image)
        }
    }
}
