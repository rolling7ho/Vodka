//
//  Playtime.swift
//  WhiskyKit
//
//  This file is part of Whisky.
//
//  Whisky is free software: you can redistribute it and/or modify it under the terms
//  of the GNU General Public License as published by the Free Software Foundation,
//  either version 3 of the License, or (at your option) any later version.
//
//  Whisky is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
//  without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
//  See the GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License along with Whisky.
//  If not, see https://www.gnu.org/licenses/.
//

import Foundation
import os.log

/// What Steam itself recorded about one app's playtime.
public struct SteamPlaytime: Equatable, Sendable {
    public let appID: Int
    /// Lifetime playtime on this account, in seconds.
    public let total: TimeInterval
    /// Playtime over the last two weeks, in seconds.
    public let lastTwoWeeks: TimeInterval
    public let lastPlayed: Date?
}

/// Reads the playtime the bottle's Steam client keeps for each account.
///
/// Steam's own record rather than one Whisky keeps, so a game started from
/// Steam's window, from Big Picture or before Whisky was installed still
/// counts. It lives in `userdata/<account>/config/localconfig.vdf` and Steam
/// rewrites it as it goes, so a session in progress shows up a few minutes late.
public enum SteamPlaytimeReader {
    /// Every app with a playtime record, keyed by App ID. With more than one
    /// account signed in on the bottle, each app keeps the larger record.
    public static func read(steamRoot: URL) -> [Int: SteamPlaytime] {
        let userdata = steamRoot.appending(path: "userdata")
        let accounts = (try? FileManager.default.contentsOfDirectory(
            at: userdata, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles]
        )) ?? []

        var merged: [Int: SteamPlaytime] = [:]
        for account in accounts {
            let config = account.appending(path: "config").appending(path: "localconfig.vdf")
            for record in records(in: config) where record.total > (merged[record.appID]?.total ?? -1) {
                merged[record.appID] = record
            }
        }
        return merged
    }

    static func records(in config: URL) -> [SteamPlaytime] {
        guard let text = try? String(contentsOf: config, encoding: .utf8),
              let document = try? VDFParser.parse(text)
        else { return [] }
        return records(fromDocument: document)
    }

    /// The parser lowercases keys, so Valve's "Software/Valve/Steam" is found
    /// whatever case a given Steam build wrote it in.
    static func records(fromDocument document: [String: VDFValue]) -> [SteamPlaytime] {
        let path = ["userlocalconfigstore", "software", "valve", "steam", "apps"]
        var node: [String: VDFValue]? = document
        for key in path {
            node = node?[key]?.objectValue
        }
        guard let apps = node else { return [] }

        return apps.compactMap { key, value in
            guard let appID = Int(key), let app = value.objectValue else { return nil }
            let minutes = app["playtime"]?.intValue ?? 0
            let recent = app["playtime2wks"]?.intValue ?? 0
            let lastPlayed = app["lastplayed"]?.intValue
                .flatMap { $0 > 0 ? Date(timeIntervalSince1970: TimeInterval($0)) : nil }
            guard minutes > 0 || lastPlayed != nil else { return nil }
            return SteamPlaytime(
                appID: appID,
                total: TimeInterval(minutes * 60),
                lastTwoWeeks: TimeInterval(recent * 60),
                lastPlayed: lastPlayed
            )
        }
    }
}

/// Lifetime totals for a program Whisky launched directly.
///
/// Kept apart from ``RunLogHistory`` because that keeps only the last ten runs,
/// for their logs; a total built from it would shrink as old runs fall off.
public struct ProgramPlaytime: Codable, Equatable, Sendable {
    public var total: TimeInterval = 0
    public var sessions: Int = 0
    public var longestSession: TimeInterval = 0
    public var firstPlayed: Date?
    public var lastPlayed: Date?

    public init() {}

    /// Totals from the runs a history still holds, for a program played before
    /// Whisky kept totals.
    public init(history: RunLogHistory, excluding excluded: UUID? = nil) {
        for entry in history.entries where entry.id != excluded {
            guard let end = entry.endTime else { continue }
            add(start: entry.startTime, end: end)
        }
    }

    public mutating func add(start: Date, end: Date) {
        let length = max(0, end.timeIntervalSince(start))
        total += length
        sessions += 1
        longestSession = max(longestSession, length)
        firstPlayed = min(firstPlayed ?? start, start)
        lastPlayed = max(lastPlayed ?? end, end)
    }
}

/// Persistence for ``ProgramPlaytime``: one file per program beside its run
/// history, so two programs finishing at once never rewrite the same file.
public enum PlaytimeStore {
    private static let logger = Logger(subsystem: Bundle.whiskyBundleIdentifier, category: "PlaytimeStore")

    public static func url(for programName: String, in bottleURL: URL) -> URL {
        bottleURL
            .appending(path: "Program Settings")
            .appending(path: programName)
            .appendingPathExtension("playtime.plist")
    }

    /// The program's totals, or totals rebuilt from its run history when it
    /// has never been recorded.
    public static func load(for programName: String, in bottleURL: URL) -> ProgramPlaytime {
        let file = url(for: programName, in: bottleURL)
        if let data = try? Data(contentsOf: file),
           let stored = try? PropertyListDecoder().decode(ProgramPlaytime.self, from: data) {
            return stored
        }
        return ProgramPlaytime(history: RunLogStore.load(for: programName, in: bottleURL))
    }

    /// Adds one finished run to the program's totals.
    public static func record(
        _ entry: RunLogEntry, history: RunLogHistory, for programName: String, in bottleURL: URL
    ) {
        guard let end = entry.endTime else { return }
        let file = url(for: programName, in: bottleURL)

        var playtime: ProgramPlaytime
        if let data = try? Data(contentsOf: file),
           let stored = try? PropertyListDecoder().decode(ProgramPlaytime.self, from: data) {
            playtime = stored
        } else {
            // The first run since totals began: earlier runs still in the
            // history count too, rather than starting from zero.
            playtime = ProgramPlaytime(history: history, excluding: entry.id)
        }
        playtime.add(start: entry.startTime, end: end)

        do {
            try FileManager.default.createDirectory(
                at: file.deletingLastPathComponent(), withIntermediateDirectories: true
            )
            let encoder = PropertyListEncoder()
            encoder.outputFormat = .xml
            try encoder.encode(playtime).write(to: file, options: .atomic)
        } catch {
            logger.error("Failed to save playtime: \(error.localizedDescription)")
        }
    }
}
