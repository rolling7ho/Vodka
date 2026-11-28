//
//  BridgeHandlers+Settings.swift
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

extension BridgeRouter {
    private static var bridgeLogsFolder: URL {
        FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0]
            .appending(path: "Logs")
            .appending(path: Bundle.gmacBundleIdentifier)
    }

    func getAppSettings() -> JSONValue {
        encodeAppSettings()
    }

    func updateAppSettings(params: [String: JSONValue]) -> JSONValue {
        let defaults = UserDefaults.standard
        applyGeneralDefaultsPatch(params: params, defaults: defaults)
        applyGamingAndUpdateDefaultsPatch(params: params, defaults: defaults)
        return encodeAppSettings()
    }

    private func applyGeneralDefaultsPatch(params: [String: JSONValue], defaults: UserDefaults) {
        if let askQuit = params["askBeforeQuitting"]?.boolValue {
            defaults.set(!askQuit, forKey: "skipQuitConfirmation")
        }
        if let menuBar = params["showMenuBarExtra"]?.boolValue {
            defaults.set(menuBar, forKey: "showMenuBarExtra")
        }
        if let terminal = params["preferredTerminal"]?.stringValue {
            defaults.set(terminal, forKey: "preferredTerminal")
        }
        if let winPretty = params["defaultWinVersion"]?.stringValue,
           let parsedWin = Self.parseWinVersion(winPretty) {
            defaults.set(parsedWin.rawValue, forKey: "defaultWinVersion")
        }
        if let pcsLocation = params["defaultPcsLocation"]?.stringValue, !pcsLocation.isEmpty {
            defaults.set(URL(filePath: pcsLocation), forKey: "defaultBottleLocation")
        }
    }

    private func applyGamingAndUpdateDefaultsPatch(params: [String: JSONValue], defaults: UserDefaults) {
        if let steamAtLaunch = params["openSteamAtLaunch"]?.boolValue {
            defaults.set(steamAtLaunch, forKey: "openSteamAtLaunch")
        }
        if let gameMode = params["gameModeEnabled"]?.boolValue {
            defaults.set(gameMode, forKey: WineGameMode.enabledDefaultsKey)
            WineGameMode.apply()
        }
        if let fitNotch = params["fitBelowNotch"]?.boolValue {
            defaults.set(fitNotch, forKey: WineGameMode.fitBelowNotchDefaultsKey)
            WineGameMode.apply()
        }
        if let backend = params["defaultGraphicsBackend"]?.stringValue {
            defaults.set(backend, forKey: "defaultGraphicsBackend")
        }
        if let retention = params["logRetentionDays"]?.intValue {
            defaults.set(retention, forKey: "logRetentionDays")
        }
        if let autoApp = params["autoCheckAppUpdates"]?.boolValue {
            defaults.set(autoApp, forKey: "SUEnableAutomaticChecks")
        }
        if let autoEngine = params["autoCheckEngineUpdates"]?.boolValue {
            defaults.set(autoEngine, forKey: "checkGmacWineUpdates")
        }
    }

    @MainActor
    func clearShaderCaches() -> JSONValue {
        var bottlesList = BottleData()
        for bottle in bottlesList.loadBottles() where bottle.isAvailable {
            Wine.killBottle(bottle: bottle)
        }

        let getconf = Process()
        getconf.executableURL = URL(fileURLWithPath: "/usr/bin/getconf")
        getconf.arguments = ["DARWIN_USER_CACHE_DIR"]
        let pipe = Pipe()
        getconf.standardOutput = pipe

        if (try? getconf.run()) != nil {
            getconf.waitUntilExit()
            if let data = try? pipe.fileHandleForReading.readToEnd(),
               let rawDir = String(data: data, encoding: .utf8)?
               .trimmingCharacters(in: .whitespacesAndNewlines),
               !rawDir.isEmpty {
                let d3dmPath = URL(fileURLWithPath: rawDir).appending(path: "d3dm")
                if FileManager.default.fileExists(atPath: d3dmPath.path(percentEncoded: false)) {
                    try? FileManager.default.removeItem(at: d3dmPath)
                }
            }
        }

        return .object(["cleared": .bool(true)])
    }

    private func encodeAppSettings() -> JSONValue {
        let defaults = UserDefaults.standard
        let askBeforeQuitting = !defaults.bool(forKey: "skipQuitConfirmation")
        let showMenuBarExtra = defaults.bool(forKey: "showMenuBarExtra")
        let preferredTerminal = defaults.string(forKey: "preferredTerminal") ?? "terminal"
        let winRaw = defaults.string(forKey: "defaultWinVersion") ?? WinVersion.win10.rawValue
        let defaultWinVersion = (WinVersion(rawValue: winRaw) ?? .win10).pretty()
        let defaultPcsLocation = (
            defaults.url(forKey: "defaultBottleLocation") ?? BottleData.defaultBottleDir
        ).path(percentEncoded: false)
        let openSteamAtLaunch = defaults.bool(forKey: "openSteamAtLaunch")
        let gameModeEnabled = defaults.object(forKey: WineGameMode.enabledDefaultsKey) as? Bool ?? true
        let fitBelowNotch = defaults.bool(forKey: WineGameMode.fitBelowNotchDefaultsKey)
        let defaultGraphicsBackend = defaults.string(forKey: "defaultGraphicsBackend") ?? "recommended"
        let logRetentionDays = defaults.object(forKey: "logRetentionDays") as? Int ?? 7
        let autoCheckAppUpdates = defaults.bool(forKey: "SUEnableAutomaticChecks")
        let autoCheckEngineUpdates = defaults.object(forKey: "checkGmacWineUpdates") as? Bool ?? true

        return .object([
            "askBeforeQuitting": .bool(askBeforeQuitting),
            "showMenuBarExtra": .bool(showMenuBarExtra),
            "preferredTerminal": .string(preferredTerminal),
            "defaultWinVersion": .string(defaultWinVersion),
            "defaultPcsLocation": .string(defaultPcsLocation),
            "logsFolder": .string(Self.bridgeLogsFolder.path(percentEncoded: false)),
            "openSteamAtLaunch": .bool(openSteamAtLaunch),
            "gameModeEnabled": .bool(gameModeEnabled),
            "fitBelowNotch": .bool(fitBelowNotch),
            "defaultGraphicsBackend": .string(defaultGraphicsBackend),
            "logRetentionDays": .int(logRetentionDays),
            "autoCheckAppUpdates": .bool(autoCheckAppUpdates),
            "autoCheckEngineUpdates": .bool(autoCheckEngineUpdates)
        ])
    }
}
