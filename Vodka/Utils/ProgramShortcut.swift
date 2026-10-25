//
//  ProgramShortcut.swift
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
import Foundation
import os.log
@preconcurrency import QuickLookThumbnailing
import VodkaKit

class ProgramShortcut {
    @MainActor
    private static func generateThumbnail(for url: URL) async -> NSImage? {
        let request = QLThumbnailGenerator.Request(
            fileAt: url,
            size: CGSize(width: 512, height: 512),
            scale: 2.0,
            representationTypes: .thumbnail
        )
        guard let thumbnail = try? await QLThumbnailGenerator.shared.generateBestRepresentation(for: request) else {
            return nil
        }
        return thumbnail.nsImage
    }

    /// Creates a shortcut `.app` bundle with icon extraction and Finder reveal.
    ///
    /// Uses ``ShortcutCreator`` from VodkaKit for the core bundle creation,
    /// then adds icon extraction (QuickLook) and Finder integration (AppKit)
    /// which are only available in the app target.
    @MainActor
    static func createShortcut(_ program: Program, app: URL, name: String) async {
        do {
            // Core bundle creation via shared VodkaKit logic
            let target = ShortcutCreator.liveTarget(for: program.url, bottle: program.bottle)
            let launchScript = ShortcutCreator.liveLaunchScript(for: target)
            try ShortcutCreator.createShortcutBundle(at: app, launchScript: launchScript, name: name)

            // App-specific: extract icon from PE file and set on the .app bundle
            let programUrl = program.url
            if let image = await generateThumbnail(for: programUrl) {
                NSWorkspace.shared.setIcon(
                    image,
                    forFile: app.path(percentEncoded: false),
                    options: NSWorkspace.IconCreationOptions()
                )
            }

            // Reveal in Finder
            NSWorkspace.shared.activateFileViewerSelecting([app])
        } catch {
            Logger.wineKit.error("Failed to create program shortcut: \(error.localizedDescription)")
        }
    }
}

// MARK: - Dock

extension ProgramShortcut {
    /// Makes a shortcut app for a library entry in `~/Applications` and keeps
    /// it in the Dock.
    ///
    /// The shortcut starts the game through VodkaCmd, the same live pipeline
    /// as ``createShortcut(_:app:name:)``, so clicking it never opens Vodka's
    /// window and per-game settings still apply. Making it again for the same
    /// game replaces the bundle and leaves the existing Dock tile alone.
    ///
    /// - Returns: The shortcut app's URL.
    @MainActor
    @discardableResult
    static func addToDock(_ entry: LibraryEntry, bottle: Bottle) async throws -> URL {
        let target: ShortcutCreator.LiveTarget = switch entry.launch {
        case let .steam(appID): .steamGame(appId: appID)
        case let .program(url): ShortcutCreator.liveTarget(for: url, bottle: bottle)
        }

        let app = shortcutURL(named: entry.name)
        if FileManager.default.fileExists(atPath: app.path(percentEncoded: false)) {
            try FileManager.default.removeItem(at: app)
        }
        try FileManager.default.createDirectory(
            at: app.deletingLastPathComponent(), withIntermediateDirectories: true
        )
        try ShortcutCreator.createShortcutBundle(
            at: app, launchScript: ShortcutCreator.liveLaunchScript(for: target), name: entry.name
        )

        if let icon = await dockIcon(for: entry) {
            NSWorkspace.shared.setIcon(icon, forFile: app.path(percentEncoded: false))
        }
        keepInDock(app, label: entry.name)
        return app
    }

    /// Where the shortcut for `name` goes. A bundle already there that Vodka
    /// did not make is never replaced; the shortcut takes a suffixed name
    /// instead.
    private static func shortcutURL(named name: String) -> URL {
        let folder = FileManager.default.homeDirectoryForCurrentUser.appending(path: "Applications")
        let safe = name.replacingOccurrences(of: "/", with: "-").replacingOccurrences(of: ":", with: "-")
        let plain = folder.appending(path: "\(safe).app")
        let script = plain.appending(path: "Contents/MacOS/launch")
        let ours = (try? String(contentsOf: script, encoding: .utf8))?.contains("VodkaCmd") ?? false
        let exists = FileManager.default.fileExists(atPath: plain.path(percentEncoded: false))
        return !exists || ours ? plain : folder.appending(path: "\(safe) (Vodka).app")
    }

    /// A macOS-shaped icon from the game's Steam cover art, falling back to the
    /// executable's own icon.
    @MainActor
    private static func dockIcon(for entry: LibraryEntry) async -> NSImage? {
        if case let .steam(appID) = entry.launch,
           let steamRoot = SteamLibrary.detectInstall(bottleURL: entry.bottleURL),
           let artURL = SteamLibrarySource.iconArtworkURL(appID: appID, steamRoot: steamRoot),
           let art = NSImage(contentsOf: artURL) {
            return roundedIcon(from: art)
        }
        guard let iconURL = entry.iconURL else { return nil }
        if case .steam = entry.launch, let art = NSImage(contentsOf: iconURL) {
            return roundedIcon(from: art)
        }
        return await generateThumbnail(for: iconURL)
    }

    /// Fills the 824-point body of Apple's 1024-point icon grid with `art`,
    /// cropped to a square and clipped to the system's corner radius, so the
    /// tile sits at the same size as the native apps beside it.
    private static func roundedIcon(from art: NSImage) -> NSImage {
        let side: CGFloat = 1024
        let body = NSRect(x: 100, y: 100, width: 824, height: 824)
        return NSImage(size: NSSize(width: side, height: side), flipped: false) { _ in
            NSBezierPath(roundedRect: body, xRadius: 185, yRadius: 185).addClip()
            let scale = max(body.width / art.size.width, body.height / art.size.height)
            let drawn = NSSize(width: art.size.width * scale, height: art.size.height * scale)
            art.draw(in: NSRect(
                x: body.midX - drawn.width / 2, y: body.midY - drawn.height / 2,
                width: drawn.width, height: drawn.height
            ))
            return true
        }
    }

    /// Adds `app` to the Dock's kept apps, unless it is already there, and
    /// restarts the Dock so the tile appears. There is no public API for
    /// this; the Dock reads `persistent-apps` from its own preferences on
    /// launch, which is what dragging an app into it writes.
    private static func keepInDock(_ app: URL, label: String) {
        let domain = "com.apple.dock" as CFString
        let key = "persistent-apps" as CFString
        var tiles = CFPreferencesCopyAppValue(key, domain) as? [[String: Any]] ?? []

        let urlString = app.absoluteString
        let kept = tiles.contains { tile in
            let data = tile["tile-data"] as? [String: Any]
            let file = data?["file-data"] as? [String: Any]
            return (file?["_CFURLString"] as? String)?.trimmingCharacters(in: ["/"])
                == urlString.trimmingCharacters(in: ["/"])
        }

        if !kept {
            tiles.append([
                "tile-type": "file-tile",
                "tile-data": [
                    "file-label": label,
                    "file-data": ["_CFURLString": urlString, "_CFURLStringType": 15]
                ]
            ])
            CFPreferencesSetAppValue(key, tiles as CFArray, domain)
            CFPreferencesAppSynchronize(domain)
        }

        // Restarted even when the tile was already kept, so a replaced icon
        // shows instead of the Dock's cached copy of the old one.
        let killall = Process()
        killall.executableURL = URL(filePath: "/usr/bin/killall")
        killall.arguments = ["Dock"]
        try? killall.run()
    }
}
