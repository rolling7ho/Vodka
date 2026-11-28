//
//  BridgeHandlers.swift
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

struct BridgeRouter: Sendable {
    let writer: BridgeWriter

    func handle(_ request: BridgeRequest) async -> BridgeResponse {
        do {
            let result = try await dispatch(request)
            return BridgeResponse(id: request.id, result: result, error: nil)
        } catch let bridgeError as BridgeError {
            return BridgeResponse(
                id: request.id,
                result: nil,
                error: BridgeErrorPayload(
                    code: bridgeError.code,
                    message: bridgeError.localizedDescription
                )
            )
        } catch {
            return BridgeResponse(
                id: request.id,
                result: nil,
                error: BridgeErrorPayload(
                    code: "operation_failed",
                    message: error.localizedDescription
                )
            )
        }
    }

    private func dispatch(_ request: BridgeRequest) async throws -> JSONValue {
        let params = request.params ?? [:]
        if let domainResult = try await dispatchDomainMethod(request.method, params: params) {
            return domainResult
        }

        switch request.method {
        case "ping":
            return .object(["ok": .bool(true)])
        case "system.status":
            return await systemStatus()
        case "engine.install":
            return try await installEngine(requestID: request.id)
        case "gptk.install":
            return try await installGPTK(params: params)
        case "graphics.setDefault":
            return try setDefaultGraphics(params: params)
        case "launcher.setup":
            return try await setupLauncher(requestID: request.id, params: params)
        case "library.list":
            return await listBottles()
        default:
            throw BridgeError.unknownMethod(request.method)
        }
    }

    private func dispatchDomainMethod(
        _ method: String,
        params: [String: JSONValue]
    ) async throws -> JSONValue? {
        if let bottleResult = try await dispatchBottleMethod(method, params: params) {
            return bottleResult
        }
        if let homeResult = try await dispatchHomeMethod(method, params: params) {
            return homeResult
        }
        if let configResult = try await dispatchConfigMethod(method, params: params) {
            return configResult
        }
        if let toolsResult = try await dispatchToolsMethod(method, params: params) {
            return toolsResult
        }
        return try await dispatchSupportMethod(method, params: params)
    }

    private func dispatchBottleMethod(
        _ method: String,
        params: [String: JSONValue]
    ) async throws -> JSONValue? {
        switch method {
        case "bottles.importLegacy":
            try await importLegacyBottles(params: params)
        case "bottles.create":
            try await createBottle(params: params)
        case "bottles.rename":
            try await renameBottle(params: params)
        case "bottles.delete":
            try await deleteBottle(params: params)
        case "bottles.setIcon":
            try await setBottleIcon(params: params)
        case "bottles.reorder":
            try await reorderBottles(params: params)
        case "bottles.runningSummary":
            await runningBottlesSummary()
        case "bottles.killAll":
            await killAllBottles()
        default:
            nil
        }
    }

    private func dispatchHomeMethod(
        _ method: String,
        params: [String: JSONValue]
    ) async throws -> JSONValue? {
        switch method {
        case "home.summary":
            await homeSummary()
        case "home.launch":
            try await launchHomeItem(params: params)
        default:
            nil
        }
    }

    private func dispatchConfigMethod(
        _ method: String,
        params: [String: JSONValue]
    ) async throws -> JSONValue? {
        switch method {
        case "bottles.getConfig":
            try await getBottleConfig(params: params)
        case "bottles.updateConfig":
            try await updateBottleConfig(params: params)
        case "games.getSettings":
            try await getGameSettings(params: params)
        case "games.updateSettings":
            try await updateGameSettings(params: params)
        case "settings.get":
            getAppSettings()
        case "settings.update":
            updateAppSettings(params: params)
        case "settings.clearShaderCaches":
            await clearShaderCaches()
        case "settings.pruneLogs":
            pruneLogs()
        case "settings.checkUpdates":
            await checkUpdates(params: params)
        default:
            nil
        }
    }

    @MainActor
    private func systemStatus() -> JSONValue {
        var bottlesList = BottleData()
        let bottles = bottlesList.loadBottles()
        let legacyBottles = LegacyBottleImport.importableBottles(existingPaths: bottlesList.paths)
        let toolkitFile = findNewestDownloadedToolkit()

        let encodedBottles: [JSONValue] = legacyBottles.map { bottle in
            let path = bottle.url.path(percentEncoded: false)
            return .object([
                "id": .string(path),
                "name": .string(bottle.name),
                "path": .string(path)
            ])
        }

        return .object([
            "rosettaInstalled": .bool(Rosetta2.isRosettaInstalled),
            "engineInstalled": .bool(GmacWineInstaller.isGmacWineInstalled()),
            "toolkitInstalled": .bool(GPTKImporter.isDeployed()),
            "detectedToolkitFile": toolkitFile.map { .string($0.lastPathComponent) } ?? .null,
            "detectedToolkitPath": toolkitFile.map { .string($0.path(percentEncoded: false)) } ?? .null,
            "legacyWhiskyBottles": .array(encodedBottles),
            "steamInstalled": .bool(SteamInstaller.steamBottle(in: bottles) != nil)
        ])
    }

    private func findNewestDownloadedToolkit() -> URL? {
        guard let downloads = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first,
              let items = try? FileManager.default.contentsOfDirectory(
                  at: downloads,
                  includingPropertiesForKeys: [.contentModificationDateKey]
              )
        else {
            return nil
        }

        let matches = items.filter { url in
            let name = url.lastPathComponent.lowercased()
            return url.pathExtension.lowercased() == "dmg" && (
                name.contains("game_porting_toolkit") ||
                    name.contains("game porting toolkit") ||
                    name.contains("evaluation_environment") ||
                    name.contains("evaluation environment") ||
                    name.contains("gptk")
            )
        }

        return matches.max { lhs, rhs in
            let left = (try? lhs.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
            let right = (try? rhs.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
            return (left ?? .distantPast) < (right ?? .distantPast)
        }
    }

    @MainActor
    private func listBottles() -> JSONValue {
        var bottlesList = BottleData()
        let bottles = bottlesList.loadBottles()
        let icons = loadPCIcons()
        let items: [JSONValue] = bottles.map { bottle in
            encodeBottleSummary(bottle, icons: icons)
        }
        return .array(items)
    }
}
