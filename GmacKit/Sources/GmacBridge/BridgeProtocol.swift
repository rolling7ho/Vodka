//
//  BridgeProtocol.swift
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

struct AnyCodable: Codable, @unchecked Sendable {
    let value: Any?

    init(_ value: Any?) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            value = nil
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int64.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map(\.value)
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues(\.value)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unsupported JSON value"
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case nil:
            try container.encodeNil()
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let int64 as Int64:
            try container.encode(int64)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any?]:
            try container.encode(array.map(AnyCodable.init))
        case let dict as [String: Any?]:
            try container.encode(dict.mapValues(AnyCodable.init))
        default:
            try container.encodeNil()
        }
    }

    var dict: [String: AnyCodable]? {
        guard let raw = value as? [String: Any?] else { return nil }
        return raw.mapValues(AnyCodable.init)
    }

    var string: String? { value as? String }
    var bool: Bool? { value as? Bool }
    var int: Int? {
        if let intVal = value as? Int { return intVal }
        if let int64Val = value as? Int64 { return Int(int64Val) }
        return nil
    }

    var double: Double? {
        if let dbl = value as? Double { return dbl }
        if let int64Val = value as? Int64 { return Double(int64Val) }
        return nil
    }

    var stringArray: [String]? {
        guard let arr = value as? [Any?] else { return nil }
        return arr.compactMap { $0 as? String }
    }
}

struct BridgeRequest: Decodable {
    let id: UInt64
    let method: String
    let params: [String: AnyCodable]?
}

struct BridgeResponse<T: Encodable>: Encodable {
    let id: UInt64
    let ok: Bool
    let result: T?
    let error: String?
}

struct BridgeEvent<T: Encodable>: Encodable {
    let event: String
    let payload: T
}

struct EmptyResult: Encodable {}

struct RuntimeStatusDTO: Codable {
    let wineInstalled: Bool
    let wineVersion: String?
    let dxmtVersion: String?
    let dxvkVersion: String?
    let d3dMetalInstalled: Bool
    let gptkVersion: String?
    let gmacD3D12Available: Bool
    let rosettaInstalled: Bool
    let defaultBottleDir: String
    let logsDir: String
    let logsBytes: Int64
    let gptkStorePresent: Bool
    let migrationState: String
    let migrationReason: String?
    let runtimeTag: String
}

struct DLLOverrideDTO: Codable {
    let dllName: String
    let mode: String
}

struct BottleSettingsDTO: Codable {
    var name: String
    var windowsVersion: String
    var enhancedSync: String
    var avxEnabled: Bool
    var graphicsBackend: String
    var metalFX: Bool
    var frameGeneration: Bool
    var metalHud: Bool
    var metalTrace: Bool
    var metalValidation: Bool
    var dxrEnabled: Bool
    var sequoiaCompatMode: Bool
    var metal4Enabled: Bool
    var dxvkAsync: Bool
    var dxvkHud: String
    var nativeResolution: Bool
    var virtualDesktopEnabled: Bool
    var resolutionPreset: String
    var customResolutionWidth: Int
    var customResolutionHeight: Int
    var fasterSteamApps: [Int]
    var shaderCacheEnabled: Bool
    var disableAppNap: Bool
    var audioDriver: String
    var audioLatencyPreset: String
    var outputDeviceMode: String
    var pinnedDeviceName: String?
    var controllerCompatibilityMode: Bool
    var disableHIDAPI: Bool
    var allowBackgroundEvents: Bool
    var disableControllerMapping: Bool
    var useButtonLabels: Bool
    var commandActsAsControl: Bool
    var launcherCompatibilityMode: Bool
    var launcherMode: String
    var detectedLauncher: String?
    var launcherLocale: String
    var gpuSpoofing: Bool
    var gpuVendor: String
    var networkTimeout: Int
    var autoEnableDXVK: Bool
    var discordPresence: Bool
    var discordBridge: Bool
    var clipboardPolicy: String
    var killOnQuit: String
    var closeWithProcessesPolicy: String
    var customDLLOverrides: [DLLOverrideDTO]
}

struct BottleDTO: Codable {
    let url: String
    let name: String
    let isAvailable: Bool
    let inFlight: Bool
    let steamInstalled: Bool
    let steamRunning: Bool
    let runningProcessCount: Int
    let pinnedCount: Int
    let gameCount: Int
    let resolvedBackend: String
    let settings: BottleSettingsDTO
}

struct SteamPanelDTO: Codable {
    let bottleUrl: String
    let bottleName: String?
    let iconPath: String?
    let isRunning: Bool
    let gameCount: Int
    let sizeOnDisk: Int64
}

