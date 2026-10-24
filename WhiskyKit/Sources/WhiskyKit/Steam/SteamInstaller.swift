//
//  SteamInstaller.swift
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

/// Errors from setting up the Windows Steam client in a bottle.
public enum SteamInstallError: LocalizedError {
    case downloadFailed(String)
    case installerFailed(Int32)
    case clientMissingAfterInstall

    public var errorDescription: String? {
        switch self {
        case let .downloadFailed(reason):
            "Couldn't download Steam from Valve: \(reason). Check your internet connection and try again."
        case let .installerFailed(code):
            "The Steam installer stopped with code \(code). Try again; if it keeps failing, restart your Mac."
        case .clientMissingAfterInstall:
            "The Steam installer finished, but Steam wasn't found in the bottle. Try installing again."
        }
    }
}

/// Downloads Valve's Windows Steam installer and runs it in a bottle.
///
/// The installer is fetched from Valve at install time, never bundled, and run
/// silently (`/S`), so the only Steam window anyone sees is the client's own sign-in.
public enum SteamInstaller {
    /// Valve's official Windows installer.
    public static let installerURL = URL(string: "https://cdn.akamai.steamstatic.com/client/installer/SteamSetup.exe")!

    /// The bottle that holds a Steam install, if any does.
    @MainActor
    public static func steamBottle(in bottles: [Bottle]) -> Bottle? {
        bottles.first { SteamLibrary.detectInstall(bottleURL: $0.url) != nil }
    }

    /// Whether Steam is installed in `bottle`.
    public static func isInstalled(in bottle: Bottle) -> Bool {
        SteamLibrary.detectInstall(bottleURL: bottle.url) != nil
    }

    /// Downloads the installer into the bottle and runs it silently.
    ///
    /// - Throws: ``SteamInstallError`` when the download, the installer or the result fails.
    @MainActor
    public static func install(in bottle: Bottle) async throws {
        // The bottle's recommended Steam settings, the ones running Steam by
        // hand would get on first detection, in place before anything runs.
        LauncherFixes.apply(to: bottle, launcher: .steam)
        let downloads = bottle.url.appending(path: "drive_c").appending(path: "users")
            .appending(path: "Public").appending(path: "Downloads")
        try FileManager.default.createDirectory(at: downloads, withIntermediateDirectories: true)
        let setup = downloads.appending(path: "SteamSetup.exe")

        do {
            let (temporary, response) = try await URLSession.shared.download(from: installerURL)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                throw SteamInstallError.downloadFailed("the server didn't send the installer")
            }
            try? FileManager.default.removeItem(at: setup)
            try FileManager.default.moveItem(at: temporary, to: setup)
        } catch let error as SteamInstallError {
            throw error
        } catch {
            throw SteamInstallError.downloadFailed(error.localizedDescription)
        }

        let result = try await Wine.runProgram(at: setup, args: ["/S"], bottle: bottle)
        // `start /unix` hands the installer off and can return before it ends;
        // wait for the client to land, up to a few minutes.
        for _ in 0 ..< 180 where !isInstalled(in: bottle) {
            try await Task.sleep(for: .seconds(1))
        }
        guard isInstalled(in: bottle) else {
            if result.exitCode != 0 { throw SteamInstallError.installerFailed(result.exitCode) }
            throw SteamInstallError.clientMissingAfterInstall
        }
    }

    /// Opens the Steam client in `bottle`. Runs for the whole session, so it is not awaited.
    @MainActor
    public static func open(in bottle: Bottle) {
        guard let root = SteamLibrary.detectInstall(bottleURL: bottle.url) else { return }
        let steamExe = root.appending(path: "steam.exe")
        LauncherFixes.apply(to: bottle, launcher: .steam)
        // Not `-silent` like a game launch's client start: this is someone opening Steam.
        let overrides = Program.persistedOverrides(for: steamExe, bottleURL: bottle.url)
        Task {
            _ = try? await Wine.runProgram(at: steamExe, bottle: bottle, programOverrides: overrides)
        }
    }
}
