//
//  WineGameMode.swift
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

/// Makes every Windows process the runtime starts a game to macOS, so Game Mode
/// turns on when one is full screen.
///
/// macOS only gives Game Mode to an app bundle whose Info.plist has the games
/// category; a bare executable registers with no bundle at all, and the
/// `__info_plist` section Wine embeds in its loader is never read. Each Windows
/// process runs as `lib/wine/x86_64-unix/wine`, the loader `ntdll` execs from
/// the real path of its own directory. So that directory becomes the `MacOS`
/// folder of `lib/wine/Wine.app`, and `x86_64-unix` a symlink to it, which
/// leaves every path the app and Wine use working while each process now runs
/// from inside a bundle that says it is a game.
///
/// Wine builds its other paths from that directory: `x86_64-unix` and the PE
/// folders beside it, `bin` and `share` two levels up, and the libraries it
/// loads through `@loader_path/../../`. Symlinks in the bundle point each of
/// them back at the runtime.
public enum WineGameMode {
    /// `UserDefaults` key for whether Wine processes declare themselves games.
    public static let enabledDefaultsKey = "gameModeEnabled"
    /// `UserDefaults` key for whether games see the display below the camera housing.
    public static let fitBelowNotchDefaultsKey = "fitGamesBelowNotch"
    /// The bundle identifier the Wine processes run under.
    public static let bundleIdentifier = "com.rolling7ho.Vodka.WineGame"

    private static let logger = Logger(subsystem: "com.rolling7ho.Vodka", category: "WineGameMode")
    private static let lsregister = URL(
        fileURLWithPath: "/System/Library/Frameworks/CoreServices.framework/Frameworks/"
            + "LaunchServices.framework/Support/lsregister"
    )

    /// Whether Wine processes should declare themselves games. On unless turned off.
    public static var isEnabled: Bool {
        UserDefaults.standard.object(forKey: enabledDefaultsKey) as? Bool ?? true
    }

    /// Whether full-screen games should get the display below the notch. Off unless turned on.
    public static var fitsBelowNotch: Bool {
        UserDefaults.standard.bool(forKey: fitBelowNotchDefaultsKey)
    }

    /// Whether the installed runtime currently runs its processes as a game.
    public static var isActive: Bool {
        let layout = Layout(libraryFolder: VodkaWineInstaller.libraryFolder)
        return layout.isConverted && FileManager.default.fileExists(atPath: layout.infoPlist.path)
    }

    struct Layout {
        let wineLib: URL
        let wineDir: URL
        let unixDir: URL
        let bundle: URL
        let macOS: URL
        let infoPlist: URL

        init(libraryFolder: URL) {
            wineLib = libraryFolder.appending(path: "Wine").appending(path: "lib")
            wineDir = wineLib.appending(path: "wine")
            unixDir = wineDir.appending(path: "x86_64-unix")
            bundle = wineDir.appending(path: "Wine.app")
            macOS = bundle.appending(path: "Contents").appending(path: "MacOS")
            infoPlist = bundle.appending(path: "Contents").appending(path: "Info.plist")
        }

        var isConverted: Bool {
            (try? FileManager.default.destinationOfSymbolicLink(atPath: unixDir.path)) != nil
        }
    }

    /// Brings the installed runtime's layout in line with the settings.
    ///
    /// Idempotent and cheap when nothing changed, so it runs at app launch,
    /// after a runtime install and before each program launch, which keeps a
    /// runtime update or a GPTK import covered.
    @discardableResult
    public static func apply(libraryFolder: URL = VodkaWineInstaller.libraryFolder) -> Bool {
        let layout = Layout(libraryFolder: libraryFolder)
        guard FileManager.default.fileExists(atPath: layout.unixDir.path) else { return false }
        do {
            if isEnabled {
                try convert(layout)
                try syncLinks(layout)
                if try writeInfoPlist(layout, fitBelowNotch: fitsBelowNotch) {
                    register(layout.bundle)
                }
            } else {
                try revert(layout)
            }
            return true
        } catch {
            logger.error("Could not update the Wine game bundle: \(error.localizedDescription)")
            return false
        }
    }

