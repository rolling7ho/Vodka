//
//  WhiskyBuildMigration.swift
//  VodkaKit
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

import Foundation
import os.log

/// Moves the data of this fork's builds from before it was called Vodka.
///
/// Those builds ran as `com.rolling7ho.Whisky`, and everything they kept is in
/// folders named after that identifier: the Windows PCs and their list, the
/// Wine engine, the logs, the settings. Vodka moves the folders rather than
/// importing in place the way it does for the original Whisky's bottles,
/// because these are the same app's own data and leaving them under the old
/// name would keep it forever.
///
/// Moving is not enough on its own. Absolute paths into those folders are
/// written down in several places: the bottle list, each bottle's settings and
/// run history, and the Wine registry, which records where the engine's fonts
/// and Mono installer are. Those are rewritten to the new folders. So are the
/// Dock launchers "Add to Dock" made, which name the old command-line tool.
public enum WhiskyBuildMigration {
    private static let logger = Logger(subsystem: Bundle.vodkaBundleIdentifier, category: "WhiskyBuildMigration")

    public static let previousIdentifier = "com.rolling7ho.Whisky"
    static let doneKey = "migratedFromWhiskyBuild"

    public enum Outcome: Equatable {
        /// Nothing to move: done before, or there never was an earlier build.
        case notNeeded
        case migrated
        /// Moving now would pull folders out from under a running program.
        case blocked(reason: String)
        case failed(reason: String)
    }

    /// The folders and files the migration reads and writes. Injectable so a
    /// test can point it at a temporary home.
    public struct Locations {
        public let library: URL
        public let applications: URL
        public let oldIdentifier: String
        public let newIdentifier: String

        public init(
            home: URL = FileManager.default.homeDirectoryForCurrentUser,
            oldIdentifier: String = WhiskyBuildMigration.previousIdentifier,
            newIdentifier: String = Bundle.vodkaBundleIdentifier
        ) {
            self.library = home.appending(path: "Library")
            self.applications = home.appending(path: "Applications")
            self.oldIdentifier = oldIdentifier
            self.newIdentifier = newIdentifier
        }

        /// Each folder named after the identifier, old and new.
        var folders: [(old: URL, new: URL)] {
            ["Containers", "Application Support", "Logs"].map { parent in
                let base = library.appending(path: parent)
                return (base.appending(path: oldIdentifier), base.appending(path: newIdentifier))
            }
        }

        var oldContainer: URL { folders[0].old }
        var newContainer: URL { folders[0].new }
    }

    /// Runs the migration unless it already ran or has nothing to do.
    public static func runIfNeeded(
        locations: Locations = Locations(),
        defaults: UserDefaults = .standard,
        isBlocked: (Locations) -> String? = runningProgramBlocking
    ) -> Outcome {
        guard !defaults.bool(forKey: doneKey) else { return .notNeeded }
        let fileManager = FileManager.default
        guard locations.folders.contains(where: { fileManager.fileExists(atPath: $0.old.path(percentEncoded: false)) })
        else {
            defaults.set(true, forKey: doneKey)
            return .notNeeded
        }
        if let reason = isBlocked(locations) {
            return .blocked(reason: reason)
        }

        do {
            for folder in locations.folders {
                try move(folder.old, to: folder.new)
            }
            try rewriteRecordedPaths(in: locations)
            copyPreferences(locations: locations, defaults: defaults)
            rewriteDockLaunchers(in: locations)
        } catch {
            logger.error("Migration failed: \(error.localizedDescription)")
            return .failed(reason: error.localizedDescription)
        }

        defaults.set(true, forKey: doneKey)
        logger.info("Moved data from \(locations.oldIdentifier) to \(locations.newIdentifier)")
        return .migrated
    }

    /// The old app, or any Wine program running from the old folders.
    public static func runningProgramBlocking(_ locations: Locations) -> String? {
        let list = Process()
        list.executableURL = URL(filePath: "/bin/ps")
        list.arguments = ["-axo", "comm="]
        let pipe = Pipe()
        list.standardOutput = pipe
        do {
            try list.run()
        } catch {
            return nil
        }
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        list.waitUntilExit()
        guard let output = String(bytes: data, encoding: .utf8) else { return nil }

        let lines = output.split(separator: "\n")
        if lines.contains(where: { $0.hasSuffix("/Whisky.app/Contents/MacOS/Whisky") }) {
            return "Whisky is still open."
        }
        if lines.contains(where: { $0.contains("/\(locations.oldIdentifier)/") }) {
            return "Steam or a game is still running from Whisky."
        }
        return nil
    }

    // MARK: - Folders

    /// Renames `old` to `new`. If `new` exists already, which happens when
    /// Vodka ran before it had anything to move, the old folder's contents go
    /// into it, the old ones winning: they are the real data.
    static func move(_ old: URL, to new: URL) throws {
        let fileManager = FileManager.default
        guard fileManager.fileExists(atPath: old.path(percentEncoded: false)) else { return }
        guard fileManager.fileExists(atPath: new.path(percentEncoded: false)) else {
            try fileManager.moveItem(at: old, to: new)
            return
        }
        for item in try fileManager.contentsOfDirectory(at: old, includingPropertiesForKeys: nil) {
            let target = new.appending(path: item.lastPathComponent)
            if fileManager.fileExists(atPath: target.path(percentEncoded: false)) {
                try fileManager.removeItem(at: target)
            }
            try fileManager.moveItem(at: item, to: target)
        }
        try fileManager.removeItem(at: old)
    }

    // MARK: - Recorded paths

