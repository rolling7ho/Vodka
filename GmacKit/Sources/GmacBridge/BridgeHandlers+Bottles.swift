//
//  BridgeHandlers+Bottles.swift
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
    private static var pcIconsURL: URL {
        BottleData.containerDir.appending(path: "pc-icons.json")
    }

    static func canonicalBottlePath(_ url: URL) -> String {
        var path = url.standardizedFileURL.resolvingSymlinksInPath().path(percentEncoded: false)
        if path.count > 1, path.hasSuffix("/") {
            path.removeLast()
        }
        return path
    }

    func loadPCIcons() -> [String: String] {
        guard let data = try? Data(contentsOf: Self.pcIconsURL),
              let decoded = try? JSONDecoder().decode([String: String].self, from: data)
        else {
            return [:]
        }
        return decoded
    }

    private func savePCIcons(_ icons: [String: String]) throws {
        try FileManager.default.createDirectory(
            at: BottleData.containerDir,
            withIntermediateDirectories: true,
            attributes: nil
        )
        let data = try JSONEncoder().encode(icons)
        try data.write(to: Self.pcIconsURL, options: .atomic)
    }

    @MainActor
    func encodeBottleSummary(_ bottle: Bottle, icons: [String: String]) -> JSONValue {
        let canonical = Self.canonicalBottlePath(bottle.url)
        let iconValue: JSONValue = icons[canonical].map { .string($0) } ?? .null
        return .object([
            "name": .string(bottle.settings.name),
            "path": .string(bottle.url.path(percentEncoded: false)),
            "windowsVersion": .string(bottle.settings.windowsVersion.pretty()),
            "graphicsBackend": .string(bottle.settings.graphicsBackend.rawValue),
            "isAvailable": .bool(bottle.isAvailable),
            "icon": iconValue
        ])
    }

    @MainActor
    func createBottle(params: [String: JSONValue]) async throws -> JSONValue {
        guard let rawName = params["name"]?.stringValue else {
            throw BridgeError.invalidParams("Missing PC name.")
        }
        let trimmedName = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            throw BridgeError.invalidParams("PC name cannot be empty.")
        }

        guard GmacWineInstaller.isGmacWineInstalled() else {
            throw BridgeError.operationFailed("Gmac Windows Engine must be installed first.")
        }

        let defaults = UserDefaults.standard
        let baseDir = defaults.url(forKey: "defaultBottleLocation") ?? BottleData.defaultBottleDir
        let winRaw = defaults.string(forKey: "defaultWinVersion") ?? WinVersion.win10.rawValue
        let defaultWin = WinVersion(rawValue: winRaw) ?? .win10
        let backendRaw = defaults.string(forKey: "defaultGraphicsBackend") ?? GraphicsBackend.recommended.rawValue
        let defaultBackend = GraphicsBackend(rawValue: backendRaw) ?? .recommended

        let newBottleURL = baseDir.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(
            at: newBottleURL,
            withIntermediateDirectories: true,
            attributes: nil
        )

        do {
            let bottle = Bottle(bottleUrl: newBottleURL, inFlight: true)
            bottle.settings.windowsVersion = defaultWin
            bottle.settings.name = trimmedName
            bottle.settings.graphicsBackend = defaultBackend

            try await Wine.changeWinVersion(bottle: bottle, win: defaultWin)
            let wineVer = try await Wine.wineVersion()
            bottle.settings.wineVersion = SemanticVersion(wineVer) ?? SemanticVersion(0, 0, 0)

            BottleFontBootstrap.copySystemFonts(toPrefix: bottle.url)
            bottle.saveBottleSettings()

            var bottlesList = BottleData()
            guard bottlesList.registerBottlePath(newBottleURL) else {
                throw BridgeError.operationFailed("Failed to register the created PC.")
            }

            bottle.isAvailable = true
            bottle.inFlight = false

            var icons = loadPCIcons()
            if let icon = params["icon"]?.stringValue, !icon.isEmpty {
                icons[Self.canonicalBottlePath(newBottleURL)] = icon
                try? savePCIcons(icons)
            }

            return encodeBottleSummary(bottle, icons: icons)
        } catch {
            try? FileManager.default.removeItem(at: newBottleURL)
            throw error
        }
    }

    @MainActor
    func renameBottle(params: [String: JSONValue]) throws -> JSONValue {
        guard let rawPath = params["path"]?.stringValue, !rawPath.isEmpty else {
            throw BridgeError.invalidParams("Missing PC path.")
        }
        guard let rawName = params["name"]?.stringValue else {
            throw BridgeError.invalidParams("Missing PC name.")
        }
        let trimmedName = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            throw BridgeError.invalidParams("PC name cannot be empty.")
        }

        let targetCanonical = Self.canonicalBottlePath(URL(filePath: rawPath))
        var bottlesList = BottleData()
        let bottles = bottlesList.loadBottles()
        guard let bottle = bottles.first(where: { Self.canonicalBottlePath($0.url) == targetCanonical }) else {
            throw BridgeError.operationFailed("PC not found.")
        }

        bottle.settings.name = trimmedName
        bottle.saveBottleSettings()

        let icons = loadPCIcons()
        return encodeBottleSummary(bottle, icons: icons)
    }

    @MainActor
    func deleteBottle(params: [String: JSONValue]) throws -> JSONValue {
        guard let rawPath = params["path"]?.stringValue, !rawPath.isEmpty else {
            throw BridgeError.invalidParams("Missing PC path.")
        }

        let targetCanonical = Self.canonicalBottlePath(URL(filePath: rawPath))
        var bottlesList = BottleData()
        guard let existingURL = bottlesList.paths.first(where: {
            Self.canonicalBottlePath($0) == targetCanonical
        })
        else {
            throw BridgeError.operationFailed("PC not found.")
        }

        let fileManager = FileManager.default
        if fileManager.fileExists(atPath: existingURL.path(percentEncoded: false)) {
            try fileManager.removeItem(at: existingURL)
        }

        GameRouting().removeRoutes(toBottle: existingURL)
        bottlesList.paths.removeAll { Self.canonicalBottlePath($0) == targetCanonical }

        var icons = loadPCIcons()
        if icons.removeValue(forKey: targetCanonical) != nil {
            try? savePCIcons(icons)
        }

        return .object(["deleted": .bool(true)])
    }

    @MainActor
    func setBottleIcon(params: [String: JSONValue]) throws -> JSONValue {
        guard let rawPath = params["path"]?.stringValue, !rawPath.isEmpty else {
            throw BridgeError.invalidParams("Missing PC path.")
        }
        guard let icon = params["icon"]?.stringValue, !icon.isEmpty else {
            throw BridgeError.invalidParams("Missing icon identifier.")
        }

        let canonical = Self.canonicalBottlePath(URL(filePath: rawPath))
        var icons = loadPCIcons()
        icons[canonical] = icon
        try savePCIcons(icons)

        return .object([
            "path": .string(rawPath),
            "icon": .string(icon)
        ])
    }

    @MainActor
    func reorderBottles(params: [String: JSONValue]) throws -> JSONValue {
        guard let requestedPaths = params["paths"]?.stringArrayValue else {
            throw BridgeError.invalidParams("Missing PC path order.")
        }

        var bottlesList = BottleData()
        var existingByCanonical: [String: URL] = [:]
        for entryURL in bottlesList.paths {
            existingByCanonical[Self.canonicalBottlePath(entryURL)] = entryURL
        }

        var reordered: [URL] = []
        var appendedCanonicals = Set<String>()

        for rawPath in requestedPaths {
            let canonical = Self.canonicalBottlePath(URL(filePath: rawPath))
            if let matchedURL = existingByCanonical[canonical], appendedCanonicals.insert(canonical).inserted {
                reordered.append(matchedURL)
            }
        }

        for entryURL in bottlesList.paths {
            let canonical = Self.canonicalBottlePath(entryURL)
            if appendedCanonicals.insert(canonical).inserted {
                reordered.append(entryURL)
            }
        }

        bottlesList.paths = reordered
        let encodedPaths = bottlesList.paths.map { JSONValue.string($0.path(percentEncoded: false)) }
        return .object(["paths": .array(encodedPaths)])
    }
}
