//
//  BridgeHandlers+Setup.swift
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
import SemanticVersion

extension BridgeRouter {
    func installGPTK(params: [String: JSONValue]) async throws -> JSONValue {
        guard let rawPath = params["path"]?.stringValue, !rawPath.isEmpty else {
            throw BridgeError.invalidParams("Missing toolkit path.")
        }

        let sourceURL = URL(filePath: rawPath)
        let resolved = try BridgeDiskImage.resolvePayload(at: sourceURL)
        defer {
            for mount in resolved.mounts.reversed() {
                BridgeDiskImage.detach(mount)
            }
        }

        let payload = try GPTKImporter.validatePayload(at: resolved.libRoot)
        try GPTKImporter.importPayload(payload)
        if GPTKImporter.isRuntimeGPTKCapable() {
            try GPTKImporter.deployStoredPayload()
        }

        await migrateBottleBackends()

        return .object([
            "installed": .bool(GPTKImporter.isDeployed()),
            "version": .string(payload.version)
        ])
    }

    @MainActor
    private func migrateBottleBackends() {
        var data = BottleData()
        let bottles = data.loadBottles()
        let d3dMetalInstalled = GmacWineInstaller.isD3DMetalInstalled()
        for bottle in bottles where bottle.isAvailable && !bottle.inFlight {
            LauncherBackendMigration.migrateIfNeeded(bottle, d3dMetalInstalled: d3dMetalInstalled)
        }
    }

    func setDefaultGraphics(params: [String: JSONValue]) throws -> JSONValue {
        guard let choice = params["choice"]?.stringValue, !choice.isEmpty else {
            throw BridgeError.invalidParams("Missing graphics choice.")
        }
        UserDefaults.standard.set(choice, forKey: "gmac.defaultGraphicsChoice")
        return .object(["choice": .string(choice)])
    }

    @MainActor
    func importLegacyBottles(params: [String: JSONValue]) throws -> JSONValue {
        guard let paths = params["paths"]?.stringArrayValue else {
            throw BridgeError.invalidParams("Missing bottle paths.")
        }

        var bottlesList = BottleData()
        let existing = Set(bottlesList.paths.map(\.standardizedFileURL))
        let toAdd = paths
            .map { URL(filePath: $0).standardizedFileURL }
            .filter { !existing.contains($0) }

        if !toAdd.isEmpty {
            bottlesList.paths += toAdd
        }

        return .object(["importedCount": .int(toAdd.count)])
    }

    @MainActor
    func setupLauncher(requestID: Int, params: [String: JSONValue]) async throws -> JSONValue {
        guard let launcherID = params["launcher"]?.stringValue, !launcherID.isEmpty else {
            throw BridgeError.invalidParams("Missing launcher identifier.")
        }
        let graphicsChoice = params["graphicsChoice"]?.stringValue

        guard let launcherType = Self.mapLauncher(launcherID) else {
            throw BridgeError.invalidParams("Unsupported launcher: \(launcherID)")
        }

        writer.sendEvent(id: requestID, data: [
            "component": .string("launcher"),
            "stage": .string("creating")
        ])

        var bottlesList = BottleData()
        let existingBottles = bottlesList.loadBottles()
        let bottle: Bottle = if launcherType == .steam,
                                let existingSteam = SteamInstaller.steamBottle(in: existingBottles) {
            existingSteam
        } else if let named = existingBottles.first(where: { $0.settings.name == launcherType.displayName }) {
            named
        } else {
            try await createLauncherBottle(
                name: launcherType.displayName,
                graphicsChoice: graphicsChoice,
                registry: &bottlesList
            )
        }

        LauncherFixes.apply(to: bottle, launcher: launcherType)

        if launcherType == .steam, !SteamInstaller.isInstalled(in: bottle) {
            writer.sendEvent(id: requestID, data: [
                "component": .string("launcher"),
                "stage": .string("downloading")
            ])
            writer.sendEvent(id: requestID, data: [
                "component": .string("launcher"),
                "stage": .string("installing")
            ])
            try await SteamInstaller.install(in: bottle)
        }

        writer.sendEvent(id: requestID, data: [
            "component": .string("launcher"),
            "stage": .string("done")
        ])

        return .object([
            "bottlePath": .string(bottle.url.path(percentEncoded: false)),
            "launcher": .string(launcherID)
        ])
    }

    @MainActor
    private func createLauncherBottle(
        name: String,
        graphicsChoice: String?,
        registry: inout BottleData
    ) async throws -> Bottle {
        guard GmacWineInstaller.isGmacWineInstalled() else {
            throw BridgeError.operationFailed("Gmac Windows Engine must be installed first.")
        }

        let newBottleURL = BottleData.defaultBottleDir.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(
            at: newBottleURL,
            withIntermediateDirectories: true,
            attributes: nil
        )

        let bottle = Bottle(bottleUrl: newBottleURL, inFlight: true)
        bottle.settings.windowsVersion = .win10
        bottle.settings.name = name
        bottle.settings.graphicsBackend = Self.mapGraphicsBackend(graphicsChoice)

        try await Wine.changeWinVersion(bottle: bottle, win: .win10)
        let wineVer = try await Wine.wineVersion()
        bottle.settings.wineVersion = SemanticVersion(wineVer) ?? SemanticVersion(0, 0, 0)

        BottleFontBootstrap.copySystemFonts(toPrefix: bottle.url)
        bottle.saveBottleSettings()

        guard registry.registerBottlePath(newBottleURL) else {
            throw BridgeError.operationFailed("Failed to register the created PC.")
        }

        bottle.isAvailable = true
        bottle.inFlight = false
        return bottle
    }

    private static func mapLauncher(_ id: String) -> LauncherType? {
        switch id {
        case "steam":
            .steam
        case "epicGames":
            .epicGames
        case "battleNet":
            .battleNet
        case "eaApp":
            .eaApp
        case "rockstar":
            .rockstar
        case "ubisoft":
            .ubisoft
        default:
            nil
        }
    }

    private static func mapGraphicsBackend(_ choice: String?) -> GraphicsBackend {
        switch choice {
        case "directX12":
            .d3dMetal
        case "directX11":
            .dxmt
        case "directX11Compatibility":
            .dxvk
        case "directX9", "openGL":
            .wined3d
        default:
            .recommended
        }
    }
}
