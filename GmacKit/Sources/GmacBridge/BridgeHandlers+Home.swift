//
//  BridgeHandlers+Home.swift
//  GmacBridge
//
//  This file is part of Gmac, a fork of Whisky.
//
//  Gmac is free software: you can redistribute it and/or modify it under the terms
//  of the GNU General Public License as published by the Free Software Foundation,
//  either version 3 of the License, or (at your option) any later version.
//
//  Gmac is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
//  without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
//  See the GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License along with Gmac.
//  If not, see https://www.gnu.org/licenses/.
//

import Foundation
import GmacKit

private struct BottleHomeInput: Sendable {
    let url: URL
    let name: String
    let pinned: [LibraryEntry]
}

private struct BottleScanContext {
    let bottleURL: URL
    let bottleName: String
    let bottlePath: String
    let steamRoot: URL?
    let steamGames: [Int: SteamGame]
    let steamPlaytime: [Int: SteamPlaytime]
    let appIDByName: [String: Int]
}

private struct LauncherDescriptor {
    let id: String
    let name: String
    let launcherType: LauncherType
}

private struct DetectedLauncherInfo: Sendable {
    let bottleName: String
    let bottlePath: String
    let executablePath: String
}

private struct HomeAggregation: Sendable {
    let totalPlaytimeSeconds: TimeInterval
    let lastTwoWeeksSeconds: TimeInterval
    let gamesInstalled: Int
    let pcsCount: Int
    let hoursHistory: [StatPointRecord]
    let recentHoursHistory: [StatPointRecord]
    let gamesHistory: [StatPointRecord]
    let continuePlaying: HomeGameRecord?
    let recentlyPlayed: [HomeGameRecord]
    let allGames: [HomeGameRecord]
    let launchers: [String: DetectedLauncherInfo]
}

extension BridgeRouter {
    private static let supportedHomeLaunchers: [LauncherDescriptor] = [
        LauncherDescriptor(id: "steam", name: "Steam", launcherType: .steam),
        LauncherDescriptor(id: "epicGames", name: "Epic Games Store", launcherType: .epicGames),
        LauncherDescriptor(id: "battleNet", name: "Battle.net", launcherType: .battleNet),
        LauncherDescriptor(id: "eaApp", name: "EA App", launcherType: .eaApp),
        LauncherDescriptor(id: "rockstar", name: "Rockstar Games", launcherType: .rockstar),
        LauncherDescriptor(id: "ubisoft", name: "Ubisoft Connect", launcherType: .ubisoft)
    ]

    private static let maxArtworkBytes = 512 * 1_024

    @MainActor
    func homeSummary() async -> JSONValue {
        var bottlesList = BottleData()
        let availableBottles = bottlesList.loadBottles().filter(\.isAvailable)
        let inputs = availableBottles.map { bottle in
            BottleHomeInput(
                url: bottle.url,
                name: bottle.settings.name,
                pinned: PinnedLibrarySource.items(inBottleAt: bottle.url, settings: bottle.settings)
            )
        }

        let aggregation = await Task.detached(priority: .userInitiated) {
            Self.aggregateHome(inputs: inputs)
        }.value

        let launcherEntries = Self.encodeLaunchers(detected: aggregation.launchers)

        return .object([
            "stats": .object([
                "totalPlaytimeSeconds": .double(aggregation.totalPlaytimeSeconds),
                "lastTwoWeeksSeconds": .double(aggregation.lastTwoWeeksSeconds),
                "gamesInstalled": .int(aggregation.gamesInstalled),
                "pcsCount": .int(aggregation.pcsCount),
                "hoursHistory": .array(aggregation.hoursHistory.map { $0.toJSON() }),
                "recentHoursHistory": .array(aggregation.recentHoursHistory.map { $0.toJSON() }),
                "gamesHistory": .array(aggregation.gamesHistory.map { $0.toJSON() })
            ]),
            "continuePlaying": aggregation.continuePlaying?.toJSON() ?? .null,
            "recentlyPlayed": .array(aggregation.recentlyPlayed.map { $0.toJSON() }),
            "allGames": .array(aggregation.allGames.map { $0.toJSON() }),
            "launchers": .array(launcherEntries)
        ])
    }

