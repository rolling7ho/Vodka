//
//  BridgeHandlers+Routing.swift
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

extension BridgeRouter {
    func dispatchToolsMethod(
        _ method: String,
        params: [String: JSONValue]
    ) async throws -> JSONValue? {
        switch method {
        case "bottles.listProcesses":
            try await listBottleProcesses(params: params)
        case "bottles.killProcess":
            try await killBottleProcess(params: params)
        case "bottles.killBottle":
            try await killSingleBottle(params: params)
        case "bottles.listPins":
            try await listBottlePins(params: params)
        case "bottles.addPin":
            try await addBottlePin(params: params)
        case "bottles.removePin":
            try await removeBottlePin(params: params)
        case "winetricks.listVerbs":
            await listWinetricksVerbs(params: params)
        case "winetricks.run":
            try await runWinetricksVerb(params: params)
        default:
            nil
        }
    }

    func dispatchSupportMethod(
        _ method: String,
        params: [String: JSONValue]
    ) async throws -> JSONValue? {
        if let audioResult = try await dispatchAudioMethod(method, params: params) {
            return audioResult
        }
        if let diagResult = try await dispatchDiagnosticsMethod(method, params: params) {
            return diagResult
        }
        return try await dispatchGameDBMethod(method, params: params)
    }

    private func dispatchAudioMethod(
        _ method: String,
        params: [String: JSONValue]
    ) async throws -> JSONValue? {
        switch method {
        case "audio.status":
            try await getAudioStatus(params: params)
        case "audio.test":
            try await runAudioTest(params: params)
        case "audio.troubleshoot":
            try await troubleshootAudio(params: params)
        case "audio.applyFix":
            try await applyAudioFix(params: params)
        default:
            nil
        }
    }

    private func dispatchDiagnosticsMethod(
        _ method: String,
        params: [String: JSONValue]
    ) async throws -> JSONValue? {
        switch method {
        case "logs.list":
            listLogs()
        case "logs.read":
            try await readLogFile(params: params)
        case "diagnostics.analyze":
            try await analyzeDiagnostics(params: params)
        case "diagnostics.export":
            try await exportDiagnosticsReport(params: params)
        case "troubleshoot.listCategories":
            listTroubleshootCategories()
        case "troubleshoot.runFlow":
            try await runTroubleshootFlow(params: params)
        case "troubleshoot.applyFix":
            try await applyTroubleshootFix(params: params)
        case "troubleshoot.undoFix":
            try await undoTroubleshootFix(params: params)
        default:
            nil
        }
    }

    private func dispatchGameDBMethod(
        _ method: String,
        params: [String: JSONValue]
    ) async throws -> JSONValue? {
        switch method {
        case "gamedb.list":
            listGameDB(params: params)
        case "gamedb.preview":
            try await previewGameDB(params: params)
        case "gamedb.apply":
            try await applyGameDB(params: params)
        default:
            nil
        }
    }
}
