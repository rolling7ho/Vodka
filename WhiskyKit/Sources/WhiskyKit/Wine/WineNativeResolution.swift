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

/// Native-resolution rendering for a bottle's games.
///
/// Wine's mac driver reports the display in points unless `RetinaMode` is on,
/// and then a game renders at half the panel's pixels and macOS upscales it.
/// With `RetinaMode` the display's original mode is reported at twice its
/// point size, which on a Mac at its default scaling is the panel's real pixels.
/// Wine reads `RetinaMode` for the whole prefix only (never per app), so it is
/// a bottle setting.
///
/// The DPI stays at 96: at a higher DPI Wine scales every program that is not
/// DPI-aware, which most games are not, back down to points. The Steam client
/// is the one thing that should not be pixel-sized, so it gets Steam's own
/// `-forcedesktopscaling` instead.
extension Wine {
    /// The factor Wine's Retina mode scales the display by, and Steam's UI with it.
    static let nativeResolutionScale = "2"

    private static let nativeResolutionLogger = Logger(
        subsystem: "com.franke.Whisky", category: "NativeResolution"
    )

    /// Readies the runtime and the bottle for a game: the Game Mode bundle,
    /// then native resolution.
    @MainActor
    static func prepareGaming(bottle: Bottle, importer: RegistryImporter) async {
        WineGameMode.apply()
        await syncNativeResolution(bottle: bottle, importer: importer)
    }

    /// Puts the bottle's Retina mode and DPI where native resolution needs them.
    ///
    /// Reads the prefix's `.reg` files first, so a bottle that is already set
    /// costs no Wine process. Takes effect for processes started afterwards; a
    /// Steam client already running in the old mode keeps it until it restarts.
    @MainActor
    static func syncNativeResolution(bottle: Bottle, importer: RegistryImporter) async {
        guard bottle.settings.nativeResolution else { return }

        let retina = WineRegistryFile.readValue(
            bottleURL: bottle.url, key: #"HKCU\Software\Wine\Mac Driver"#, valueName: "RetinaMode"
        )
        let dpi = WineRegistryFile.readValue(
            bottleURL: bottle.url, key: #"HKCU\Control Panel\Desktop"#, valueName: "LogPixels"
        )
        let isSet = retina?.lowercased() == "y" && (dpi == nil || dpi?.lowercased() == "dword:00000060")
        guard !isSet else { return }

        let document = """
        Windows Registry Editor Version 5.00

        [HKEY_CURRENT_USER\\Software\\Wine\\Mac Driver]
        "RetinaMode"="y"

        [HKEY_CURRENT_USER\\Control Panel\\Desktop]
        "LogPixels"=dword:00000060

        """
        do {
            try await importer(document, bottle)
        } catch {
            nativeResolutionLogger.error("Could not turn on native resolution: \(error.localizedDescription)")
        }
    }

    /// The arguments for launching `url`, with Steam's UI scaled to match Retina mode.
    @MainActor
    static func nativeResolutionArguments(for url: URL, args: [String], bottle: Bottle) -> [String] {
        guard bottle.settings.nativeResolution,
              url.lastPathComponent.lowercased() == "steam.exe",
              !args.contains(where: { $0.lowercased() == "-forcedesktopscaling" })
        else {
            return args
        }
        return args + ["-forcedesktopscaling", nativeResolutionScale]
    }
}