    @MainActor
    func launchHomeItem(params: [String: JSONValue]) throws -> JSONValue {
        guard let rawBottlePath = params["bottlePath"]?.stringValue, !rawBottlePath.isEmpty else {
            throw BridgeError.invalidParams("Missing PC path.")
        }
        guard let launchKind = params["launchKind"]?.stringValue else {
            throw BridgeError.invalidParams("Missing launch kind.")
        }

        let targetCanonical = Self.canonicalBottlePath(URL(filePath: rawBottlePath))
        var bottlesList = BottleData()
        let bottles = bottlesList.loadBottles()
        guard let bottle = bottles.first(where: { Self.canonicalBottlePath($0.url) == targetCanonical }) else {
            throw BridgeError.operationFailed("PC not found.")
        }

        switch launchKind {
        case "steam":
            guard let appID = params["steamAppId"]?.intValue else {
                throw BridgeError.invalidParams("Missing Steam app ID.")
            }
            try SteamLauncher.launch(appId: appID, bottle: bottle)
            return .object(["launched": .bool(true)])
        case "program":
            guard let programPath = params["programPath"]?.stringValue, !programPath.isEmpty else {
                throw BridgeError.invalidParams("Missing executable path.")
            }
            let programURL = URL(filePath: programPath)
            guard FileManager.default.fileExists(atPath: programURL.path(percentEncoded: false)) else {
                throw BridgeError.operationFailed("Executable does not exist on disk.")
            }
            Task { @MainActor in
                _ = try? await Wine.runProgram(at: programURL, bottle: bottle)
            }
            return .object(["launched": .bool(true)])
        default:
            throw BridgeError.invalidParams("Unsupported launch kind: \(launchKind)")
        }
    }

    private static func aggregateHome(inputs: [BottleHomeInput]) -> HomeAggregation {
        var allGames: [HomeGameRecord] = []
        var detectedLaunchers: [String: DetectedLauncherInfo] = [:]

        for input in inputs {
            let bottleScan = scanBottleForHome(input)
            allGames.append(contentsOf: bottleScan.games)
            for (launcherID, info) in bottleScan.launchers where detectedLaunchers[launcherID] == nil {
                detectedLaunchers[launcherID] = info
            }
        }

        let sortedGames = allGames.sorted(by: compareGamesForHome)
        let heroGame = sortedGames.first
        let recentGames = Array(sortedGames.dropFirst().prefix(6))
        let totalSeconds = sortedGames.reduce(0) { $0 + $1.totalPlaytimeSeconds }
        let twoWeekSeconds = sortedGames.reduce(0) { $0 + $1.lastTwoWeeksSeconds }

        return HomeAggregation(
            totalPlaytimeSeconds: totalSeconds,
            lastTwoWeeksSeconds: twoWeekSeconds,
            gamesInstalled: sortedGames.count,
            pcsCount: inputs.count,
            hoursHistory: buildCumulativeHistory(
                games: sortedGames,
                totalHours: totalSeconds / 3_600
            ),
            recentHoursHistory: buildRecentHistory(
                games: sortedGames,
                twoWeekHours: twoWeekSeconds / 3_600
            ),
            gamesHistory: buildGamesHistory(totalGames: sortedGames.count),
            continuePlaying: heroGame,
            recentlyPlayed: recentGames,
            allGames: sortedGames,
            launchers: detectedLaunchers
        )
    }