    /// Moves the loader's directory into the bundle and links it back.
    private static func convert(_ layout: Layout) throws {
        guard !layout.isConverted else { return }
        let fileManager = FileManager.default
        // A bundle left from a runtime that was since replaced holds stale files.
        try? fileManager.removeItem(at: layout.bundle)
        try fileManager.createDirectory(
            at: layout.macOS.deletingLastPathComponent(), withIntermediateDirectories: true
        )
        try fileManager.moveItem(at: layout.unixDir, to: layout.macOS)
        try fileManager.createSymbolicLink(atPath: layout.unixDir.path, withDestinationPath: "Wine.app/Contents/MacOS")
        logger.info("Moved the Wine loader into its game bundle")
    }

    /// Puts the loader's directory back where the runtime shipped it.
    private static func revert(_ layout: Layout) throws {
        guard layout.isConverted else { return }
        let fileManager = FileManager.default
        try fileManager.removeItem(at: layout.unixDir)
        for name in ["x86_64-unix", "x86_64-windows", "i386-windows"] {
            try? fileManager.removeItem(at: layout.macOS.appending(path: name))
        }
        try fileManager.moveItem(at: layout.macOS, to: layout.unixDir)
        try fileManager.removeItem(at: layout.bundle)
        logger.info("Moved the Wine loader out of its game bundle")
    }

    /// The symlinks that resolve Wine's relative paths from inside the bundle.
    static func links(wineLibEntries: [String]) -> [(path: String, destination: String)] {
        var links: [(String, String)] = [
            ("Contents/MacOS/x86_64-unix", "."),
            ("Contents/MacOS/x86_64-windows", "../../../x86_64-windows"),
            ("Contents/MacOS/i386-windows", "../../../i386-windows"),
            ("bin", "../../../bin"),
            ("share", "../../../share")
        ]
        // `@loader_path/../../` from the loader's directory is the bundle itself.
        let reserved: Set = ["wine", "bin", "share", "Contents"]
        for entry in wineLibEntries.sorted() where !reserved.contains(entry) && !entry.hasPrefix(".") {
            links.append((entry, "../../\(entry)"))
        }
        return links
    }

    private static func syncLinks(_ layout: Layout) throws {
        let fileManager = FileManager.default
        let entries = try fileManager.contentsOfDirectory(atPath: layout.wineLib.path)
        for link in links(wineLibEntries: entries) {
            let path = layout.bundle.appending(path: link.path).path
            if (try? fileManager.destinationOfSymbolicLink(atPath: path)) == link.destination { continue }
            try? fileManager.removeItem(atPath: path)
            try fileManager.createSymbolicLink(atPath: path, withDestinationPath: link.destination)
        }
    }

    /// The bundle's Info.plist: Wine's own keys plus the ones that make it a game.
    static func infoPlist(fitBelowNotch: Bool) -> [String: Any] {
        var plist: [String: Any] = [
            "CFBundleExecutable": "wine",
            "CFBundleIdentifier": bundleIdentifier,
            "CFBundleName": "Wine",
            "CFBundleDisplayName": "Windows Game",
            "CFBundlePackageType": "APPL",
            "CFBundleShortVersionString": "11.0",
            "CFBundleVersion": "11.0",
            "CFBundleInfoDictionaryVersion": "6.0",
            "NSPrincipalClass": "WineApplication",
            "LSUIElement": true,
            "NSHighResolutionCapable": true,
            "NSAppSleepDisabled": true,
            "LSApplicationCategoryType": "public.app-category.games",
            "LSSupportsGameMode": true,
            "GCSupportsGameMode": true
        ]
        if fitBelowNotch {
            plist["NSPrefersDisplaySafeAreaCompatibilityMode"] = true
        }
        return plist
    }

    /// Writes the Info.plist when it differs. Returns whether it changed.
    private static func writeInfoPlist(_ layout: Layout, fitBelowNotch: Bool) throws -> Bool {
        let data = try PropertyListSerialization.data(
            fromPropertyList: infoPlist(fitBelowNotch: fitBelowNotch), format: .xml, options: 0
        )
        if (try? Data(contentsOf: layout.infoPlist)) == data { return false }
        try data.write(to: layout.infoPlist, options: .atomic)
        return true
    }

    /// Tells LaunchServices about the bundle now, rather than when a game next starts.
    private static func register(_ bundle: URL) {
        let process = Process()
        process.executableURL = lsregister
        process.arguments = ["-f", bundle.path(percentEncoded: false)]
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        try? process.run()
        process.waitUntilExit()
    }
}
