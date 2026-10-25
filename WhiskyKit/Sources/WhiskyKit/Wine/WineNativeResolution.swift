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
/// Needs this edition's engine (4.6.5): on 4.6.4 the mac driver laid out
/// Chromium's cross-process Metal layer in pixels inside a window measured in
/// points, so Steam showed its top-left quarter magnified. Turning the setting
/// off puts both values back.
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
    /// Steam's GPU preference is only ever put back to on: with its web views
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
            + steamAutostartRemoval(bottle: bottle)
            + steamGPURecovery(bottle: bottle)
            + WineGameInput.document(bottle: bottle, gameExecutables: gameExecutables)
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
        let retina = WineRegistryFile.readValue(
            bottleURL: bottle.url, key: #"HKCU\Software\Wine\Mac Driver"#, valueName: "RetinaMode"
        )
        let dpi = WineRegistryFile.readValue(
            bottleURL: bottle.url, key: #"HKCU\Control Panel\Desktop"#, valueName: "LogPixels"
        )
        guard bottle.settings.nativeResolution else {
            // Off: undo what turning it on set (both values together, so a
            // Retina mode chosen by hand under Advanced stays).
            guard retina?.lowercased() == "y", dpi?.lowercased() == nativeResolutionDPI else { return "" }
            return """
            [HKEY_CURRENT_USER\\Software\\Wine\\Mac Driver]
            "RetinaMode"="n"

            [HKEY_CURRENT_USER\\Control Panel\\Desktop]
            "LogPixels"=dword:00000060


            """
        }
        var document = ""

        if retina?.lowercased() != "y" || dpi?.lowercased() != nativeResolutionDPI {
            document += """
            [HKEY_CURRENT_USER\\Software\\Wine\\Mac Driver]
            "RetinaMode"="y"

            [HKEY_CURRENT_USER\\Control Panel\\Desktop]
            "LogPixels"=\(nativeResolutionDPI)


            """
        }

        let current = executionOptionsDPIAwareness(bottleURL: bottle.url)
        for (exe, awareness) in dpiAwareness(bottle: bottle, gameExecutables: gameExecutables) {
            let value = String(format: "dword:%08x", awareness)
            for key in executionOptionsKeys where current[(key + "\\" + exe).lowercased()] != value {
                document += executionOptionsEntry(key: key, exe: exe, value: value)
            }
        }
        return document
    }

    /// Each executable's `dpiAwareness` under the execution options keys, as
    /// `system.reg` holds it, keyed by the lower-cased key path and executable.
    ///
    /// One pass over the file, looking only at section headers until one of
    /// those keys comes up: `system.reg` runs to megabytes, and lower-casing
    /// all of it and searching it once per game executable cost every launch
    /// more than a tenth of a second.
    static func executionOptionsDPIAwareness(bottleURL: URL) -> [String: String] {
        guard let text = try? String(contentsOf: bottleURL.appending(path: "system.reg"), encoding: .utf8)
        else { return [:] }
        // Wine's own files double each backslash in a key's name.
        let prefixes = executionOptionsKeys.map {
            "[" + $0.replacingOccurrences(of: "\\", with: "\\\\").lowercased() + "\\\\"
        }
        var values: [String: String] = [:]
        var section: String?
        for line in text.split(separator: "\n", omittingEmptySubsequences: true) {
            if line.first == "[" {
                let header = line.lowercased()
                section = prefixes.contains(where: header.hasPrefix)
                    ? header.dropFirst().prefix { $0 != "]" }.replacingOccurrences(of: "\\\\", with: "\\")
                    : nil
            } else if let section, line.lowercased().hasPrefix("\"dpiawareness\"=") {
                values[section] = String(line.dropFirst(#""dpiAwareness"="#.count))
                    .trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            }
        }
        return values
    }

    private static func executionOptionsEntry(key: String, exe: String, value: String) -> String {
        "[HKEY_LOCAL_MACHINE\\\(key)\\\(exe)]\n\"dpiAwareness\"=\(value)\n\n"
    }

    /// Each game executable's `dpiAwareness`: 2 (per-monitor aware) to get
    /// every pixel, or 0 for a game set to Faster, which Wine then draws at
    /// the 96 DPI size and stretches, so the game renders a quarter of the
    /// pixels. Written explicitly rather than deleted, so a switch back from
    /// Sharp takes effect without clearing the key.
    @MainActor
    static func dpiAwareness(bottle: Bottle, gameExecutables: [String]) -> [(exe: String, awareness: Int)] {
        let faster = bottle.settings.fasterSteamApps
        let fasterExes: Set<String> = faster.isEmpty ? [] : Set(
            SteamLibrary.enumerate(bottleURL: bottle.url)
                .filter { faster.contains($0.appId) }
                .flatMap { SteamLibrary.executableURLs(under: $0.installURL).map { $0.lastPathComponent.lowercased() } }
        )
        return dpiAwareExecutables(bottle: bottle, gameExecutables: gameExecutables).map { exe in
            (exe, fasterExes.contains(exe.lowercased()) ? 0 : 2)
        }
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

    /// Turns Steam's GPU-drawn web views back on after Steam turned them off.
    ///
    /// When Steam's GPU process crashes it switches itself to software
    /// rendering and saves that, and software rendering presents nothing under
    /// Wine's mac driver: every later start is a black window. Set back here,
    /// it takes effect at the client's next start.
    static func steamGPURecovery(bottle: Bottle) -> String {
        let value = WineRegistryFile.readValue(
            bottleURL: bottle.url, key: #"HKCU\Software\Valve\Steam"#, valueName: "GPUAccelWebViewsV3"
        )
        guard value?.lowercased() == "dword:00000000" else { return "" }
        nativeResolutionLogger.info("Steam had switched to software rendering; turning GPU web views back on")
        return "[HKEY_CURRENT_USER\\Software\\Valve\\Steam]\n\"GPUAccelWebViewsV3\"=dword:00000001\n\n"
    }

    /// Takes Steam out of the bottle's startup programs.
    ///
    /// Steam's installer, and Steam itself on every run, lists it under `Run`,
    /// and Wine starts what is listed whenever the bottle boots: a registry
    /// import or a game's first process brought Steam up silently, outside
    /// Whisky and without the environment its launch gives it.
    static func steamAutostartRemoval(bottle: Bottle) -> String {
        let key = #"HKCU\Software\Microsoft\Windows\CurrentVersion\Run"#
        guard WineRegistryFile.valueNames(bottleURL: bottle.url, key: key)?.contains("Steam") == true else {
            return ""
        }
        return "[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]\n\"Steam\"=-\n\n"
    }
}