    private static func scanBottleForHome(
        _ input: BottleHomeInput
    ) -> (games: [HomeGameRecord], launchers: [String: DetectedLauncherInfo]) {
        let bottlePath = input.url.path(percentEncoded: false)
        let steamRoot = SteamLibrary.detectInstall(bottleURL: input.url)
        let steamGames = Dictionary(
            SteamLibrary.enumerate(bottleURL: input.url).map { ($0.appId, $0) },
            uniquingKeysWith: { first, _ in first }
        )
        let steamPlaytime = steamRoot.map(SteamPlaytimeReader.read(steamRoot:)) ?? [:]
        let appIDByName = Dictionary(
            steamGames.values.map { ($0.name.lowercased(), $0.appId) },
            uniquingKeysWith: { first, _ in first }
        )
        let context = BottleScanContext(
            bottleURL: input.url,
            bottleName: input.name,
            bottlePath: bottlePath,
            steamRoot: steamRoot,
            steamGames: steamGames,
            steamPlaytime: steamPlaytime,
            appIDByName: appIDByName
        )

        let entries = LibraryCatalogue.merge([input.pinned, SteamLibrarySource.entries(inBottleAt: input.url)])
        let games = entries.filter { !$0.isLauncher }.map { entry in
            buildGameRecord(entry: entry, context: context)
        }
        let launchers = scanLaunchers(input: input, bottlePath: bottlePath, steamRoot: steamRoot)
        return (games, launchers)
    }

    private static func scanLaunchers(
        input: BottleHomeInput,
        bottlePath: String,
        steamRoot: URL?
    ) -> [String: DetectedLauncherInfo] {
        var launchers: [String: DetectedLauncherInfo] = [:]
        if let steamRoot {
            let steamExe = steamRoot.appending(path: "steam.exe").path(percentEncoded: false)
            if FileManager.default.fileExists(atPath: steamExe) {
                launchers["steam"] = DetectedLauncherInfo(
                    bottleName: input.name,
                    bottlePath: bottlePath,
                    executablePath: steamExe
                )
            }
        }
        for entry in input.pinned where entry.isLauncher {
            if let launcher = entry.launcher,
               case let .program(exeURL) = entry.launch,
               let descriptorID = launcherID(for: launcher),
               launchers[descriptorID] == nil {
                launchers[descriptorID] = DetectedLauncherInfo(
                    bottleName: input.name,
                    bottlePath: bottlePath,
                    executablePath: exeURL.path(percentEncoded: false)
                )
            }
        }
        return launchers
    }

    private static func buildGameRecord(
        entry: LibraryEntry,
        context: BottleScanContext
    ) -> HomeGameRecord {
        let twoWeeksAgo = Date.now.addingTimeInterval(-14 * 24 * 3_600)
        var resolvedAppID: Int?
        var program: ProgramPlaytime?
        var programRecent: TimeInterval = 0
        var launchKind = "program"
        var programPath: String?

        switch entry.launch {
        case let .steam(appID):
            launchKind = "steam"
            resolvedAppID = appID
        case let .program(programURL):
            launchKind = "program"
            programPath = programURL.path(percentEncoded: false)
            let file = programURL.lastPathComponent
            program = PlaytimeStore.load(for: file, in: context.bottleURL)
            programRecent = RunLogStore.load(for: file, in: context.bottleURL).entries.reduce(0) { sum, run in
                guard let end = run.endTime, end > twoWeeksAgo else { return sum }
                return sum + end.timeIntervalSince(max(run.startTime, twoWeeksAgo))
            }
            resolvedAppID = context.appIDByName[entry.name.lowercased()]
        }

        let steam = resolvedAppID.flatMap { context.steamPlaytime[$0] }
        let game = resolvedAppID.flatMap { context.steamGames[$0] }
        let total = max(steam?.total ?? 0, program?.total ?? 0)
        let lastTwoWeeks = max(steam?.lastTwoWeeks ?? 0, programRecent)
        let lastPlayed = [steam?.lastPlayed, program?.lastPlayed, game?.manifest.lastPlayed]
            .compactMap { $0 }
            .max()
        let portraitURL = resolvedAppID.flatMap { appID in
            context.steamRoot.flatMap { SteamLibrarySource.iconArtworkURL(appID: appID, steamRoot: $0) }
        }
        let logoURL = resolvedAppID.flatMap { appID in
            context.steamRoot.flatMap { findSteamLogoURL(appID: appID, steamRoot: $0) }
        }

        return HomeGameRecord(
            id: entry.id,
            name: entry.name,
            bottleName: context.bottleName,
            bottlePath: context.bottlePath,
            launchKind: launchKind,
            steamAppId: launchKind == "steam" ? resolvedAppID : nil,
            programPath: programPath,
            totalPlaytimeSeconds: total,
            lastTwoWeeksSeconds: lastTwoWeeks,
            lastPlayed: lastPlayed,
            artworkDataUrl: encodeArtworkDataURL(entry.artworkURL),
            portraitArtworkDataUrl: encodeArtworkDataURL(portraitURL),
            logoDataUrl: encodeArtworkDataURL(logoURL)
        )
    }

