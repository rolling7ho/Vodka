//
//  BridgeHandlers+Tools.swift
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
    func listBottleProcesses(params: [String: JSONValue]) async throws -> JSONValue {
        let bottle = try resolveBottleForConfig(path: params["path"]?.stringValue)
        let running = await Wine.isWineserverRunning(for: bottle)
        guard running else {
            return .object(["running": .bool(false), "processes": .array([])])
        }
        let processes = (try? await Wine.listProcesses(for: bottle)) ?? []
        let encoded = processes.map { proc in
            JSONValue.object([
                "imageName": .string(proc.imageName),
                "winePID": .int(Int(proc.winePID)),
                "memoryUsage": .string(proc.memoryUsage),
                "kind": .string(proc.kind.rawValue)
            ])
        }
        return .object(["running": .bool(true), "processes": .array(encoded)])
    }

    @MainActor
    func killBottleProcess(params: [String: JSONValue]) async throws -> JSONValue {
        let bottle = try resolveBottleForConfig(path: params["path"]?.stringValue)
        guard let pid = params["pid"]?.intValue else {
            throw BridgeError.invalidParams("Missing process PID.")
        }
        let force = params["force"]?.boolValue ?? false
        if force {
            await Wine.forceKillProcess(winePID: Int32(pid), bottle: bottle)
        } else {
            await Wine.gracefulKillProcess(winePID: Int32(pid), bottle: bottle)
        }
        return .object(["killed": .bool(true)])
    }

    @MainActor
    func killSingleBottle(params: [String: JSONValue]) throws -> JSONValue {
        let bottle = try resolveBottleForConfig(path: params["path"]?.stringValue)
        Wine.killBottle(bottle: bottle)
        return .object(["killed": .bool(true)])
    }

    @MainActor
    func listBottlePins(params: [String: JSONValue]) throws -> JSONValue {
        let bottle = try resolveBottleForConfig(path: params["path"]?.stringValue)
        return Self.encodePins(bottle.settings.pins)
    }

    @MainActor
    func addBottlePin(params: [String: JSONValue]) throws -> JSONValue {
        let bottle = try resolveBottleForConfig(path: params["path"]?.stringValue)
        guard let programPath = params["programPath"]?.stringValue, !programPath.isEmpty
        else {
            throw BridgeError.invalidParams("Missing program executable path.")
        }
        let programURL = URL(filePath: programPath)
        guard FileManager.default.fileExists(atPath: programURL.path(percentEncoded: false))
        else {
            throw BridgeError.operationFailed("Executable does not exist on disk.")
        }
        let defaultName = programURL.deletingPathExtension().lastPathComponent
        let rawName = params["name"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines)
        let pinName = (rawName?.isEmpty == false) ? rawName ?? defaultName : defaultName

        let alreadyPinned = bottle.settings.pins.contains {
            $0.url?.standardizedFileURL == programURL.standardizedFileURL
        }
        if !alreadyPinned {
            bottle.settings.pins.append(PinnedProgram(name: pinName, url: programURL))
            bottle.saveBottleSettings()
        }
        return Self.encodePins(bottle.settings.pins)
    }

    @MainActor
    func removeBottlePin(params: [String: JSONValue]) throws -> JSONValue {
        let bottle = try resolveBottleForConfig(path: params["path"]?.stringValue)
        guard let programPath = params["programPath"]?.stringValue, !programPath.isEmpty
        else {
            throw BridgeError.invalidParams("Missing program executable path.")
        }
        let targetURL = URL(filePath: programPath).standardizedFileURL
        bottle.settings.pins.removeAll { $0.url?.standardizedFileURL == targetURL }
        bottle.saveBottleSettings()
        return Self.encodePins(bottle.settings.pins)
    }

    @MainActor
    func listWinetricksVerbs(params: [String: JSONValue]) -> JSONValue {
        let resourcesDir = Self.locateLibrariesDirectory()
        guard let dir = resourcesDir else {
            return .object(["available": .bool(false), "categories": .array([])])
        }
        let verbsURL = dir.appending(path: "verbs.txt")
        guard let rawText = try? String(contentsOf: verbsURL, encoding: .utf8) else {
            return .object(["available": .bool(false), "categories": .array([])])
        }

        let installedSet: Set<String>
        if let rawPath = params["path"]?.stringValue, !rawPath.isEmpty,
           let cache = WinetricksVerbCache.load(from: URL(filePath: rawPath)) {
            installedSet = cache.installedVerbs
        } else {
            installedSet = []
        }

        let categories = Self.parseVerbsText(rawText, installedSet: installedSet)
        return .object([
            "available": .bool(true),
            "categories": .array(categories)
        ])
    }

    @MainActor
    func runWinetricksVerb(params: [String: JSONValue]) async throws -> JSONValue {
        let bottle = try resolveBottleForConfig(path: params["path"]?.stringValue)
        guard let rawVerb = params["verb"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines),
              !rawVerb.isEmpty
        else {
            throw BridgeError.invalidParams("Missing winetricks verb.")
        }
        guard rawVerb.range(of: #"^[a-zA-Z0-9._-]+$"#, options: .regularExpression) != nil
        else {
            throw BridgeError.invalidParams("Invalid winetricks verb name.")
        }
        guard let resourcesDir = Self.locateLibrariesDirectory() else {
            throw BridgeError.operationFailed("Bundled winetricks resources were not found.")
        }
        let winetricksURL = resourcesDir.appending(path: "winetricks")
        guard FileManager.default.fileExists(atPath: winetricksURL.path(percentEncoded: false))
        else {
            throw BridgeError.operationFailed("Bundled winetricks script was not found.")
        }

        let validation = WinePrefixValidation.validatePrefix(for: bottle)
        if !validation.isValid {
            _ = try await Wine.repairPrefix(bottle: bottle)
        }

        let resPath = resourcesDir.path(percentEncoded: false)
        let wineBinPath = GmacWineInstaller.binFolder.path(percentEncoded: false)
        let bottlePath = bottle.url.path(percentEncoded: false)
        let winetricksPath = winetricksURL.path(percentEncoded: false)

        let result = try await Self.executeWinetricksProcess(
            scriptPath: winetricksPath,
            verb: rawVerb,
            bottlePath: bottlePath,
            pathEnv: "\(wineBinPath):\(resPath):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
        )
        return .object([
            "ok": .bool(result.exitCode == 0),
            "exitCode": .int(Int(result.exitCode)),
            "output": .string(result.output)
        ])
    }

    private static func executeWinetricksProcess(
        scriptPath: String,
        verb: String,
        bottlePath: String,
        pathEnv: String
    ) async throws -> (exitCode: Int32, output: String) {
        try await Task.detached {
            let process = Process()
            process.executableURL = URL(filePath: "/bin/bash")
            process.arguments = [scriptPath, "-q", verb]
            var env = ProcessInfo.processInfo.environment
            env["PATH"] = pathEnv
            env["WINE"] = "wine64"
            env["WINEPREFIX"] = bottlePath
            process.environment = env

            let pipe = Pipe()
            process.standardOutput = pipe
            process.standardError = pipe
            try process.run()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            process.waitUntilExit()
            let output = String(data: data, encoding: .utf8) ?? ""
            return (process.terminationStatus, String(output.suffix(12_000)))
        }.value
    }

    private static func encodePins(_ pins: [PinnedProgram]) -> JSONValue {
        let encoded = pins.compactMap { pin -> JSONValue? in
            guard let url = pin.url else { return nil }
            return .object([
                "name": .string(pin.name),
                "path": .string(url.path(percentEncoded: false)),
                "removable": .bool(pin.removable)
            ])
        }
        return .object(["pins": .array(encoded)])
    }

    private static func locateLibrariesDirectory() -> URL? {
        let fileManager = FileManager.default
        var candidates: [URL] = []
        if let resourceURL = Bundle.main.resourceURL {
            candidates.append(resourceURL.appending(path: "Libraries"))
            candidates.append(resourceURL)
        }
        if let execDir = Bundle.main.executableURL?.deletingLastPathComponent() {
            candidates.append(execDir.appending(path: "Libraries"))
            candidates.append(execDir.appending(path: "../Libraries").standardizedFileURL)
        }
        let cwd = URL(filePath: fileManager.currentDirectoryPath)
        candidates.append(cwd.appending(path: "Libraries"))
        candidates.append(cwd.appending(path: "../Libraries").standardizedFileURL)

        return candidates.first { dir in
            fileManager.fileExists(atPath: dir.appending(path: "verbs.txt").path(percentEncoded: false))
        }
    }

    private static func parseVerbsText(_ text: String, installedSet: Set<String>) -> [JSONValue] {
        var result: [JSONValue] = []
        var currentCategory: String?
        var currentVerbs: [JSONValue] = []

        for rawLine in text.components(separatedBy: "\n") {
            let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
            if line.isEmpty { continue }
            if line.hasPrefix("=====") {
                if let cat = currentCategory, !currentVerbs.isEmpty {
                    result.append(.object(["category": .string(cat), "verbs": .array(currentVerbs)]))
                }
                currentCategory = line.replacingOccurrences(of: "=====", with: "")
                    .trimmingCharacters(in: .whitespaces)
                currentVerbs = []
                continue
            }
            guard currentCategory != nil else { continue }
            let parts = line.split(separator: " ", maxSplits: 1, omittingEmptySubsequences: true)
            guard parts.count == 2 else { continue }
            let verbName = String(parts[0])
            let description = String(parts[1]).trimmingCharacters(in: .whitespaces)
            currentVerbs.append(.object([
                "name": .string(verbName),
                "description": .string(description),
                "installed": .bool(installedSet.contains(verbName))
            ]))
        }
        if let cat = currentCategory, !currentVerbs.isEmpty {
            result.append(.object(["category": .string(cat), "verbs": .array(currentVerbs)]))
        }
        return result
    }
}
