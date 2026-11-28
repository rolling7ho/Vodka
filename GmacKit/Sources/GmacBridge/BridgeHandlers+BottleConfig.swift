//
//  BridgeHandlers+BottleConfig.swift
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
    static func encodeBottleConfig(_ bottle: Bottle) -> JSONValue {
        var dict = encodeBottleSettingsDictionary(bottle.settings)
        dict["dpi"] = .int(readBottleDpiFromRegistryFile(bottleURL: bottle.url))
        return .object(dict)
    }

    func applyExtendedBottleConfigPatch(params: [String: JSONValue], to settings: inout BottleSettings) {
        if let dxvk = params["dxvk"]?.boolValue {
            settings.dxvk = dxvk
        }
        if let dxvkAsync = params["dxvkAsync"]?.boolValue {
            settings.dxvkAsync = dxvkAsync
        }
        if let hudStr = params["dxvkHud"]?.stringValue {
            settings.dxvkHud = Self.parseDXVKHud(hudStr)
        }
        if let rawOverrides = params["dllOverrides"]?.arrayValue {
            settings.dllOverrides = rawOverrides.compactMap(Self.parseDLLOverride)
        }
        if let driverStr = params["audioDriver"]?.stringValue,
           let driver = AudioDriverMode(rawValue: driverStr) {
            settings.audioDriver = driver
        }
        if let latencyStr = params["audioLatencyPreset"]?.stringValue,
           let preset = AudioLatencyPreset(rawValue: latencyStr) {
            settings.audioLatencyPreset = preset
        }
        if let outputModeStr = params["outputDeviceMode"]?.stringValue,
           let outputMode = OutputDeviceMode(rawValue: outputModeStr) {
            settings.outputDeviceMode = outputMode
        }
        if let pinnedDevice = params["pinnedDeviceName"]?.stringValue {
            settings.pinnedDeviceName = pinnedDevice.isEmpty ? nil : pinnedDevice
        } else if case .null? = params["pinnedDeviceName"] {
            settings.pinnedDeviceName = nil
        }
    }

    static func parseDXVKHud(_ value: String) -> DXVKHUD {
        switch value {
        case "full":
            .full
        case "partial":
            .partial
        case "fps":
            .fps
        default:
            .off
        }
    }

    static func encodeDXVKHud(_ value: DXVKHUD) -> String {
        switch value {
        case .full:
            "full"
        case .partial:
            "partial"
        case .fps:
            "fps"
        case .off:
            "off"
        }
    }

    static func encodeDLLOverrides(_ entries: [DLLOverrideEntry]) -> [JSONValue] {
        entries.map { entry in
            .object([
                "dllName": .string(entry.dllName),
                "mode": .string(entry.mode.rawValue)
            ])
        }
    }

    private static func parseDLLOverride(_ item: JSONValue) -> DLLOverrideEntry? {
        guard let obj = item.objectValue,
              let name = obj["dllName"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines),
              !name.isEmpty,
              let modeRaw = obj["mode"]?.stringValue,
              let mode = DLLOverrideMode(rawValue: modeRaw)
        else {
            return nil
        }
        return DLLOverrideEntry(dllName: name, mode: mode)
    }

    static func readBottleDpiFromRegistryFile(bottleURL: URL) -> Int {
        let userRegURL = bottleURL.appending(path: "user.reg")
        guard let text = try? String(contentsOf: userRegURL, encoding: .utf8) else {
            return 96
        }
        var inDesktopSection = false
        for rawLine in text.components(separatedBy: "\n") {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            if line.hasPrefix("[") {
                inDesktopSection = line.lowercased().hasPrefix("[control panel\\\\desktop]")
                continue
            }
            if inDesktopSection, line.hasPrefix("\"LogPixels\"=dword:") {
                let hex = line.replacingOccurrences(of: "\"LogPixels\"=dword:", with: "")
                    .trimmingCharacters(in: .whitespaces)
                if let parsed = Int(hex, radix: 16), parsed >= 72, parsed <= 480 {
                    return parsed
                }
            }
        }
        return 96
    }
}