    private static func findSteamLogoURL(appID: Int, steamRoot: URL) -> URL? {
        let cache = steamRoot.appending(path: "appcache").appending(path: "librarycache")
        let appFolder = cache.appending(path: "\(appID)")
        let walked = FileManager.default.enumerator(
            at: appFolder,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        )?.compactMap { $0 as? URL } ?? []

        if let nestedLogo = walked.first(where: {
            $0.lastPathComponent == "logo.png" || $0.lastPathComponent == "\(appID)_logo.png"
        }) {
            return nestedLogo
        }

        let flatLogo = cache.appending(path: "\(appID)_logo.png")
        if FileManager.default.fileExists(atPath: flatLogo.path(percentEncoded: false)) {
            return flatLogo
        }
        return nil
    }

    private static func compareGamesForHome(_ lhs: HomeGameRecord, _ rhs: HomeGameRecord) -> Bool {
        switch (lhs.lastPlayed, rhs.lastPlayed) {
        case let (left?, right?) where left != right:
            return left > right
        case (.some, .none):
            return true
        case (.none, .some):
            return false
        default:
            if lhs.totalPlaytimeSeconds != rhs.totalPlaytimeSeconds {
                return lhs.totalPlaytimeSeconds > rhs.totalPlaytimeSeconds
            }
            return lhs.name.localizedStandardCompare(rhs.name) == .orderedAscending
        }
    }

    private static func encodeLaunchers(detected: [String: DetectedLauncherInfo]) -> [JSONValue] {
        let installed = supportedHomeLaunchers.filter { detected[$0.id] != nil }
        let uninstalled = supportedHomeLaunchers.filter { detected[$0.id] == nil }
        return (installed + uninstalled).map { descriptor in
            let info = detected[descriptor.id]
            return .object([
                "id": .string(descriptor.id),
                "name": .string(descriptor.name),
                "installed": .bool(info != nil),
                "bottleName": info.map { .string($0.bottleName) } ?? .null,
                "bottlePath": info.map { .string($0.bottlePath) } ?? .null,
                "executablePath": info.map { .string($0.executablePath) } ?? .null
            ])
        }
    }

    private static func launcherID(for launcher: LauncherType) -> String? {
        supportedHomeLaunchers.first { $0.launcherType == launcher }?.id
    }

    private static func encodeArtworkDataURL(_ url: URL?) -> String? {
        guard let url,
              let values = try? url.resourceValues(forKeys: [.fileSizeKey]),
              let size = values.fileSize,
              size > 0,
              size <= maxArtworkBytes,
              let data = try? Data(contentsOf: url)
        else {
            return nil
        }

        let ext = url.pathExtension.lowercased()
        let mimeType = ext == "png" ? "image/png" : "image/jpeg"
        return "data:\(mimeType);base64,\(data.base64EncodedString())"
    }
}