    /// Every file that writes down a path into the old folders. Only the
    /// bottle's own records: a game's files under `drive_c` are its business.
    static func rewriteRecordedPaths(in locations: Locations) throws {
        let container = locations.newContainer
        let old = locations.oldIdentifier
        let new = locations.newIdentifier

        for plist in plists(in: container) {
            try rewritePlist(at: plist, old: old, new: new)
        }

        var bottles = Set(subfolders(of: container.appending(path: "Bottles")))
        if let registry = try? Data(contentsOf: container.appending(path: "BottleVM.plist")),
           let decoded = try? PropertyListDecoder().decode(Registry.self, from: registry) {
            bottles.formUnion(decoded.paths)
        }
        for bottle in bottles {
            for plist in plists(in: bottle) + plists(in: bottle.appending(path: "Program Settings")) {
                try rewritePlist(at: plist, old: old, new: new)
            }
            for registry in files(in: bottle, extension: "reg") {
                try rewriteText(at: registry, old: old, new: new)
            }
        }
    }

    private struct Registry: Decodable {
        var paths: [URL]
    }

    /// `old` where it names a folder: followed by a separator, a quote or
    /// nothing. That leaves alone identifiers that merely start the same way.
    static func rewritten(_ string: String, old: String, new: String) -> String {
        guard string.contains(old),
              let pattern = try? NSRegularExpression(
                  pattern: NSRegularExpression.escapedPattern(for: old) + #"(?=[/\\"]|$)"#
              )
        else { return string }
        let range = NSRange(string.startIndex..., in: string)
        return pattern.stringByReplacingMatches(
            in: string, range: range, withTemplate: NSRegularExpression.escapedTemplate(for: new)
        )
    }

    static func rewritten(_ value: Any, old: String, new: String) -> Any {
        switch value {
        case let string as String:
            rewritten(string, old: old, new: new)
        case let array as [Any]:
            array.map { rewritten($0, old: old, new: new) }
        case let dictionary as [String: Any]:
            dictionary.mapValues { rewritten($0, old: old, new: new) }
        default:
            value
        }
    }

    /// Decoded and re-encoded in the format it was in, because a binary plist
    /// has byte offsets that a text replacement would break.
    static func rewritePlist(at url: URL, old: String, new: String) throws {
        let data = try Data(contentsOf: url)
        guard data.range(of: Data(old.utf8)) != nil else { return }
        var format = PropertyListSerialization.PropertyListFormat.xml
        let object = try PropertyListSerialization.propertyList(from: data, format: &format)
        let updated = try PropertyListSerialization.data(
            fromPropertyList: rewritten(object, old: old, new: new), format: format, options: 0
        )
        try updated.write(to: url, options: .atomic)
    }

    /// Wine's registry files are ASCII with escapes, so Latin-1 reads and
    /// writes them back byte for byte.
    static func rewriteText(at url: URL, old: String, new: String) throws {
        let data = try Data(contentsOf: url)
        guard data.range(of: Data(old.utf8)) != nil,
              let text = String(data: data, encoding: .isoLatin1),
              let encoded = rewritten(text, old: old, new: new).data(using: .isoLatin1)
        else { return }
        try encoded.write(to: url, options: .atomic)
    }

    // MARK: - Preferences

    /// Settings keys carried the app's name ("checkWhiskyWineUpdates"), so
    /// they are renamed the way the code was. A key Vodka already has stays.
    static func copyPreferences(locations: Locations, defaults: UserDefaults) {
        guard let old = defaults.persistentDomain(forName: locations.oldIdentifier) else { return }
        var current = defaults.persistentDomain(forName: locations.newIdentifier) ?? [:]
        for (key, value) in old {
            let renamed = key.replacingOccurrences(of: "Whisky", with: "Vodka")
                .replacingOccurrences(of: "whisky", with: "vodka")
            guard current[renamed] == nil else { continue }
            current[renamed] = rewritten(value, old: locations.oldIdentifier, new: locations.newIdentifier)
        }
        defaults.setPersistentDomain(current, forName: locations.newIdentifier)
    }

    // MARK: - Dock launchers

    /// The launchers "Add to Dock" put in ~/Applications run a shell script
    /// naming the old app and its command-line tool.
    static func rewriteDockLaunchers(in locations: Locations) {
        for app in subfolders(of: locations.applications) where app.pathExtension == "app" {
            let script = app.appending(path: "Contents/MacOS/launch")
            guard var text = try? String(contentsOf: script, encoding: .utf8), text.contains("WhiskyCmd")
            else { continue }
            for (old, new) in [
                (locations.oldIdentifier, locations.newIdentifier),
                ("WHISKY_", "VODKA_"), ("Whisky", "Vodka")
            ] {
                text = text.replacingOccurrences(of: old, with: new)
            }
            do {
                try text.write(to: script, atomically: true, encoding: .utf8)
                try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: script.path)
            } catch {
                logger.error("Couldn't update \(app.lastPathComponent): \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Listing

    private static func contents(of folder: URL) -> [URL] {
        (try? FileManager.default.contentsOfDirectory(
            at: folder, includingPropertiesForKeys: [.isDirectoryKey], options: [.skipsHiddenFiles]
        )) ?? []
    }

    private static func subfolders(of folder: URL) -> [URL] {
        contents(of: folder).filter { (try? $0.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true }
    }

    private static func files(in folder: URL, extension ext: String) -> [URL] {
        contents(of: folder).filter { $0.pathExtension == ext }
    }

    private static func plists(in folder: URL) -> [URL] {
        files(in: folder, extension: "plist")
    }
}