struct LibraryItemDTO: Codable {
    let id: String
    let name: String
    let bottleUrl: String
    let bottleName: String?
    let source: String
    let launchKind: String
    let appId: Int?
    let programPath: String?
    let isLauncher: Bool
    let artworkPath: String?
    let iconPath: String?
    let lastPlayedEpoch: Double?
    let sizeOnDisk: Int64?
    let installPath: String?
    let state: String
    let fasterMode: Bool
    let compatibilityWarning: String?
    let compatibilityDetail: String?
}

struct LibraryPayloadDTO: Codable {
    let steamPanels: [SteamPanelDTO]
    let games: [LibraryItemDTO]
    let otherApps: [LibraryItemDTO]
}

struct ProgramOverridesDTO: Codable {
    var graphicsBackend: String?
    var dxvkAsync: Bool?
    var dxvkHud: String?
    var enhancedSync: String?
    var metal4Enabled: Bool?
    var shaderCacheEnabled: Bool?
    var virtualDesktopEnabled: Bool?
    var controllerCompatibilityMode: Bool?
}

struct ProgramDTO: Codable {
    let name: String
    let url: String
    let pinned: Bool
    let iconPath: String?
    let arguments: String
    let locale: String
    let environment: [String: String]
    let overrides: ProgramOverridesDTO
}

struct ProcessDTO: Codable {
    let pid: Int32
    let name: String
    let memoryUsage: String
    let kind: String
    let bottleUrl: String
    let bottleName: String
}

struct GameStatDTO: Codable {
    let id: String
    let name: String
    let bottleName: String?
    let artworkPath: String?
    let iconPath: String?
    let totalSec: Double
    let lastTwoWeeksSec: Double
    let lastPlayedEpoch: Double?
    let sessions: Int?
    let longestSessionSec: Double?
    let sizeOnDisk: Int64?
}

struct StatisticsPayloadDTO: Codable {
    let totalPlaytimeSec: Double
    let lastTwoWeeksSec: Double
    let storageBytes: Int64
    let mostPlayedName: String?
    let mostPlayedSec: Double?
    let lastPlayedName: String?
    let longestSessionName: String?
    let longestSessionSec: Double?
    let playedCount: Int
    let totalGamesCount: Int
    let games: [GameStatDTO]
    let unplayedNames: [String]
}

struct GameDBItemDTO: Codable {
    let id: String
    let name: String
    let subtitle: String?
    let steamAppId: Int?
    let rating: String
    let notes: [String]
    let antiCheat: String?
    let defaultVariantId: String?
    let defaultVariantLabel: String?
    let matchedBottleUrl: String?
    let installed: Bool
    let appliedHere: Bool
    let appliedSnapshotTimestamp: Double?
}

struct LogFileDTO: Codable {
    let name: String
    let path: String
    let modifiedEpoch: Double
    let sizeBytes: Int64
}

struct CrashDiagnosisDTO: Codable {
    let headline: String?
    let primaryCategory: String?
    let primaryConfidence: String?
    let matchCount: Int
    let remediations: [RemediationDTO]
}

struct RemediationDTO: Codable {
    let id: String
    let title: String
    let description: String
    let whatWillChange: String
    let undoPath: String
    let risk: String
}

struct AppPrefsDTO: Codable {
    var openSteamAtLaunch: Bool
    var gameModeEnabled: Bool
    var fitGamesBelowNotch: Bool
    var skipQuitConfirmation: Bool
    var defaultWinVersion: String
    var defaultBottleLocation: String
    var logRetentionDays: Int
    var checkGmacWineUpdates: Bool
    var preferredTerminal: String
    var themeMode: String
}

struct OrphanedBottleDTO: Codable {
    let url: String
    let name: String
}

struct LegacyBottleDTO: Codable {
    let url: String
    let name: String
}

struct SteamSetupStatusDTO: Codable {
    let wineInstalled: Bool
    let bottleUrl: String?
    let bottleName: String?
    let bottleInFlight: Bool
    let graphicsBackend: String?
    let graphicsChosen: Bool
    let d3dMetalInstalled: Bool
    let steamInstalled: Bool
    let installedGameCount: Int
}

struct AudioStatusDTO: Codable {
    let defaultDeviceName: String?
    let transportType: String?
    let sampleRateHz: Double?
    let outputChannels: Int?
    let status: String
    let summary: String
    let findings: [String]
}

struct RuntimeUpdateCheckDTO: Codable {
    let updateAvailable: Bool
    let currentVersion: String?
    let latestVersion: String
}

struct RuntimeProgressEvent: Codable {
    let phase: String
    let progress: Double
    let detail: String
}

struct StateChangedEvent: Codable {
    let reason: String
}
