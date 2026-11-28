//
//  BridgeHandlers+Audio.swift
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
    func getAudioStatus(params: [String: JSONValue]) async throws -> JSONValue {
        let monitor = AudioDeviceMonitor()
        let defaultDev = monitor.defaultOutputDevice()
        let devices = monitor.allOutputDevices()
        let coreAudioResult = await CoreAudioDeviceProbe(monitor: monitor).run()

        var findings = coreAudioResult.findings
        if let bottlePath = params["bottlePath"]?.stringValue, !bottlePath.isEmpty {
            let bottle = try resolveBottleForConfig(path: bottlePath)
            let registryResult = await WineRegistryAudioProbe(bottle: bottle).run()
            findings.append(contentsOf: registryResult.findings)
        }

        return .object([
            "defaultDevice": defaultDev.map(Self.encodeAudioDevice) ?? .null,
            "devices": .array(devices.map(Self.encodeAudioDevice)),
            "findings": .array(findings.map(Self.encodeAudioFinding))
        ])
    }

    @MainActor
    func runAudioTest(params: [String: JSONValue]) async throws -> JSONValue {
        let bottle = try resolveBottleForConfig(path: params["bottlePath"]?.stringValue)
        let probe = WineAudioTestProbe(bottle: bottle, testExeURL: nil)
        let result = await probe.runWithBeep()
        return .object([
            "ok": .bool(result.status != .error),
            "status": .string(result.status.rawValue),
            "summary": .string(result.summary),
            "evidence": .array(result.evidence.map { .string($0) }),
            "findings": .array(result.findings.map(Self.encodeAudioFinding))
        ])
    }

    @MainActor
    func troubleshootAudio(params: [String: JSONValue]) async throws -> JSONValue {
        let bottle = try resolveBottleForConfig(path: params["bottlePath"]?.stringValue)
        let symptomRaw = params["symptom"]?.stringValue ?? AudioSymptom.noSound.rawValue
        let symptom = AudioSymptom(rawValue: symptomRaw) ?? .noSound

        let monitor = AudioDeviceMonitor()
        let coreResult = await CoreAudioDeviceProbe(monitor: monitor).run()
        let regResult = await WineRegistryAudioProbe(bottle: bottle).run()
        let allFindings = coreResult.findings + regResult.findings

        let fixes = Self.suggestedAudioFixes(for: symptom, bottle: bottle)
        return .object([
            "symptom": .string(symptom.rawValue),
            "symptomTitle": .string(symptom.displayName),
            "symptomDescription": .string(symptom.symptomDescription),
            "findings": .array(allFindings.map(Self.encodeAudioFinding)),
            "suggestedFixes": .array(fixes)
        ])
    }

    @MainActor
    func applyAudioFix(params: [String: JSONValue]) async throws -> JSONValue {
        let bottle = try resolveBottleForConfig(path: params["bottlePath"]?.stringValue)
        guard let fixID = params["fixId"]?.stringValue, !fixID.isEmpty else {
            throw BridgeError.invalidParams("Missing audio fix identifier.")
        }

        switch fixID {
        case "set-driver-coreaudio":
            bottle.settings.audioDriver = .coreaudio
        case "set-driver-auto":
            bottle.settings.audioDriver = .auto
        case "set-latency-stable":
            bottle.settings.audioLatencyPreset = .stable
        case "set-latency-default":
            bottle.settings.audioLatencyPreset = .defaultPreset
        case "unpin-output-device":
            bottle.settings.outputDeviceMode = .followSystem
            bottle.settings.pinnedDeviceName = nil
        case "sync-audio-registry":
            break
        default:
            throw BridgeError.invalidParams("Unknown audio fix: \(fixID)")
        }

        bottle.saveBottleSettings()
        await Wine.syncAudioRegistry(bottle: bottle)

        return .object([
            "ok": .bool(true),
            "fixId": .string(fixID),
            "config": Self.encodeBottleConfig(bottle)
        ])
    }

    @MainActor
    private static func suggestedAudioFixes(for symptom: AudioSymptom, bottle: Bottle) -> [JSONValue] {
        var fixes: [JSONValue] = []
        if bottle.settings.audioDriver != .coreaudio {
            fixes.append(.object([
                "id": .string("set-driver-coreaudio"),
                "title": .string("Switch Audio Driver to CoreAudio"),
                "description": .string("Forces Wine to use macOS CoreAudio directly instead of auto-probing.")
            ]))
        }
        if symptom == .crackling || symptom == .stutter, bottle.settings.audioLatencyPreset != .stable {
            fixes.append(.object([
                "id": .string("set-latency-stable"),
                "title": .string("Use Stable Audio Buffer"),
                "description": .string("Increases DirectSound buffer size to reduce Bluetooth or USB crackling.")
            ]))
        }
        if symptom == .wrongDevice, bottle.settings.outputDeviceMode == .pinned {
            fixes.append(.object([
                "id": .string("unpin-output-device"),
                "title": .string("Follow System Default Output"),
                "description": .string("Unpins the locked audio device so Wine follows macOS output switching.")
            ]))
        }
        fixes.append(.object([
            "id": .string("sync-audio-registry"),
            "title": .string("Resync Wine Audio Registry"),
            "description": .string("Rewrites CoreAudio driver and DirectSound buffer registry keys immediately.")
        ]))
        return fixes
    }

    private static func encodeAudioDevice(_ device: AudioDeviceInfo) -> JSONValue {
        .object([
            "id": .string(device.id),
            "name": .string(device.name),
            "transportType": .string(device.transportType.displayName),
            "sampleRate": .double(device.sampleRate),
            "outputChannelCount": .int(device.outputChannelCount),
            "isDefault": .bool(device.isDefault)
        ])
    }

    private static func encodeAudioFinding(_ finding: AudioFinding) -> JSONValue {
        .object([
            "id": .string(finding.id),
            "description": .string(finding.description),
            "confidence": .string(finding.confidence.rawValue),
            "evidence": .string(finding.evidence),
            "suggestedAction": finding.suggestedAction.map { .string($0) } ?? .null
        ])
    }
}
