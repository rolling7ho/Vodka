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
    static var bridgeLogsFolder: URL {
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

    func pruneLogs() -> JSONValue {
        let defaults = UserDefaults.standard
        let retentionDays = defaults.object(forKey: "logRetentionDays") as? Int ?? 7
        guard retentionDays > 0 else {
            return .object(["deletedCount": .int(0)])
        }

        let cutoffDate = Date.now.addingTimeInterval(-TimeInterval(retentionDays) * 86_400)
        let folder = Self.bridgeLogsFolder
        let items = (try? FileManager.default.contentsOfDirectory(
            at: folder,
            includingPropertiesForKeys: [.contentModificationDateKey, .isRegularFileKey]
        )) ?? []

        var deletedCount = 0
        for item in items {
            let values = try? item.resourceValues(forKeys: [.contentModificationDateKey, .isRegularFileKey])
            if values?.isRegularFile == true, let modified = values?.contentModificationDate, modified < cutoffDate {
                if (try? FileManager.default.removeItem(at: item)) != nil {
                    deletedCount += 1
                }
            }
        }
        return .object(["deletedCount": .int(deletedCount)])
    }

    func checkUpdates(params: [String: JSONValue]) async -> JSONValue {
        let currentAppVersion = params["currentAppVersion"]?.stringValue ?? "0.1.0"
        let (engineNeedsUpdate, latestEngineSemver) = await GmacWineInstaller.shouldUpdateGmacWine()
        let currentEngineVersion = GmacWineInstaller.gmacWineVersion()?.description
        let latestEngineVersion = latestEngineSemver.description

        let feedURL = URL(string: "https://rolling7ho.github.io/gmac/appcast.xml")
        var latestAppVersion: String?
        var appReleaseTitle: String?
        var appReleaseURL: String?

        if let feedURL,
           let (data, _) = try? await URLSession.shared.data(from: feedURL),
           let xml = String(data: data, encoding: .utf8) {
            let parsed = Self.parseAppcastFirstItem(xml: xml)
            latestAppVersion = parsed.version
            appReleaseTitle = parsed.title
            appReleaseURL = parsed.url
        }

        let appUpdateAvailable = latestAppVersion.map {
            Self.isVersion($0, newerThan: currentAppVersion)
        } ?? false

        return .object([
            "appUpdateAvailable": .bool(appUpdateAvailable),
            "currentAppVersion": .string(currentAppVersion),
            "latestAppVersion": latestAppVersion.map { .string($0) } ?? .null,
            "appReleaseTitle": appReleaseTitle.map { .string($0) } ?? .null,
            "appReleaseUrl": appReleaseURL.map { .string($0) } ?? .null,
            "engineUpdateAvailable": .bool(engineNeedsUpdate),
            "currentEngineVersion": currentEngineVersion.map { .string($0) } ?? .null,
            "latestEngineVersion": .string(latestEngineVersion)
        ])
    }

    @MainActor
    func runningBottlesSummary() async -> JSONValue {
        var bottlesList = BottleData()
        let bottles = bottlesList.loadBottles().filter(\.isAvailable)
        var runningNames: [String] = []
        for bottle in bottles where await Wine.isWineserverRunning(for: bottle) {
            runningNames.append(bottle.settings.name)
        }
        return .object([
            "runningCount": .int(runningNames.count),
            "runningBottles": .array(runningNames.map { .string($0) })
        ])
    }

    @MainActor
    func killAllBottles() -> JSONValue {
        var bottlesList = BottleData()
        let bottles = bottlesList.loadBottles().filter(\.isAvailable)
        var stoppedCount = 0
        for bottle in bottles {
            Wine.killBottle(bottle: bottle)
            stoppedCount += 1
        }
        return .object(["stoppedCount": .int(stoppedCount)])
    }

    private struct AppcastFeedItem {
        let version: String?
        let title: String?
        let url: String?
    }

    private static func parseAppcastFirstItem(xml: String) -> AppcastFeedItem {
        guard let itemStart = xml.range(of: "<item>"),
              let itemEnd = xml.range(of: "</item>", range: itemStart.upperBound..<xml.endIndex)
        else {
            return AppcastFeedItem(version: nil, title: nil, url: nil)
        }
        let itemSlice = String(xml[itemStart.upperBound..<itemEnd.lowerBound])
        let version = extractXMLTag("sparkle:shortVersionString", in: itemSlice)
        let title = extractXMLTag("title", in: itemSlice)
        let url = extractEnclosureURL(in: itemSlice)
        return AppcastFeedItem(version: version, title: title, url: url)
    }

    private static func extractXMLTag(_ tag: String, in content: String) -> String? {
        guard let open = content.range(of: "<\(tag)>"),
              let close = content.range(of: "</\(tag)>", range: open.upperBound..<content.endIndex)
        else {
            return nil
        }
        return String(content[open.upperBound..<close.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func extractEnclosureURL(in content: String) -> String? {
        guard let encRange = content.range(of: "<enclosure"),
              let urlKey = content.range(of: "url=\"", range: encRange.upperBound..<content.endIndex),
              let urlEnd = content.range(of: "\"", range: urlKey.upperBound..<content.endIndex)
        else {
            return nil
        }
        return String(content[urlKey.upperBound..<urlEnd.lowerBound])
    }

    private static func isVersion(_ candidate: String, newerThan current: String) -> Bool {
        let lhs = candidate.split(separator: ".").compactMap { Int($0) }
        let rhs = current.split(separator: ".").compactMap { Int($0) }
        let count = max(lhs.count, rhs.count)
        for index in 0..<count {
            let left = index < lhs.count ? lhs[index] : 0
            let right = index < rhs.count ? rhs[index] : 0
            if left != right {
                return left > right
            }
        }
        return false
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
