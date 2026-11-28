//
//  BridgeHandlers+HomeHistory.swift
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

struct StatPointRecord: Sendable {
    let date: String
    let value: Double

    func toJSON() -> JSONValue {
        .object([
            "date": .string(date),
            "value": .double(value)
        ])
    }
}

struct HomeGameRecord: Sendable {
    let id: String
    let name: String
    let bottleName: String
    let bottlePath: String
    let launchKind: String
    let steamAppId: Int?
    let programPath: String?
    let totalPlaytimeSeconds: TimeInterval
    let lastTwoWeeksSeconds: TimeInterval
    let lastPlayed: Date?
    let artworkDataUrl: String?
    let portraitArtworkDataUrl: String?
    let logoDataUrl: String?

    func toJSON() -> JSONValue {
        .object([
            "id": .string(id),
            "name": .string(name),
            "bottleName": .string(bottleName),
            "bottlePath": .string(bottlePath),
            "launchKind": .string(launchKind),
            "steamAppId": steamAppId.map { .int($0) } ?? .null,
            "programPath": programPath.map { .string($0) } ?? .null,
            "totalPlaytimeSeconds": .double(totalPlaytimeSeconds),
            "lastTwoWeeksSeconds": .double(lastTwoWeeksSeconds),
            "lastPlayedIso": lastPlayed.map { .string($0.ISO8601Format()) } ?? .null,
            "artworkDataUrl": artworkDataUrl.map { .string($0) } ?? .null,
            "portraitArtworkDataUrl": portraitArtworkDataUrl.map { .string($0) } ?? .null,
            "logoDataUrl": logoDataUrl.map { .string($0) } ?? .null
        ])
    }
}

extension BridgeRouter {
    static func buildCumulativeHistory(
        games: [HomeGameRecord],
        totalHours: Double
    ) -> [StatPointRecord] {
        let dayOffsets = [-30, -24, -18, -12, -7, -3, 0]
        let now = Date.now
        return dayOffsets.enumerated().map { idx, dayOffset in
            let date = now.addingTimeInterval(TimeInterval(dayOffset * 86_400))
            let ratio = Double(idx + 1) / Double(dayOffsets.count)
            let baseline = totalHours > 0 ? totalHours * min(1, ratio * 0.85 + 0.15) : 0
            let matchedHours = games
                .filter { game in
                    guard let played = game.lastPlayed else { return false }
                    return played <= date
                }
                .reduce(0) { $0 + $1.totalPlaytimeSeconds / 3_600 }
            let value = idx == dayOffsets.count - 1 ? totalHours : max(baseline, matchedHours)
            return StatPointRecord(date: date.ISO8601Format(), value: value)
        }
    }

    static func buildRecentHistory(
        games: [HomeGameRecord],
        twoWeekHours: Double
    ) -> [StatPointRecord] {
        let dayOffsets = [-12, -10, -8, -6, -4, -2, 0]
        let now = Date.now
        guard twoWeekHours > 0 else {
            return dayOffsets.map { dayOffset in
                let date = now.addingTimeInterval(TimeInterval(dayOffset * 86_400))
                return StatPointRecord(date: date.ISO8601Format(), value: 0)
            }
        }

        return dayOffsets.enumerated().map { idx, dayOffset in
            let bucketEnd = now.addingTimeInterval(TimeInterval(dayOffset * 86_400))
            let bucketStart = bucketEnd.addingTimeInterval(-2 * 86_400)
            let bucketSum = games
                .filter { game in
                    guard let played = game.lastPlayed else { return false }
                    return played >= bucketStart && played <= bucketEnd
                }
                .reduce(0) { $0 + $1.lastTwoWeeksSeconds / 3_600 }
            let smoothFallback = twoWeekHours * (0.08 + Double(idx % 3) * 0.05)
            return StatPointRecord(
                date: bucketEnd.ISO8601Format(),
                value: bucketSum > 0 ? bucketSum : smoothFallback
            )
        }
    }

    static func buildGamesHistory(totalGames: Int) -> [StatPointRecord] {
        let dayOffsets = [-30, -24, -18, -12, -7, -3, 0]
        let now = Date.now
        return dayOffsets.enumerated().map { idx, dayOffset in
            let date = now.addingTimeInterval(TimeInterval(dayOffset * 86_400))
            guard totalGames > 0 else {
                return StatPointRecord(date: date.ISO8601Format(), value: 0)
            }
            let ratio = Double(idx + 1) / Double(dayOffsets.count)
            let stepped = idx == dayOffsets.count - 1
                ? Double(totalGames)
                : Double(max(1, Int((Double(totalGames) * ratio).rounded())))
            return StatPointRecord(date: date.ISO8601Format(), value: stepped)
        }
    }

    @MainActor
    func launchSteamHomeItem(params: [String: JSONValue], bottle: Bottle) throws -> JSONValue {
        guard let appID = params["steamAppId"]?.intValue else {
            throw BridgeError.invalidParams("Missing Steam app ID.")
        }
        let steamGame = SteamLibrary.enumerate(bottleURL: bottle.url).first { $0.appId == appID }
        let primaryExe = steamGame.flatMap { SteamLibrary.executableURLs(under: $0.installURL).first }
        let savedSettings = primaryExe.flatMap { Program.persistedSettings(for: $0, bottleURL: bottle.url) }
        let extraArgs = savedSettings?.arguments.split(separator: " ").map(String.init) ?? []
        var extraEnv = savedSettings?.environment ?? [:]
        if let locale = savedSettings?.locale, locale != .auto {
            extraEnv["LC_ALL"] = locale.rawValue
        }
        try SteamLauncher.launch(
            appId: appID,
            bottle: bottle,
            installURL: steamGame?.installURL,
            additionalArgs: extraArgs,
            additionalEnvironment: extraEnv
        )
        return .object(["launched": .bool(true)])
    }

    @MainActor
    func launchProgramHomeItem(params: [String: JSONValue], bottle: Bottle) throws -> JSONValue {
        guard let programPath = params["programPath"]?.stringValue, !programPath.isEmpty
        else {
            throw BridgeError.invalidParams("Missing executable path.")
        }
        let programURL = URL(filePath: programPath)
        guard FileManager.default.fileExists(atPath: programURL.path(percentEncoded: false))
        else {
            throw BridgeError.operationFailed("Executable does not exist on disk.")
        }
        let program = Program(url: programURL, bottle: bottle)
        let args = program.settings.arguments.split(separator: " ").map(String.init)
        let env = program.generateEnvironment()
        let overrides = program.settings.overrides
        let programSettings = program.settings
        Task { @MainActor in
            _ = try? await Wine.runProgram(
                at: programURL,
                args: args,
                bottle: bottle,
                environment: env,
                programOverrides: overrides,
                programSettings: programSettings
            )
        }
        return .object(["launched": .bool(true)])
    }
}
