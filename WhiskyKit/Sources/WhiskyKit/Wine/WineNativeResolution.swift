//
//  WineNativeResolution.swift
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

/// Native-resolution rendering for a bottle's games, with Windows sized to match.
///
/// Wine's mac driver reports the display in points unless `RetinaMode` is on,
/// and then a game renders at half the panel's pixels and macOS upscales it.
/// With `RetinaMode` the display's original mode is reported at twice its
/// point size, which on a Mac at its default scaling is the panel's real pixels.
/// Wine reads `RetinaMode` for the whole prefix only (never per app), so it is
/// a bottle setting.
///
/// The DPI goes to 192 with it, as Windows does on a 2x panel, so Steam, its
/// installer and updater and every other window come out the size macOS draws
/// its own. Wine stretches a program that is not DPI-aware to that size, which
/// for a game would mean rendering at half resolution again, so each game
/// executable is marked per-monitor DPI-aware through its Image File Execution
/// Options, the per-executable `dpiAwareness` Wine reads at startup, and keeps
/// every pixel.
extension Wine {
    private static let nativeResolutionLogger = Logger(
        subsystem: "com.franke.Whisky", category: "NativeResolution"
    )

    /// `LogPixels` for a 2x display: 192 DPI.
    static let nativeResolutionDPI = "dword:000000c0"

    /// 32-bit programs read the same key: Wine links its `Wow6432Node` twin to it.
    private static let executionOptionsKeys = [
        #"Software\Microsoft\Windows NT\CurrentVersion\Image File Execution Options"#
    ]

    /// Readies the runtime and the bottle for a game: the Game Mode bundle,
    /// then native resolution.
    ///
    /// Steam's own GPU preferences are left alone: with its web views
    /// software-rendered, Steam's window presents nothing under Wine's mac
    /// driver and stays black.
    ///
    /// - Parameter gameExecutables: Executables this launch starts as games,
    ///   besides every installed Steam game's, which are always covered so a
    ///   game started from inside the Steam client gets the same.
    @MainActor
    static func prepareGaming(bottle: Bottle, gameExecutables: [String] = [], importer: RegistryImporter) async {
        WineGameMode.apply()
        let document = nativeResolutionDocument(bottle: bottle, gameExecutables: gameExecutables)
        guard !document.isEmpty else { return }
        do {
            try await importer("Windows Registry Editor Version 5.00\n\n" + document, bottle)
        } catch {
            nativeResolutionLogger.error("Could not prepare the bottle for games: \(error.localizedDescription)")
        }
    }

    /// The registry changes native resolution still needs, or an empty string.
    ///
    /// Reads the prefix's `.reg` files first, so a bottle that is already set
    /// costs no Wine process. Takes effect for processes started afterwards; a
    /// Steam client already running in the old mode keeps it until it restarts.
    @MainActor
    static func nativeResolutionDocument(bottle: Bottle, gameExecutables: [String]) -> String {
        guard bottle.settings.nativeResolution else { return "" }
        var document = ""

        let retina = WineRegistryFile.readValue(
            bottleURL: bottle.url, key: #"HKCU\Software\Wine\Mac Driver"#, valueName: "RetinaMode"
        )
        let dpi = WineRegistryFile.readValue(
            bottleURL: bottle.url, key: #"HKCU\Control Panel\Desktop"#, valueName: "LogPixels"
        )
        if retina?.lowercased() != "y" || dpi?.lowercased() != nativeResolutionDPI {
            document += """
            [HKEY_CURRENT_USER\\Software\\Wine\\Mac Driver]
            "RetinaMode"="y"

            [HKEY_CURRENT_USER\\Control Panel\\Desktop]
            "LogPixels"=\(nativeResolutionDPI)


            """
        }

        let system = (try? String(contentsOf: bottle.url.appending(path: "system.reg"), encoding: .utf8))?
            .lowercased() ?? ""
        for exe in dpiAwareExecutables(bottle: bottle, gameExecutables: gameExecutables) {
            for key in executionOptionsKeys {
                // Wine's own files double each backslash in a key's name.
                let section = ("[" + key.replacingOccurrences(of: "\\", with: "\\\\") + "\\\\" + exe + "]")
                    .lowercased()
                guard let range = system.range(of: section) else {
                    document += executionOptionsEntry(key: key, exe: exe)
                    continue
                }
                let body = system[range.upperBound...].prefix { $0 != "[" }
                if !body.contains("\"dpiawareness\"=dword:00000002") {
                    document += executionOptionsEntry(key: key, exe: exe)
                }
            }
        }
        return document
    }

    private static func executionOptionsEntry(key: String, exe: String) -> String {
        "[HKEY_LOCAL_MACHINE\\\(key)\\\(exe)]\n\"dpiAwareness\"=dword:00000002\n\n"
    }

    /// The executables that should get every pixel: the launch's games and
    /// every installed Steam game's, never Steam's own.
    @MainActor
    static func dpiAwareExecutables(bottle: Bottle, gameExecutables: [String]) -> [String] {
        let library = SteamLibrary.enumerate(bottleURL: bottle.url).flatMap { game in
            SteamLibrary.executableURLs(under: game.installURL).map(\.lastPathComponent)
        }
        let steamOwn: Set = ["steam.exe", "steamwebhelper.exe", "steamservice.exe", "steamerrorreporter.exe"]
        var seen = Set<String>()
        return (gameExecutables + library).filter { name in
            let lower = name.lowercased()
            guard lower.hasSuffix(".exe"), !steamOwn.contains(lower), !lower.contains("\\"),
                  !lower.contains("]")
            else { return false }
            return seen.insert(lower).inserted
        }
    }
}
