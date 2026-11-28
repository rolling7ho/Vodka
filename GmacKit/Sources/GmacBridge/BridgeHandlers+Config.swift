//
//  BridgeHandlers+Config.swift
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
    @MainActor
    func getBottleConfig(params: [String: JSONValue]) throws -> JSONValue {
        let bottle = try resolveBottleForConfig(path: params["path"]?.stringValue)
        return Self.encodeBottleConfig(bottle)
    }

    @MainActor
    func updateBottleConfig(params: [String: JSONValue]) async throws -> JSONValue {
        let bottle = try resolveBottleForConfig(path: params["path"]?.stringValue)
        let previousWinVersion = bottle.settings.windowsVersion
        let previousAudio = (
            bottle.settings.audioDriver,
            bottle.settings.audioLatencyPreset,
            bottle.settings.outputDeviceMode,
            bottle.settings.pinnedDeviceName
        )

        applyBottleConfigPatch(params: params, to: &bottle.settings)
        applyExtendedBottleConfigPatch(params: params, to: &bottle.settings)

        if bottle.settings.windowsVersion != previousWinVersion {
            _ = try? await Wine.changeWinVersion(bottle: bottle, win: bottle.settings.windowsVersion)
        }
        if let requestedDPI = params["dpi"]?.intValue {
            let clampedDPI = min(480, max(72, requestedDPI))
            _ = try? await Wine.changeDpiResolution(bottle: bottle, dpi: clampedDPI)
        }
        let currentAudio = (
            bottle.settings.audioDriver,
            bottle.settings.audioLatencyPreset,
            bottle.settings.outputDeviceMode,
            bottle.settings.pinnedDeviceName
        )
        bottle.saveBottleSettings()
        if currentAudio != previousAudio {
            await Wine.syncAudioRegistry(bottle: bottle)
        }
        return Self.encodeBottleConfig(bottle)
    }

    @MainActor
    func getGameSettings(params: [String: JSONValue]) throws -> JSONValue {
        let program = try resolveGameProgram(params: params)
        return Self.encodeGameSettings(program.settings)
    }

    @MainActor
    func updateGameSettings(params: [String: JSONValue]) throws -> JSONValue {
        let program = try resolveGameProgram(params: params)
        if params["reset"]?.boolValue == true {
            program.settings = ProgramSettings()
            return Self.encodeGameSettings(program.settings)
        }

        var updated = program.settings
        applyGameSettingsPatch(params: params, to: &updated)
        program.settings = updated
        return Self.encodeGameSettings(program.settings)
    }

    @MainActor
    func resolveBottleForConfig(path rawPath: String?) throws -> Bottle {
        guard let rawPath, !rawPath.isEmpty else {
            throw BridgeError.invalidParams("Missing PC path.")
        }
        let targetCanonical = Self.canonicalBottlePath(URL(filePath: rawPath))
        var bottlesList = BottleData()
        let bottles = bottlesList.loadBottles()
        guard let bottle = bottles.first(where: { Self.canonicalBottlePath($0.url) == targetCanonical })
        else {
            throw BridgeError.operationFailed("PC not found.")
        }
        return bottle
    }

    @MainActor
    private func resolveGameProgram(params: [String: JSONValue]) throws -> Program {
        let bottle = try resolveBottleForConfig(path: params["bottlePath"]?.stringValue)
        let launchKind = params["launchKind"]?.stringValue ?? "program"

        if launchKind == "program" {
            guard let programPath = params["programPath"]?.stringValue, !programPath.isEmpty
            else {
                throw BridgeError.invalidParams("Missing executable path.")
            }
            return Program(url: URL(filePath: programPath), bottle: bottle)
        }

        if launchKind == "steam", let appID = params["steamAppId"]?.intValue {
            let steamGame = SteamLibrary.enumerate(bottleURL: bottle.url).first { $0.appId == appID }
            if let installURL = steamGame?.installURL,
               let exeURL = SteamLibrary.executableURLs(under: installURL).first {
                return Program(url: exeURL, bottle: bottle)
            }
            if let steamRoot = SteamLibrary.detectInstall(bottleURL: bottle.url) {
                return Program(url: steamRoot.appending(path: "steam.exe"), bottle: bottle)
            }
        }

        throw BridgeError.operationFailed("Unable to locate game executable in PC.")
    }

    private func applyBottleConfigPatch(params: [String: JSONValue], to settings: inout BottleSettings) {
        applyBottleWineAndGraphicsPatch(params: params, to: &settings)
        applyBottleDisplayAndInputPatch(params: params, to: &settings)
    }

    private func applyBottleWineAndGraphicsPatch(
        params: [String: JSONValue],
        to settings: inout BottleSettings
    ) {
        if let winLabel = params["windowsVersion"]?.stringValue,
           let parsedWin = Self.parseWinVersion(winLabel) {
            settings.windowsVersion = parsedWin
        }
        if let syncStr = params["enhancedSync"]?.stringValue {
            settings.enhancedSync = Self.parseEnhancedSync(syncStr)
        }
        if let avx = params["avxEnabled"]?.boolValue {
            settings.avxEnabled = avx
        }
        if let backendStr = params["graphicsBackend"]?.stringValue,
           let backend = GraphicsBackend(rawValue: backendStr) {
            settings.graphicsBackend = backend
        }
        if let metalHud = params["metalHud"]?.boolValue {
            settings.metalHud = metalHud
        }
        if let dxr = params["dxrEnabled"]?.boolValue {
            settings.dxrEnabled = dxr
        }
        if let cache = params["shaderCacheEnabled"]?.boolValue {
            settings.shaderCacheEnabled = cache
        }
    }

    private func applyBottleDisplayAndInputPatch(
        params: [String: JSONValue],
        to settings: inout BottleSettings
    ) {
        if let retina = params["retinaMode"]?.boolValue {
            settings.nativeResolution = retina
        }
        if let virtualDesktop = params["virtualDesktop"]?.boolValue {
            settings.virtualDesktopEnabled = virtualDesktop
        }
        if let resStr = params["virtualDesktopResolution"]?.stringValue {
            settings.resolutionPreset = Self.parseResolutionPreset(resStr)
        }
        if let compat = params["controllerCompatMode"]?.boolValue {
            settings.controllerCompatibilityMode = compat
        }
    }

    private func applyGameSettingsPatch(params: [String: JSONValue], to settings: inout ProgramSettings) {
        var overrides = settings.overrides ?? ProgramOverrides()
        applyGameGraphicsPatch(params: params, settings: &settings, overrides: &overrides)
        applyGameLaunchAndInputPatch(params: params, settings: &settings, overrides: &overrides)
        settings.overrides = overrides.isEmpty ? nil : overrides
    }

    private func applyGameGraphicsPatch(
        params: [String: JSONValue],
        settings: inout ProgramSettings,
        overrides: inout ProgramOverrides
    ) {
        if let backendStr = params["graphicsBackend"]?.stringValue {
            overrides.graphicsBackend = backendStr == "inherit" ? nil : GraphicsBackend(rawValue: backendStr)
        }
        if let metal4 = params["metal4Enabled"]?.boolValue {
            overrides.metal4Enabled = metal4
        }
        if let shaderCache = params["shaderCacheEnabled"]?.boolValue {
            overrides.shaderCacheEnabled = shaderCache
        }
        if let metalHud = params["metalHud"]?.boolValue {
            settings.environment["MTL_HUD_ENABLED"] = metalHud ? "1" : nil
        }
    }

    private func applyGameLaunchAndInputPatch(
        params: [String: JSONValue],
        settings: inout ProgramSettings,
        overrides: inout ProgramOverrides
    ) {
        if let args = params["launchArguments"]?.stringValue {
            settings.arguments = args
        }
        if let localeStr = params["locale"]?.stringValue {
            settings.locale = Self.parseLocale(localeStr)
        }
        if let syncStr = params["enhancedSync"]?.stringValue {
            overrides.enhancedSync = syncStr == "inherit" ? nil : Self.parseEnhancedSync(syncStr)
        }
        if let virtualDesktop = params["virtualDesktop"]?.boolValue {
            overrides.virtualDesktopEnabled = virtualDesktop
        }
        if let resStr = params["virtualDesktopResolution"]?.stringValue {
            overrides.resolutionPreset = Self.parseResolutionPreset(resStr)
        }
        if let compat = params["controllerCompatMode"]?.boolValue {
            overrides.controllerCompatibilityMode = compat
        }
    }

    static func encodeBottleSettingsDictionary(_ settings: BottleSettings) -> [String: JSONValue] {
        [
            "windowsVersion": .string(settings.windowsVersion.pretty()),
            "enhancedSync": .string(encodeEnhancedSync(settings.enhancedSync)),
            "avxEnabled": .bool(settings.avxEnabled),
            "graphicsBackend": .string(settings.graphicsBackend.rawValue),
            "metalHud": .bool(settings.metalHud),
            "dxrEnabled": .bool(settings.dxrEnabled),
            "shaderCacheEnabled": .bool(settings.shaderCacheEnabled),
            "retinaMode": .bool(settings.nativeResolution),
            "virtualDesktop": .bool(settings.virtualDesktopEnabled),
            "virtualDesktopResolution": .string(encodeResolutionPreset(settings.resolutionPreset)),
            "controllerCompatMode": .bool(settings.controllerCompatibilityMode),
            "dxvk": .bool(settings.dxvk),
            "dxvkAsync": .bool(settings.dxvkAsync),
            "dxvkHud": .string(encodeDXVKHud(settings.dxvkHud)),
            "dllOverrides": .array(encodeDLLOverrides(settings.dllOverrides)),
            "audioDriver": .string(settings.audioDriver.rawValue),
            "audioLatencyPreset": .string(settings.audioLatencyPreset.rawValue),
            "outputDeviceMode": .string(settings.outputDeviceMode.rawValue),
            "pinnedDeviceName": settings.pinnedDeviceName.map { .string($0) } ?? .null
        ]
    }

    private static func encodeGameSettings(_ settings: ProgramSettings) -> JSONValue {
        let overrides = settings.overrides
        return .object([
            "graphicsBackend": .string(overrides?.graphicsBackend?.rawValue ?? "inherit"),
            "metal4Enabled": .bool(overrides?.metal4Enabled ?? true),
            "shaderCacheEnabled": .bool(overrides?.shaderCacheEnabled ?? true),
            "metalHud": .bool(settings.environment["MTL_HUD_ENABLED"] == "1"),
            "launchArguments": .string(settings.arguments),
            "locale": .string(encodeLocale(settings.locale)),
            "enhancedSync": .string(overrides?.enhancedSync.map(encodeEnhancedSync) ?? "inherit"),
            "virtualDesktop": .bool(overrides?.virtualDesktopEnabled ?? false),
            "virtualDesktopResolution": .string(
                encodeResolutionPreset(overrides?.resolutionPreset ?? .r1920x1080)
            ),
            "controllerCompatMode": .bool(overrides?.controllerCompatibilityMode ?? false)
        ])
    }

    static func parseWinVersion(_ value: String) -> WinVersion? {
        switch value {
        case "Windows 11", "win11":
            .win11
        case "Windows 10", "win10":
            .win10
        case "Windows 8.1", "win81":
            .win81
        case "Windows 8", "win8":
            .win8
        case "Windows 7", "win7":
            .win7
        case "Windows XP", "winxp64":
            .winXP
        default:
            nil
        }
    }

    private static func parseEnhancedSync(_ value: String) -> EnhancedSync {
        switch value {
        case "esync":
            .esync
        case "off", "none":
            .none
        default:
            .msync
        }
    }

    private static func encodeEnhancedSync(_ value: EnhancedSync) -> String {
        switch value {
        case .esync:
            "esync"
        case .none:
            "off"
        case .msync:
            "msync"
        }
    }

    private static func parseResolutionPreset(_ value: String) -> ResolutionPreset {
        switch value {
        case "2560x1440":
            .r2560x1440
        case "3840x2160":
            .r3840x2160
        default:
            .r1920x1080
        }
    }

    private static func encodeResolutionPreset(_ value: ResolutionPreset) -> String {
        switch value {
        case .r2560x1440:
            "2560x1440"
        case .r3840x2160:
            "3840x2160"
        default:
            "1920x1080"
        }
    }

    private static func parseLocale(_ value: String) -> Locales {
        if let direct = Locales(rawValue: value) {
            return direct
        }
        return Locales(rawValue: "\(value).UTF-8") ?? .auto
    }

    private static func encodeLocale(_ locale: Locales) -> String {
        if locale == .auto {
            return "auto"
        }
        return locale.rawValue.replacingOccurrences(of: ".UTF-8", with: "")
    }
}
