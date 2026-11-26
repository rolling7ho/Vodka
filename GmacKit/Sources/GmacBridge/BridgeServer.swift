//
//  BridgeServer.swift
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

import AppKit
import Combine
import Foundation
import GmacKit
import os.log
import SemanticVersion

final class BridgeWriter: @unchecked Sendable {
    private let lock = NSLock()
    private let encoder: JSONEncoder = {
        let enc = JSONEncoder()
        enc.outputFormatting = [.sortedKeys]
        return enc
    }()

    func send<T: Encodable>(_ value: T) {
        guard var data = try? encoder.encode(value) else { return }
        data.append(0x0A)
        lock.lock()
        FileHandle.standardOutput.write(data)
        lock.unlock()
    }

    func emitEvent<T: Encodable>(_ name: String, payload: T) {
        send(BridgeEvent(event: name, payload: payload))
    }
}

private struct BridgeError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

@MainActor
final class BridgeServer: BottleRegistry {
    private let writer: BridgeWriter
    private let logger = Logger(subsystem: Bundle.gmacBundleIdentifier, category: "GmacBridge")
    private let defaults: UserDefaults

    private var bottleData = BottleData()
    private var bottles: [Bottle] = []
    private var orchestrators: [URL: SteamClientOrchestrator] = [:]
    private var cancellables: Set<AnyCancellable> = []
    private var programLaunching: Set<URL> = []
    private var steamLaunching: [URL: Set<Int>] = [:]
    private var steamRunning: [URL: Set<Int>] = [:]
    private var steamClientRunning: Set<URL> = []
    private var migrationState: String = "notNeeded"
    private var migrationReason: String?
    private var stateBroadcastScheduled = false

    private lazy var gameDBBySteamId: [Int: GameDBEntry] = Dictionary(
        GameDBLoader.loadDefaults().compactMap { entry in entry.steamAppId.map { ($0, entry) } },
        uniquingKeysWith: { first, _ in first }
    )

    var bottlePaths: [URL] {
        get { bottleData.paths }
        set { bottleData.paths = newValue }
    }

    func bottle(for url: URL) -> Bottle? {
        bottles.first(where: { $0.url.standardizedFileURL == url.standardizedFileURL })
    }

    init(writer: BridgeWriter) {
        self.writer = writer
        self.defaults = UserDefaults(suiteName: Bundle.gmacBundleIdentifier) ?? .standard
        reloadBottles()
    }

    func loadBottles() {
        reloadBottles()
    }

    private func reloadBottles() {
        let inFlight = Dictionary(
            bottles.filter(\.inFlight).map { ($0.url.standardizedFileURL, $0) }
        ) { first, _ in first }
        bottleData = BottleData()
        bottles = bottleData.loadBottles().map { inFlight[$0.url.standardizedFileURL] ?? $0 }
        let d3dMetalInstalled = GmacWineInstaller.isD3DMetalInstalled()
        for bottle in bottles where bottle.isAvailable && !bottle.inFlight {
            LauncherBackendMigration.migrateIfNeeded(bottle, d3dMetalInstalled: d3dMetalInstalled)
        }
        for bottle in bottles where bottle.isAvailable {
            ensureOrchestratorTracking(for: bottle)
        }
    }

    private func scheduleStateChanged(_ reason: String) {
        guard !stateBroadcastScheduled else { return }
        stateBroadcastScheduled = true
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(120))
            self.stateBroadcastScheduled = false
            self.writer.emitEvent("state_changed", payload: StateChangedEvent(reason: reason))
        }
    }

    private func ensureOrchestratorTracking(for bottle: Bottle) {
        guard SteamLibrary.detectInstall(bottleURL: bottle.url) != nil else { return }
        let orch = orchestrator(for: bottle)
        orch.startTracking(games: SteamLibrary.enumerate(bottleURL: bottle.url))
    }

    private func orchestrator(for bottle: Bottle) -> SteamClientOrchestrator {
        let key = bottle.url.standardizedFileURL
        if let existing = orchestrators[key] {
            return existing
        }
        let made = SteamClientOrchestrator(bottle: bottle, driver: WineSteamClientDriver(bottle: bottle))
        let url = bottle.url
        made.$phases
            .sink { [weak self] phases in
                self?.steamLaunching[url] = Set(phases.keys)
                self?.scheduleStateChanged("steam_phases")
            }
            .store(in: &cancellables)
        made.$runningAppIds
            .sink { [weak self] running in
                self?.steamRunning[url] = running
                self?.scheduleStateChanged("steam_running")
            }
            .store(in: &cancellables)
        made.$isClientRunning
            .sink { [weak self] running in
                if running {
                    self?.steamClientRunning.insert(url)
                } else {
                    self?.steamClientRunning.remove(url)
                }
                self?.scheduleStateChanged("steam_client")
            }
            .store(in: &cancellables)
        made.$launchError
            .compactMap { $0 }
            .sink { [weak self] err in
                self?.writer.emitEvent("toast", payload: ["style": "error", "message": err])
            }
            .store(in: &cancellables)
        orchestrators[key] = made
        return made
    }

    func handle(_ request: BridgeRequest) async {
        let params = request.params ?? [:]
        do {
            switch request.method {
            case "bootstrap":
                respond(request.id, try await handleBootstrap())
            case "runtime.status":
                respond(request.id, buildRuntimeStatus())
            case "runtime.install":
                try await handleRuntimeInstall()
                respond(request.id, buildRuntimeStatus())
            case "runtime.checkUpdates":
                let info = await GmacWineInstaller.shouldUpdateGmacWine()
                respond(request.id, RuntimeUpdateCheckDTO(
                    updateAvailable: info.0,
                    currentVersion: GmacWineInstaller.gmacWineVersion().map { "\($0)" },
                    latestVersion: "\(info.1)"
                ))
            case "runtime.uninstall":
                GmacWineInstaller.uninstall()
                respond(request.id, buildRuntimeStatus())
            case "runtime.clearShaderCaches":
                for bottle in bottles where bottle.isAvailable {
                    Wine.killBottle(bottle: bottle)
                }
                wipeShaderCaches()
                respond(request.id, EmptyResult())
            case "runtime.openLogsFolder":
                try? FileManager.default.createDirectory(at: Wine.logsFolder, withIntermediateDirectories: true)
                NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: Wine.logsFolder.path)
                respond(request.id, EmptyResult())
            case "gptk.importDmg":
                let path = try requireString(params, "path")
                respond(request.id, try await handleImportGPTK(path: path))
            case "bottles.list":
                reloadBottles()
                respond(request.id, buildBottleList())
            case "bottles.create":
                respond(request.id, try await handleCreateBottle(params))
            case "bottles.updateSettings":
                respond(request.id, try await handleUpdateBottleSettings(params))
            case "bottles.rename":
                respond(request.id, try handleRenameBottle(params))
            case "bottles.duplicate":
                respond(request.id, try await handleDuplicateBottle(params))
            case "bottles.delete":
                try await handleDeleteBottle(params)
                respond(request.id, buildBottleList())
            case "bottles.removeFromList":
                try handleRemoveFromList(params)
                respond(request.id, buildBottleList())
            case "bottles.importExisting":
                try handleImportExistingBottle(params)
                respond(request.id, buildBottleList())
            case "bottles.openCDrive":
                let bottle = try requireBottle(params)
                NSWorkspace.shared.open(bottle.url.appending(path: "drive_c"))
                respond(request.id, EmptyResult())
            case "bottles.openTerminal":
                let bottle = try requireBottle(params)
                try openTerminal(for: bottle)
                respond(request.id, EmptyResult())
            case "bottles.kill":
                let bottle = try requireBottle(params)
                Wine.killBottle(bottle: bottle)
                ProcessRegistry.shared.clearRegistry(for: bottle.url)
                scheduleStateChanged("bottle_killed")
                respond(request.id, EmptyResult())
            case "bottles.repairPrefix":
                let bottle = try requireBottle(params)
                _ = try await Wine.repairPrefix(bottle: bottle)
                respond(request.id, ["valid": WinePrefixValidation.validatePrefix(for: bottle).isValid])
            case "bottles.runTool":
                let bottle = try requireBottle(params)
                let tool = try requireString(params, "tool")
                try await runWindowsTool(tool, in: bottle)
                respond(request.id, EmptyResult())
            case "bottles.orphans":
                let orphans = bottleData.orphanedBottles().map {
                    OrphanedBottleDTO(url: $0.url.path(percentEncoded: false), name: $0.name)
                }
                respond(request.id, orphans)
            case "bottles.reimportOrphans":
                for orphan in bottleData.orphanedBottles() {
                    _ = bottleData.registerBottlePath(orphan.url)
                }
                reloadBottles()
                respond(request.id, buildBottleList())
            case "bottles.legacyWhisky":
                let legacy = LegacyBottleImport.importableBottles(existingPaths: bottleData.paths).map {
                    LegacyBottleDTO(url: $0.url.path(percentEncoded: false), name: $0.name)
                }
                respond(request.id, legacy)
            case "library.load":
                respond(request.id, await handleLoadLibrary())
            case "library.launch":
                try handleLibraryLaunch(params)
                respond(request.id, EmptyResult())
            case "library.stop":
                try await handleLibraryStop(params)
                respond(request.id, EmptyResult())
            case "library.sendToSteam":
                let bottle = try requireBottle(params, key: "bottleUrl")
                let argument = try requireString(params, "argument")
                try SteamLauncher.send(argument, bottle: bottle)
                respond(request.id, EmptyResult())
            case "library.toggleFasterMode":
                let bottle = try requireBottle(params, key: "bottleUrl")
                let appId = try requireInt(params, "appId")
                let faster = params["faster"]?.bool ?? !bottle.settings.fasterSteamApps.contains(appId)
                if faster {
                    bottle.settings.fasterSteamApps.insert(appId)
                } else {
                    bottle.settings.fasterSteamApps.remove(appId)
                }
                bottle.saveBottleSettings()
                respond(request.id, ["fasterMode": faster])
            case "library.addToDock":
                try await handleAddToDock(params)
                respond(request.id, EmptyResult())
            case "library.unpin":
                let bottle = try requireBottle(params, key: "bottleUrl")
                let programPath = try requireString(params, "programPath")
                let targetURL = URL(fileURLWithPath: programPath)
                bottle.settings.pins.removeAll { $0.url?.standardizedFileURL == targetURL.standardizedFileURL }
                if let program = bottle.programs.first(where: { $0.url.standardizedFileURL == targetURL.standardizedFileURL }) {
                    program.pinned = false
                }
                bottle.saveBottleSettings()
                respond(request.id, EmptyResult())
            case "library.showInFinder":
                let path = try requireString(params, "path")
                NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: path)])
                respond(request.id, EmptyResult())
            case "programs.list":
                let bottle = try requireBottle(params)
                respond(request.id, await handleListPrograms(in: bottle))
            case "programs.run":
                try handleRunProgram(params)
                respond(request.id, EmptyResult())
            case "programs.runFile":
                try await handleRunFile(params)
                respond(request.id, EmptyResult())
            case "programs.togglePin":
                let bottle = try requireBottle(params)
                let programPath = try requireString(params, "programPath")
                let pinned = params["pinned"]?.bool ?? true
                respond(request.id, ["pinned": handleTogglePin(bottle: bottle, programPath: programPath, pinned: pinned)])
            case "programs.updateSettings":
                try handleUpdateProgramSettings(params)
                respond(request.id, EmptyResult())
            case "processes.list":
                respond(request.id, await handleListProcesses())
            case "processes.kill":
                let bottle = try requireBottle(params)
                let pid = Int32(try requireInt(params, "pid"))
                await Wine.forceKillProcess(winePID: pid, bottle: bottle)
                respond(request.id, EmptyResult())
            case "processes.killAll":
                for bottle in bottles where bottle.isAvailable {
                    Wine.killBottle(bottle: bottle)
                    ProcessRegistry.shared.clearRegistry(for: bottle.url)
                }
                Wine.killServerlessEngineProcesses()
                respond(request.id, EmptyResult())
            case "steam.setupStatus":
                respond(request.id, buildSteamSetupStatus())
            case "steam.install":
                let bottle = try requireBottle(params)
                try await SteamInstaller.install(in: bottle)
                reloadBottles()
                respond(request.id, buildSteamSetupStatus())
            case "steam.open":
                let bottle = try requireBottle(params)
                SteamInstaller.open(in: bottle)
                respond(request.id, EmptyResult())
            case "statistics.load":
                respond(request.id, await handleLoadStatistics())
            case "gamedb.list":
                let bottleUrl = params["bottleUrl"]?.string
                respond(request.id, handleListGameDB(bottlePath: bottleUrl))
            case "gamedb.apply":
                try handleApplyGameDB(params)
                respond(request.id, EmptyResult())
            case "gamedb.revert":
                let bottle = try requireBottle(params)
                try handleRevertGameDB(bottle: bottle)
                respond(request.id, EmptyResult())
            case "diagnostics.stabilityReport":
                let bottle = try requireBottle(params)
                let report = await StabilityDiagnostics.generateDiagnosticReport(for: bottle)
                respond(request.id, ["report": report])
            case "diagnostics.audioStatus":
                respond(request.id, await handleAudioStatus())
            case "diagnostics.listLogs":
                respond(request.id, handleListLogs())
            case "diagnostics.readLog":
                let path = try requireString(params, "path")
                respond(request.id, ["text": readLogTail(at: URL(fileURLWithPath: path))])
            case "diagnostics.classifyLog":
                let path = try requireString(params, "path")
                respond(request.id, await handleClassifyLog(at: URL(fileURLWithPath: path)))
            case "prefs.get":
                respond(request.id, buildPrefs())
            case "prefs.set":
                respond(request.id, handleUpdatePrefs(params))
            case "app.quitCheck":
                let active = bottles.reduce(0) { $0 + ProcessRegistry.shared.getProcessCount(for: $1) }
                respond(request.id, ["runningCount": active])
            case "app.prepareQuit":
                await ProcessRegistry.shared.cleanupAll(bottles: bottles, force: false)
                for bottle in bottles where bottle.isAvailable {
                    if bottle.settings.killOnQuit != .neverKill {
                        Wine.killBottleAndWait(bottle: bottle, timeout: 3)
                    }
                }
                respond(request.id, EmptyResult())
            default:
                respondError(request.id, "Unknown method: \(request.method)")
            }
        } catch {
            respondError(request.id, error.localizedDescription)
        }
    }

    private func respond<T: Encodable>(_ id: UInt64, _ payload: T) {
        writer.send(BridgeResponse(id: id, ok: true, result: payload, error: nil))
    }

    private func respondError(_ id: UInt64, _ message: String) {
        writer.send(BridgeResponse<EmptyResult>(id: id, ok: false, result: nil, error: message))
    }

    // MARK: - Bootstrap & Runtime

    private func handleBootstrap() async throws -> RuntimeStatusDTO {
        let skipMigration = ProcessInfo.processInfo.environment["GMAC_BRIDGE_SKIP_MIGRATION"] == "1"
        if !skipMigration {
            switch WhiskyBuildMigration.runIfNeeded(defaults: defaults) {
            case .notNeeded:
                migrationState = "notNeeded"
            case .migrated:
                migrationState = "migrated"
                reloadBottles()
            case let .blocked(reason):
                migrationState = "blocked"
                migrationReason = reason
            case let .failed(reason):
                migrationState = "failed"
                migrationReason = reason
            }
        }

        let bottleURLs = bottles.map(\.url)
        Task.detached(priority: .background) {
            GPTKImporter.verifyStoredPayload()
            GPTKImporter.ensureMetalFXBridgeInstalled()
            GPTKImporter.ensureNVAPIBridgeInstalled()
            GPTKImporter.ensureVideoProcessorInstalled(bottles: bottleURLs)
        }

        syncWineGameModeDefaults()
        WineGameMode.apply()
        deleteOldLogs()

        let openSteam = defaults.bool(forKey: "openSteamAtLaunch")
        if openSteam,
           let steamBottle = SteamInstaller.steamBottle(in: bottles.filter(\.isAvailable)) {
            Task {
                let running = await WineSteamClientDriver(bottle: steamBottle)
                    .hostWineImageNames().contains("steam.exe")
                if !running {
                    SteamInstaller.open(in: steamBottle)
                }
            }
        }

        return buildRuntimeStatus()
    }

    private func buildRuntimeStatus() -> RuntimeStatusDTO {
        let installed = GmacWineInstaller.isGmacWineInstalled()
        let version = GmacWineInstaller.gmacWineVersion().map { "\($0)" }
        let dxmt = GmacWineInstaller.gmacWineDXMTVersion()
        let dxvk = GmacWineInstaller.gmacWineDXVKVersion()
        let d3dMetal = GmacWineInstaller.isD3DMetalInstalled()
        let gptkRecord = GPTKImporter.storedRecord()
        let defaultDir = currentDefaultBottleDir().path(percentEncoded: false)
        let logsSize = RunLogStore.totalLogSize(in: Wine.logsFolder)

        return RuntimeStatusDTO(
            wineInstalled: installed,
            wineVersion: version,
            dxmtVersion: dxmt,
            dxvkVersion: dxvk,
            d3dMetalInstalled: d3dMetal,
            gptkVersion: gptkRecord?.gptkVersion,
            gmacD3D12Available: GmacD3D12.isAvailable(),
            rosettaInstalled: Rosetta2.isRosettaInstalled,
            defaultBottleDir: defaultDir,
            logsDir: Wine.logsFolder.path(percentEncoded: false),
            logsBytes: logsSize,
            gptkStorePresent: gptkRecord != nil,
            migrationState: migrationState,
            migrationReason: migrationReason,
            runtimeTag: DistributionConfig.gamingRuntime.tag
        )
    }

    private func handleRuntimeInstall() async throws {
        guard let url = URL(string: DistributionConfig.gamingRuntimeURL) else {
            throw BridgeError("Invalid runtime download URL")
        }

        writer.emitEvent("runtime_progress", payload: RuntimeProgressEvent(
            phase: "downloading",
            progress: 0.05,
            detail: "Downloading GmacWine \(DistributionConfig.gamingRuntime.tag)..."
        ))

        let delegate = DownloadProgressDelegate { [weak self] progress in
            self?.writer.emitEvent("runtime_progress", payload: RuntimeProgressEvent(
                phase: "downloading",
                progress: max(0.05, min(0.80, progress * 0.80)),
                detail: "Downloading GmacWine (\(Int(progress * 100))%)"
            ))
        }
        let session = URLSession(configuration: .default, delegate: delegate, delegateQueue: nil)
        defer { session.finishTasksAndInvalidate() }

        let (tempURL, response) = try await session.download(from: url)
        defer { try? FileManager.default.removeItem(at: tempURL) }

        if let http = response as? HTTPURLResponse, http.statusCode != 200 {
            throw BridgeError("Runtime download failed with HTTP \(http.statusCode)")
        }

        writer.emitEvent("runtime_progress", payload: RuntimeProgressEvent(
            phase: "verifying",
            progress: 0.85,
            detail: "Verifying SHA-256 checksum..."
        ))

        let integrity = GmacWineInstaller.integrityResult(
            forFileAt: tempURL,
            expectedSHA256: DistributionConfig.gamingRuntime.sha256
        )
        switch integrity {
        case .match:
            break
        case let .mismatch(actual):
            throw BridgeError("Downloaded runtime checksum mismatch: \(actual)")
        case .unreadable:
            throw BridgeError("Downloaded runtime archive could not be read")
        }

        writer.emitEvent("runtime_progress", payload: RuntimeProgressEvent(
            phase: "installing",
            progress: 0.92,
            detail: "Extracting Wine runtime..."
        ))

        try GmacWineInstaller.install(from: tempURL)
        _ = GPTKImporter.deployStoredPayloadIfCapable()
        reloadBottles()

        writer.emitEvent("runtime_progress", payload: RuntimeProgressEvent(
            phase: "done",
            progress: 1.0,
            detail: "GmacWine installed"
        ))
    }

    private func handleImportGPTK(path: String) async throws -> RuntimeStatusDTO {
        let url = URL(fileURLWithPath: path)
        var mounts: [URL] = []
        defer {
            for mount in mounts.reversed() {
                detachDiskImage(mount)
            }
        }

        let libRoot: URL
        if url.pathExtension.lowercased() == "dmg" {
            let outer = try attachDiskImage(url)
            mounts.append(outer)
            if let found = GPTKImporter.locatePayload(under: outer) {
                libRoot = found
            } else {
                let entries = (try? FileManager.default.contentsOfDirectory(
                    at: outer,
                    includingPropertiesForKeys: nil
                )) ?? []
                var nestedFound: URL?
                for item in entries where item.pathExtension.lowercased() == "dmg" {
                    let inner = try attachDiskImage(item)
                    mounts.append(inner)
                    if let found = GPTKImporter.locatePayload(under: inner) {
                        nestedFound = found
                        break
                    }
                }
                guard let resolved = nestedFound else {
                    throw GPTKImportError.payloadNotFound
                }
                libRoot = resolved
            }
        } else {
            guard let found = GPTKImporter.locatePayload(under: url) else {
                throw GPTKImportError.payloadNotFound
            }
            libRoot = found
        }

        let payload = try GPTKImporter.validatePayload(at: libRoot)
        try GPTKImporter.importPayload(payload)
        if GPTKImporter.isRuntimeGPTKCapable() {
            try GPTKImporter.deployStoredPayload()
        }
        reloadBottles()
        return buildRuntimeStatus()
    }

    // MARK: - Bottles

    private func buildBottleList() -> [BottleDTO] {
        bottles.map(makeBottleDTO)
    }

    private func makeBottleDTO(_ bottle: Bottle) -> BottleDTO {
        let steamInstalled = SteamLibrary.detectInstall(bottleURL: bottle.url) != nil
        let games = steamInstalled ? SteamLibrary.enumerate(bottleURL: bottle.url) : []
        let resolvedBackend = GraphicsBackendResolver.resolve().displayName
        return BottleDTO(
            url: bottle.url.path(percentEncoded: false),
            name: bottle.settings.name,
            isAvailable: bottle.isAvailable,
            inFlight: bottle.inFlight,
            steamInstalled: steamInstalled,
            steamRunning: steamClientRunning.contains(bottle.url),
            runningProcessCount: ProcessRegistry.shared.getProcessCount(for: bottle),
            pinnedCount: bottle.settings.pins.count,
            gameCount: games.count,
            resolvedBackend: resolvedBackend,
            settings: makeBottleSettingsDTO(bottle.settings)
        )
    }

    private func handleCreateBottle(_ params: [String: AnyCodable]) async throws -> BottleDTO {
        let name = try requireString(params, "name").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else {
            throw BridgeError("PC name cannot be empty")
        }
        guard GmacWineInstaller.isGmacWineInstalled() else {
            throw BridgeError("Wine runtime is not installed. Install GmacWine first.")
        }

        let winRaw = params["windowsVersion"]?.string ?? defaultWinVersionRaw()
        let winVersion = WinVersion(rawValue: winRaw) ?? .win10
        let parentURL = params["location"]?.string.map(URL.init(fileURLWithPath:)) ?? currentDefaultBottleDir()

        let validation = BottleLocationValidation.validate(at: parentURL)
        switch validation {
        case .valid:
            break
        case let .notWritable(path):
            throw BridgeError("Location is not writable: \(path)")
        case let .accessDenied(path):
            throw BridgeError("Access denied for location: \(path)")
        case let .insufficientSpace(available, required):
            let availStr = ByteCountFormatter.string(fromByteCount: available, countStyle: .file)
            let reqStr = ByteCountFormatter.string(fromByteCount: required, countStyle: .file)
            throw BridgeError("Not enough free space (\(availStr) available, \(reqStr) required)")
        }

        let newDir = parentURL.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: newDir, withIntermediateDirectories: true)

        let bottle = Bottle(bottleUrl: newDir, inFlight: true, isAvailable: false)
        bottle.settings.windowsVersion = winVersion
        bottle.settings.name = name
        bottles.append(bottle)

        do {
            _ = try await Wine.runWine(["winecfg", "-v", winVersion.rawValue], bottle: bottle)
            let wineVer = try await Wine.wineVersion()
            bottle.settings.wineVersion = SemanticVersion(wineVer) ?? SemanticVersion(0, 0, 0)
            BottleFontBootstrap.copySystemFonts(toPrefix: bottle.url)
            bottle.saveBottleSettings()
            guard bottleData.registerBottlePath(newDir) else {
                throw BridgeError("Failed to register the new PC in BottleVM.plist")
            }
            bottle.isAvailable = true
            bottle.inFlight = false
            reloadBottles()
            return makeBottleDTO(bottle)
        } catch {
            bottles.removeAll { $0.url == newDir }
            try? FileManager.default.removeItem(at: newDir)
            throw error
        }
    }

    private func handleUpdateBottleSettings(_ params: [String: AnyCodable]) async throws -> BottleDTO {
        let bottle = try requireBottle(params)
        guard let settingsVal = params["settings"] else {
            throw BridgeError("Missing settings payload")
        }
        let rawData = try JSONEncoder().encode(settingsVal)
        let incoming = try JSONDecoder().decode(BottleSettingsDTO.self, from: rawData)

        let previousWinVersion = bottle.settings.windowsVersion
        applyBottleSettingsDTO(incoming, to: &bottle.settings)
        bottle.saveBottleSettings()

        if bottle.settings.windowsVersion != previousWinVersion {
            _ = try? await Wine.runWine(
                ["winecfg", "-v", bottle.settings.windowsVersion.rawValue],
                bottle: bottle
            )
        }
        return makeBottleDTO(bottle)
    }

    private func handleRenameBottle(_ params: [String: AnyCodable]) throws -> BottleDTO {
        let bottle = try requireBottle(params)
        let newName = try requireString(params, "name").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !newName.isEmpty else {
            throw BridgeError("Name cannot be empty")
        }
        bottle.settings.name = newName
        bottle.saveBottleSettings()
        return makeBottleDTO(bottle)
    }

    private func handleDuplicateBottle(_ params: [String: AnyCodable]) async throws -> BottleDTO {
        let bottle = try requireBottle(params)
        let requested = params["name"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines)
        let nextName = (requested?.isEmpty == false)
            ? (requested ?? "")
            : BottleOperations.nextDuplicateName(
                baseName: bottle.settings.name,
                existingNames: bottles.map(\.settings.name)
            )
        let clonedURL = try await BottleOperations.duplicate(
            bottleAt: bottle.url,
            newName: nextName,
            registry: self
        )
        reloadBottles()
        guard let created = self.bottle(for: clonedURL) else {
            throw BridgeError("Duplicated PC could not be loaded")
        }
        return makeBottleDTO(created)
    }

    private func handleDeleteBottle(_ params: [String: AnyCodable]) async throws {
        let bottle = try requireBottle(params)
        let moveToTrash = params["moveToTrash"]?.bool ?? true
        if await Wine.isWineserverRunning(for: bottle)
            || ProcessRegistry.shared.getProcessCount(for: bottle) > 0 {
            Wine.killBottle(bottle: bottle)
            try? await Task.sleep(for: .seconds(1))
            ProcessRegistry.shared.clearRegistry(for: bottle.url)
        }
        if moveToTrash {
            let bottleURL = bottle.url
            try await Task.detached {
                try FileManager.default.trashItem(at: bottleURL, resultingItemURL: nil)
            }.value
            GameRouting().removeRoutes(toBottle: bottle.url)
            BottleOperations.remove(bottleAt: bottle.url, deleteFiles: false, registry: self)
        } else {
            BottleOperations.remove(bottleAt: bottle.url, deleteFiles: false, registry: self)
        }
        reloadBottles()
    }

    private func handleRemoveFromList(_ params: [String: AnyCodable]) throws {
        let bottle = try requireBottle(params)
        BottleOperations.remove(bottleAt: bottle.url, deleteFiles: false, registry: self)
        reloadBottles()
    }

    private func handleImportExistingBottle(_ params: [String: AnyCodable]) throws {
        let path = try requireString(params, "path")
        let url = URL(fileURLWithPath: path)
        let metadata = url.appending(path: "Metadata.plist")
        guard FileManager.default.fileExists(atPath: metadata.path(percentEncoded: false)) else {
            throw BridgeError("Selected folder does not contain a Metadata.plist bottle file")
        }
        _ = bottleData.registerBottlePath(url)
        reloadBottles()
    }

    // MARK: - Library

    private func handleLoadLibrary() async -> LibraryPayloadDTO {
        reloadBottles()
        let available = bottles.filter(\.isAvailable)
        let showBottleName = available.count > 1
        let routed = GameRouting().lastLaunches()

        var panels: [SteamPanelDTO] = []
        var games: [LibraryItemDTO] = []
        var otherApps: [LibraryItemDTO] = []

        for bottle in available.sorted() {
            let url = bottle.url
            let pinned = PinnedLibrarySource.items(inBottleAt: url, settings: bottle.settings)
            let steamEntries = SteamLibrarySource.entries(inBottleAt: url)
            let installedSteam = SteamLibrary.enumerate(bottleURL: url)
            let steamByAppId = Dictionary(installedSteam.map { ($0.appId, $0) }) { first, _ in first }

            if SteamLibrary.detectInstall(bottleURL: url) != nil || !steamEntries.isEmpty {
                let steamLauncherIcon = pinned.first(where: { $0.launcher == .steam })?.iconURL
                let panelIconPath = await BridgeIconExporter.shared.exportIconPath(for: steamLauncherIcon)
                let totalBytes = installedSteam.compactMap(\.manifest.sizeOnDisk).reduce(0, +)
                panels.append(SteamPanelDTO(
                    bottleUrl: url.path(percentEncoded: false),
                    bottleName: showBottleName ? bottle.settings.name : nil,
                    iconPath: panelIconPath,
                    isRunning: steamClientRunning.contains(url),
                    gameCount: installedSteam.count,
                    sizeOnDisk: totalBytes
                ))
            }

            for item in LibraryCatalogue.merge([pinned, steamEntries]) {
                var steamGame: SteamGame?
                var appIdValue: Int?
                var programPathValue: String?
                var launchKind = "program"
                var lastPlayed: Date?
                var fasterMode = false

                switch item.launch {
                case let .steam(appId):
                    launchKind = "steam"
                    appIdValue = appId
                    steamGame = steamByAppId[appId]
                    lastPlayed = [routed[appId], steamGame?.manifest.lastPlayed].compactMap { $0 }.max()
                    fasterMode = bottle.settings.fasterSteamApps.contains(appId)
                case let .program(progURL):
                    launchKind = "program"
                    programPathValue = progURL.path(percentEncoded: false)
                    lastPlayed = RunLogStore.load(
                        for: progURL.lastPathComponent,
                        in: url
                    ).entries.map(\.startTime).max()
                }

                let stateStr: String = {
                    switch item.launch {
                    case let .program(progURL):
                        return programLaunching.contains(progURL) ? "launching" : "idle"
                    case let .steam(appId):
                        if steamRunning[url]?.contains(appId) == true { return "running" }
                        if steamLaunching[url]?.contains(appId) == true { return "launching" }
                        return "idle"
                    }
                }()

                let artworkPath = item.artworkURL?.path(percentEncoded: false)
                let iconPath = await BridgeIconExporter.shared.exportIconPath(for: item.iconURL)
                let warning = compatibilityWarning(for: item)

                let dto = LibraryItemDTO(
                    id: item.id,
                    name: item.launcher?.displayName ?? item.name,
                    bottleUrl: url.path(percentEncoded: false),
                    bottleName: showBottleName ? bottle.settings.name : nil,
                    source: item.source.rawValue,
                    launchKind: launchKind,
                    appId: appIdValue,
                    programPath: programPathValue,
                    isLauncher: item.isLauncher,
                    artworkPath: artworkPath,
                    iconPath: iconPath,
                    lastPlayedEpoch: lastPlayed?.timeIntervalSince1970,
                    sizeOnDisk: steamGame?.manifest.sizeOnDisk,
                    installPath: steamGame?.installURL.path(percentEncoded: false),
                    state: stateStr,
                    fasterMode: fasterMode,
                    compatibilityWarning: warning?.label,
                    compatibilityDetail: warning?.detail
                )

                if item.source == .steam && !item.isLauncher {
                    games.append(dto)
                } else if item.launcher != .steam {
                    otherApps.append(dto)
                }
            }
        }

        return LibraryPayloadDTO(steamPanels: panels, games: games, otherApps: otherApps)
    }

    private func compatibilityWarning(for item: LibraryEntry) -> (label: String, detail: String)? {
        guard case let .steam(appId) = item.launch,
              let entry = gameDBBySteamId[appId]
        else { return nil }
        let broken = entry.rating == .broken || entry.rating == .notSupported
        if let antiCheat = entry.antiCheat {
            let label = broken ? "Won't run" : "Offline only"
            let detail = "\(entry.title) uses \(antiCheat) anti-cheat, which blocks Wine. "
                + (broken ? "It does not start on Mac." : "Online modes may not work.")
            return (label, detail)
        } else if broken {
            return ("Known issues", "\(entry.title) has known compatibility issues.")
        }
        return nil
    }

    private func handleLibraryLaunch(_ params: [String: AnyCodable]) throws {
        let bottle = try requireBottle(params, key: "bottleUrl")
        let kind = try requireString(params, "launchKind")
        if kind == "steam" {
            let appId = try requireInt(params, "appId")
            let games = SteamLibrary.enumerate(bottleURL: bottle.url)
            guard let game = games.first(where: { $0.appId == appId }) else {
                throw BridgeError("Steam game not found in bottle")
            }
            if !GPTKImporter.isDeployed(),
               GraphicsAPIDetector.detect(executables: SteamLibrary.executableURLs(under: game.installURL)) == .d3d12 {
                writer.emitEvent("toast", payload: [
                    "style": "warning",
                    "message": "\(game.name) uses DirectX 12 and performs best with Apple D3DMetal imported."
                ])
            }
            orchestrator(for: bottle).launch(game)
        } else {
            let programPath = try requireString(params, "programPath")
            launchExecutable(at: URL(fileURLWithPath: programPath), in: bottle)
        }
    }

    private func handleLibraryStop(_ params: [String: AnyCodable]) async throws {
        let bottle = try requireBottle(params, key: "bottleUrl")
        let appId = try requireInt(params, "appId")
        let games = SteamLibrary.enumerate(bottleURL: bottle.url)
        guard let game = games.first(where: { $0.appId == appId }) else { return }
        await orchestrator(for: bottle).stop(game)
    }

    private func handleAddToDock(_ params: [String: AnyCodable]) async throws {
        let bottle = try requireBottle(params, key: "bottleUrl")
        let name = try requireString(params, "name")
        let launchKind = try requireString(params, "launchKind")

        let target: ShortcutCreator.LiveTarget
        var iconSourceURL: URL?
        if launchKind == "steam" {
            let appId = try requireInt(params, "appId")
            target = .steamGame(appId: appId)
            if let steamRoot = SteamLibrary.detectInstall(bottleURL: bottle.url) {
                iconSourceURL = SteamLibrarySource.iconArtworkURL(appID: appId, steamRoot: steamRoot)
                    ?? SteamLibrarySource.iconURL(appID: appId, steamRoot: steamRoot)
            }
        } else {
            let path = try requireString(params, "programPath")
            let url = URL(fileURLWithPath: path)
            target = ShortcutCreator.liveTarget(for: url, bottle: bottle)
            iconSourceURL = url
        }

        let applicationsDir = FileManager.default.homeDirectoryForCurrentUser.appending(path: "Applications")
        try FileManager.default.createDirectory(at: applicationsDir, withIntermediateDirectories: true)
        let safe = name.replacingOccurrences(of: "/", with: "-").replacingOccurrences(of: ":", with: "-")
        let appURL = applicationsDir.appending(path: "\(safe).app")
        if FileManager.default.fileExists(atPath: appURL.path(percentEncoded: false)) {
            try FileManager.default.removeItem(at: appURL)
        }
        try ShortcutCreator.createShortcutBundle(
            at: appURL,
            launchScript: ShortcutCreator.liveLaunchScript(for: target),
            name: name
        )

        if let iconURL = iconSourceURL,
           let exported = await BridgeIconExporter.shared.exportIconPath(for: iconURL),
           let image = NSImage(contentsOfFile: exported) {
            NSWorkspace.shared.setIcon(image, forFile: appURL.path(percentEncoded: false))
        }

        let domain = "com.apple.dock" as CFString
        let key = "persistent-apps" as CFString
        var tiles = CFPreferencesCopyAppValue(key, domain) as? [[String: Any]] ?? []
        let urlString = appURL.absoluteString
        let exists = tiles.contains { tile in
            let data = tile["tile-data"] as? [String: Any]
            let file = data?["file-data"] as? [String: Any]
            return (file?["_CFURLString"] as? String)?.trimmingCharacters(in: ["/"])
                == urlString.trimmingCharacters(in: ["/"])
        }
        if !exists {
            tiles.append([
                "tile-type": "file-tile",
                "tile-data": [
                    "file-label": name,
                    "file-data": ["_CFURLString": urlString, "_CFURLStringType": 15]
                ]
            ])
            CFPreferencesSetAppValue(key, tiles as CFArray, domain)
            CFPreferencesAppSynchronize(domain)
        }
        let killall = Process()
        killall.executableURL = URL(fileURLWithPath: "/usr/bin/killall")
        killall.arguments = ["Dock"]
        try? killall.run()
    }

    // MARK: - Programs

    private func handleListPrograms(in bottle: Bottle) async -> [ProgramDTO] {
        let driveC = bottle.url.appending(path: "drive_c")
        let blocklist = Set(bottle.settings.blocklist)
        let scanned: [(url: URL, peFile: PEFile?)] = await Task.detached(priority: .userInitiated) {
            Bottle.discoverInstalledExecutables(driveC: driveC, blocklist: blocklist)
                .map { (url: $0, peFile: try? PEFile(url: $0)) }
        }.value

        var seen: Set<URL> = []
        var programs: [Program] = []
        for entry in scanned {
            seen.insert(entry.url)
            programs.append(Program(url: entry.url, bottle: bottle, peFile: entry.peFile))
        }
        for pin in bottle.settings.pins {
            guard let url = pin.url, !seen.contains(url),
                  FileManager.default.fileExists(atPath: url.path(percentEncoded: false))
            else { continue }
            programs.append(Program(url: url, bottle: bottle))
        }
        programs.sort { $0.name.lowercased() < $1.name.lowercased() }
        bottle.programs = programs

        var results: [ProgramDTO] = []
        for prog in programs {
            let iconPath = await BridgeIconExporter.shared.exportIconPath(for: prog.url)
            let ov = prog.settings.overrides ?? ProgramOverrides()
            results.append(ProgramDTO(
                name: prog.name,
                url: prog.url.path(percentEncoded: false),
                pinned: prog.pinned,
                iconPath: iconPath,
                arguments: prog.settings.arguments,
                locale: prog.settings.locale.rawValue,
                environment: prog.settings.environment,
                overrides: ProgramOverridesDTO(
                    graphicsBackend: ov.graphicsBackend?.rawValue,
                    dxvkAsync: ov.dxvkAsync,
                    dxvkHud: ov.dxvkHud.map(encodeDXVKHUD),
                    enhancedSync: ov.enhancedSync.map(encodeEnhancedSync),
                    metal4Enabled: ov.metal4Enabled,
                    shaderCacheEnabled: ov.shaderCacheEnabled,
                    virtualDesktopEnabled: ov.virtualDesktopEnabled,
                    controllerCompatibilityMode: ov.controllerCompatibilityMode
                )
            ))
        }
        return results
    }

    private func handleRunProgram(_ params: [String: AnyCodable]) throws {
        let bottle = try requireBottle(params)
        let path = try requireString(params, "programPath")
        launchExecutable(at: URL(fileURLWithPath: path), in: bottle)
    }

    private func handleRunFile(_ params: [String: AnyCodable]) async throws {
        let bottle = try requireBottle(params)
        let path = try requireString(params, "path")
        let url = URL(fileURLWithPath: path)
        LauncherFixes.detectAndApply(from: url, for: bottle)
        if url.pathExtension.lowercased() == "bat" {
            _ = try await Wine.runBatchFile(url: url, bottle: bottle)
        } else {
            _ = try await Wine.runProgram(at: url, bottle: bottle)
        }
    }

    private func launchExecutable(at url: URL, in bottle: Bottle) {
        programLaunching.insert(url)
        scheduleStateChanged("program_launching")
        LauncherFixes.detectAndApply(from: url, for: bottle)
        let program = bottle.programs.first(where: { $0.url.standardizedFileURL == url.standardizedFileURL })
            ?? Program(url: url, bottle: bottle)
        Task {
            defer {
                programLaunching.remove(url)
                scheduleStateChanged("program_finished")
            }
            do {
                let args = program.settings.arguments
                    .split(separator: " ")
                    .map(String.init)
                let result = try await program.launch(args: args)
                if result.exitCode != 0,
                   let diagnosis = await Wine.classifyLastRun(
                       logFileURL: result.logFileURL,
                       exitCode: result.exitCode
                   ),
                   !diagnosis.isEmpty {
                    writer.emitEvent("crash_detected", payload: [
                        "programName": url.deletingPathExtension().lastPathComponent,
                        "headline": diagnosis.headline ?? "Crash detected",
                        "logPath": result.logFileURL.path(percentEncoded: false)
                    ])
                }
            } catch {
                writer.emitEvent("toast", payload: [
                    "style": "error",
                    "message": error.localizedDescription
                ])
            }
        }
    }

    private func handleTogglePin(bottle: Bottle, programPath: String, pinned: Bool) -> Bool {
        let url = URL(fileURLWithPath: programPath)
        if let existing = bottle.programs.first(where: { $0.url.standardizedFileURL == url.standardizedFileURL }) {
            existing.pinned = pinned
        } else if pinned {
            if !bottle.settings.pins.contains(where: { $0.url?.standardizedFileURL == url.standardizedFileURL }) {
                let title = url.deletingPathExtension().lastPathComponent
                bottle.settings.pins.append(PinnedProgram(name: title, url: url))
            }
        } else {
            bottle.settings.pins.removeAll { $0.url?.standardizedFileURL == url.standardizedFileURL }
        }
        bottle.saveBottleSettings()
        return pinned
    }

    private func handleUpdateProgramSettings(_ params: [String: AnyCodable]) throws {
        let bottle = try requireBottle(params)
        let programPath = try requireString(params, "programPath")
        let url = URL(fileURLWithPath: programPath)
        let program = bottle.programs.first(where: { $0.url.standardizedFileURL == url.standardizedFileURL })
            ?? Program(url: url, bottle: bottle)

        var settings = program.settings
        if let args = params["arguments"]?.string {
            settings.arguments = args
        }
        if let localeRaw = params["locale"]?.string {
            settings.locale = Locales(rawValue: localeRaw) ?? .auto
        }
        if let ovVal = params["overrides"] {
            let data = try JSONEncoder().encode(ovVal)
            let ovDTO = try JSONDecoder().decode(ProgramOverridesDTO.self, from: data)
            var overrides = settings.overrides ?? ProgramOverrides()
            overrides.graphicsBackend = ovDTO.graphicsBackend.flatMap(GraphicsBackend.init(rawValue:))
            overrides.dxvkAsync = ovDTO.dxvkAsync
            overrides.dxvkHud = ovDTO.dxvkHud.map(decodeDXVKHUD)
            overrides.enhancedSync = ovDTO.enhancedSync.map(decodeEnhancedSync)
            overrides.metal4Enabled = ovDTO.metal4Enabled
            overrides.shaderCacheEnabled = ovDTO.shaderCacheEnabled
            overrides.virtualDesktopEnabled = ovDTO.virtualDesktopEnabled
            overrides.controllerCompatibilityMode = ovDTO.controllerCompatibilityMode
            settings.overrides = overrides.isEmpty ? nil : overrides
        }
        program.settings = settings
    }

    // MARK: - Processes

    private func handleListProcesses() async -> [ProcessDTO] {
        var result: [ProcessDTO] = []
        for bottle in bottles where bottle.isAvailable {
            guard await Wine.isWineserverRunning(for: bottle) else { continue }
            let procs = (try? await Wine.listProcesses(for: bottle)) ?? []
            for proc in procs where proc.kind != .system {
                result.append(ProcessDTO(
                    pid: proc.winePID,
                    name: proc.imageName,
                    memoryUsage: proc.memoryUsage,
                    kind: proc.kind.rawValue,
                    bottleUrl: bottle.url.path(percentEncoded: false),
                    bottleName: bottle.settings.name
                ))
            }
        }
        return result
    }

    // MARK: - Steam Setup

    private func buildSteamSetupStatus() -> SteamSetupStatusDTO {
        let available = bottles.filter(\.isAvailable)
        let steamBottle = SteamInstaller.steamBottle(in: available)
            ?? available.first { $0.settings.name == "Steam" }
        let steamInstalled = steamBottle.map(SteamInstaller.isInstalled(in:)) ?? false
        let gameCount = steamBottle.map { SteamLibrary.enumerate(bottleURL: $0.url).count } ?? 0
        let chosenKey = steamBottle.map { "steamGraphicsChosen.\($0.url.lastPathComponent)" }
        let chosen = chosenKey.map { defaults.bool(forKey: $0) } ?? false

        return SteamSetupStatusDTO(
            wineInstalled: GmacWineInstaller.isGmacWineInstalled(),
            bottleUrl: steamBottle?.url.path(percentEncoded: false),
            bottleName: steamBottle?.settings.name,
            bottleInFlight: steamBottle?.inFlight ?? false,
            graphicsBackend: steamBottle?.settings.graphicsBackend.rawValue,
            graphicsChosen: chosen,
            d3dMetalInstalled: GmacWineInstaller.isD3DMetalInstalled(),
            steamInstalled: steamInstalled,
            installedGameCount: gameCount
        )
    }

    // MARK: - Statistics

    private func handleLoadStatistics() async -> StatisticsPayloadDTO {
        let available = bottles.filter(\.isAvailable)
        let showBottleName = available.count > 1
        let twoWeeksAgo = Date.now.addingTimeInterval(-14 * 24 * 3_600)

        var stats: [GameStatDTO] = []
        var totalPlaytime: Double = 0
        var totalRecent: Double = 0
        var totalStorage: Int64 = 0
        var lastPlayedBest: (name: String, date: Date)?
        var longestSessionBest: (name: String, length: Double)?

        for bottle in available {
            let url = bottle.url
            let bottleName = showBottleName ? bottle.settings.name : nil
            let pinned = PinnedLibrarySource.items(inBottleAt: url, settings: bottle.settings)
            let steamGames = Dictionary(
                SteamLibrary.enumerate(bottleURL: url).map { ($0.appId, $0) }
            ) { first, _ in first }
            let steamPlaytime = SteamLibrary.detectInstall(bottleURL: url)
                .map(SteamPlaytimeReader.read(steamRoot:)) ?? [:]
            let appIDByName = Dictionary(
                steamGames.values.map { ($0.name.lowercased(), $0.appId) }
            ) { first, _ in first }

            let entries = LibraryCatalogue.merge([pinned, SteamLibrarySource.entries(inBottleAt: url)])
            for entry in entries where !entry.isLauncher {
                var appID: Int?
                var program: ProgramPlaytime?
                var programRecent: Double = 0

                switch entry.launch {
                case let .steam(id):
                    appID = id
                case let .program(programURL):
                    let file = programURL.lastPathComponent
                    program = PlaytimeStore.load(for: file, in: url)
                    programRecent = RunLogStore.load(for: file, in: url).entries.reduce(0) { sum, run in
                        guard let end = run.endTime, end > twoWeeksAgo else { return sum }
                        return sum + end.timeIntervalSince(max(run.startTime, twoWeeksAgo))
                    }
                    appID = appIDByName[entry.name.lowercased()]
                }

                let steam = appID.flatMap { steamPlaytime[$0] }
                let game = appID.flatMap { steamGames[$0] }
                let total = max(steam?.total ?? 0, program?.total ?? 0)
                let recent = max(steam?.lastTwoWeeks ?? 0, programRecent)
                let lastPlayed = [steam?.lastPlayed, program?.lastPlayed, game?.manifest.lastPlayed]
                    .compactMap { $0 }.max()
                let sizeOnDisk = game?.manifest.sizeOnDisk
                let sessions = program.flatMap { $0.sessions > 0 ? $0.sessions : nil }
                let longest = program.flatMap { $0.longestSession > 0 ? $0.longestSession : nil }

                totalPlaytime += total
                totalRecent += recent
                totalStorage += sizeOnDisk ?? 0
                if let last = lastPlayed {
                    if lastPlayedBest == nil || last > (lastPlayedBest?.date ?? .distantPast) {
                        lastPlayedBest = (entry.name, last)
                    }
                }
                if let longestVal = longest, longestVal > (longestSessionBest?.length ?? 0) {
                    longestSessionBest = (entry.name, longestVal)
                }

                let iconPath = await BridgeIconExporter.shared.exportIconPath(for: entry.iconURL)
                stats.append(GameStatDTO(
                    id: entry.id,
                    name: entry.name,
                    bottleName: bottleName,
                    artworkPath: entry.artworkURL?.path(percentEncoded: false),
                    iconPath: iconPath,
                    totalSec: total,
                    lastTwoWeeksSec: recent,
                    lastPlayedEpoch: lastPlayed?.timeIntervalSince1970,
                    sessions: sessions,
                    longestSessionSec: longest,
                    sizeOnDisk: sizeOnDisk
                ))
            }
        }

        stats.sort {
            if $0.totalSec != $1.totalSec { return $0.totalSec > $1.totalSec }
            return $0.name.localizedStandardCompare($1.name) == .orderedAscending
        }
        let played = stats.filter { $0.totalSec > 0 }
        let unplayed = stats.filter { $0.totalSec == 0 }.map(\.name)

        return StatisticsPayloadDTO(
            totalPlaytimeSec: totalPlaytime,
            lastTwoWeeksSec: totalRecent,
            storageBytes: totalStorage,
            mostPlayedName: played.first?.name,
            mostPlayedSec: played.first?.totalSec,
            lastPlayedName: lastPlayedBest?.name,
            longestSessionName: longestSessionBest?.name,
            longestSessionSec: longestSessionBest?.length,
            playedCount: played.count,
            totalGamesCount: stats.count,
            games: played,
            unplayedNames: unplayed
        )
    }

    // MARK: - GameDB Presets

    private func handleListGameDB(bottlePath: String?) -> [GameDBItemDTO] {
        let entries = GameDBLoader.loadDefaults()
        let selectedBottle = bottlePath.flatMap { bottle(for: URL(fileURLWithPath: $0)) }
        let snapshot = selectedBottle.flatMap { GameConfigSnapshot.load(from: $0.url) }

        var installedAppIds: [Int: String] = [:]
        var installedExeNames: [String: String] = [:]
        for bottle in bottles where bottle.isAvailable {
            let bPath = bottle.url.path(percentEncoded: false)
            for game in SteamLibrary.enumerate(bottleURL: bottle.url) {
                installedAppIds[game.appId] = bPath
            }
            for prog in bottle.programs {
                installedExeNames[prog.name.lowercased()] = bPath
            }
        }

        return entries.map { entry in
            var matchedBottle: String?
            if let appId = entry.steamAppId {
                matchedBottle = installedAppIds[appId]
            }
            if matchedBottle == nil, let exes = entry.exeNames {
                for exe in exes {
                    if let hit = installedExeNames[exe.lowercased()] {
                        matchedBottle = hit
                        break
                    }
                }
            }
            let variant = entry.defaultVariant
            let appliedHere = snapshot?.appliedEntryId == entry.id
            return GameDBItemDTO(
                id: entry.id,
                name: entry.title,
                subtitle: entry.subtitle,
                steamAppId: entry.steamAppId,
                rating: entry.rating.rawValue,
                notes: entry.notes ?? [],
                antiCheat: entry.antiCheat,
                defaultVariantId: variant?.id,
                defaultVariantLabel: variant?.label,
                matchedBottleUrl: matchedBottle,
                installed: matchedBottle != nil,
                appliedHere: appliedHere,
                appliedSnapshotTimestamp: appliedHere ? snapshot?.timestamp.timeIntervalSince1970 : nil
            )
        }
    }

    private func handleApplyGameDB(_ params: [String: AnyCodable]) throws {
        let bottle = try requireBottle(params)
        let entryId = try requireString(params, "entryId")
        let entries = GameDBLoader.loadDefaults()
        guard let entry = entries.first(where: { $0.id == entryId }) else {
            throw BridgeError("GameDB entry not found: \(entryId)")
        }
        let variantId = params["variantId"]?.string
        guard let variant = entry.variants.first(where: { $0.id == variantId }) ?? entry.defaultVariant else {
            throw BridgeError("No configuration variant found for \(entry.title)")
        }
        _ = try GameConfigApplicator.apply(entry: entry, variant: variant, to: bottle)
    }

    private func handleRevertGameDB(bottle: Bottle) throws {
        guard let snapshot = GameConfigSnapshot.load(from: bottle.url) else {
            throw BridgeError("No applied GameDB preset found for this PC")
        }
        _ = try GameConfigApplicator.revert(bottle: bottle, snapshot: snapshot)
    }

    // MARK: - Diagnostics & Logs

    private func handleAudioStatus() async -> AudioStatusDTO {
        let monitor = AudioDeviceMonitor()
        let device = monitor.defaultOutputDevice()
        let probe = CoreAudioDeviceProbe(monitor: monitor)
        let result = await probe.run()
        return AudioStatusDTO(
            defaultDeviceName: device?.name,
            transportType: device?.transportType.displayName,
            sampleRateHz: device?.sampleRate,
            outputChannels: device?.outputChannelCount,
            status: result.status.rawValue,
            summary: result.summary,
            findings: result.findings.map { finding in
                if let action = finding.suggestedAction {
                    return "\(finding.description) — \(action)"
                }
                return finding.description
            }
        )
    }

    private func handleListLogs() -> [LogFileDTO] {
        let keys: [URLResourceKey] = [.contentModificationDateKey, .creationDateKey, .fileSizeKey]
        guard let urls = try? FileManager.default.contentsOfDirectory(
            at: Wine.logsFolder,
            includingPropertiesForKeys: keys,
            options: [.skipsHiddenFiles]
        ) else {
            return []
        }

        return urls
            .filter { $0.pathExtension.lowercased() == "log" }
            .compactMap { url -> LogFileDTO? in
                let values = try? url.resourceValues(forKeys: Set(keys))
                let date = values?.contentModificationDate ?? values?.creationDate ?? Date.distantPast
                let size = Int64(values?.fileSize ?? 0)
                return LogFileDTO(
                    name: url.lastPathComponent,
                    path: url.path(percentEncoded: false),
                    modifiedEpoch: date.timeIntervalSince1970,
                    sizeBytes: size
                )
            }
            .sorted { $0.modifiedEpoch > $1.modifiedEpoch }
    }

    private func readLogTail(at url: URL) -> String {
        guard let handle = try? FileHandle(forReadingFrom: url) else {
            return "Could not open log file."
        }
        defer { try? handle.close() }
        let maxBytes: UInt64 = 128 * 1_024
        let end = (try? handle.seekToEnd()) ?? 0
        let start = end > maxBytes ? end - maxBytes : 0
        try? handle.seek(toOffset: start)
        let data = (try? handle.readToEnd()) ?? Data()
        return String(decoding: data, as: UTF8.self)
    }

    private func handleClassifyLog(at url: URL) async -> CrashDiagnosisDTO {
        let diagnosis = await Wine.classifyLastRun(logFileURL: url, exitCode: 1)
        let (_, actions) = PatternLoader.loadDefaults()
        let remediations = diagnosis?.remediations(from: actions).map { action in
            RemediationDTO(
                id: action.id,
                title: action.title,
                description: action.description,
                whatWillChange: action.whatWillChange,
                undoPath: action.undoPath,
                risk: action.risk.rawValue
            )
        } ?? []

        return CrashDiagnosisDTO(
            headline: diagnosis?.headline,
            primaryCategory: diagnosis?.primaryCategory?.displayName,
            primaryConfidence: diagnosis?.primaryConfidence?.displayName,
            matchCount: diagnosis?.matches.count ?? 0,
            remediations: remediations
        )
    }

    // MARK: - Preferences

    private func currentDefaultBottleDir() -> URL {
        if let stored = defaults.string(forKey: "defaultBottleLocation"), !stored.isEmpty {
            return URL(fileURLWithPath: stored)
        }
        if let data = defaults.data(forKey: "defaultBottleLocation"),
           let url = try? NSKeyedUnarchiver.unarchivedObject(ofClass: NSURL.self, from: data) as URL? {
            return url
        }
        return BottleData.defaultBottleDir
    }

    private func defaultWinVersionRaw() -> String {
        defaults.string(forKey: "defaultWinVersion") ?? WinVersion.win10.rawValue
    }

    private func syncWineGameModeDefaults() {
        if let gm = defaults.object(forKey: WineGameMode.enabledDefaultsKey) as? Bool {
            UserDefaults.standard.set(gm, forKey: WineGameMode.enabledDefaultsKey)
        }
        if let notch = defaults.object(forKey: WineGameMode.fitBelowNotchDefaultsKey) as? Bool {
            UserDefaults.standard.set(notch, forKey: WineGameMode.fitBelowNotchDefaultsKey)
        }
    }

    private func buildPrefs() -> AppPrefsDTO {
        AppPrefsDTO(
            openSteamAtLaunch: defaults.bool(forKey: "openSteamAtLaunch"),
            gameModeEnabled: defaults.object(forKey: WineGameMode.enabledDefaultsKey) as? Bool ?? true,
            fitGamesBelowNotch: defaults.bool(forKey: WineGameMode.fitBelowNotchDefaultsKey),
            skipQuitConfirmation: defaults.bool(forKey: "skipQuitConfirmation"),
            defaultWinVersion: defaultWinVersionRaw(),
            defaultBottleLocation: currentDefaultBottleDir().path(percentEncoded: false),
            logRetentionDays: defaults.object(forKey: "logRetentionDays") as? Int ?? 7,
            checkGmacWineUpdates: defaults.object(forKey: "checkGmacWineUpdates") as? Bool ?? true,
            preferredTerminal: defaults.string(forKey: "preferredTerminal") ?? "terminal",
            themeMode: defaults.string(forKey: "gpuiThemeMode") ?? "system"
        )
    }

    private func handleUpdatePrefs(_ params: [String: AnyCodable]) -> AppPrefsDTO {
        if let val = params["openSteamAtLaunch"]?.bool {
            defaults.set(val, forKey: "openSteamAtLaunch")
        }
        if let val = params["gameModeEnabled"]?.bool {
            defaults.set(val, forKey: WineGameMode.enabledDefaultsKey)
            UserDefaults.standard.set(val, forKey: WineGameMode.enabledDefaultsKey)
            WineGameMode.apply()
        }
        if let val = params["fitGamesBelowNotch"]?.bool {
            defaults.set(val, forKey: WineGameMode.fitBelowNotchDefaultsKey)
            UserDefaults.standard.set(val, forKey: WineGameMode.fitBelowNotchDefaultsKey)
            WineGameMode.apply()
        }
        if let val = params["skipQuitConfirmation"]?.bool {
            defaults.set(val, forKey: "skipQuitConfirmation")
        }
        if let val = params["defaultWinVersion"]?.string {
            defaults.set(val, forKey: "defaultWinVersion")
        }
        if let val = params["defaultBottleLocation"]?.string {
            defaults.set(val, forKey: "defaultBottleLocation")
        }
        if let val = params["logRetentionDays"]?.int {
            defaults.set(val, forKey: "logRetentionDays")
            deleteOldLogs()
        }
        if let val = params["checkGmacWineUpdates"]?.bool {
            defaults.set(val, forKey: "checkGmacWineUpdates")
        }
        if let val = params["preferredTerminal"]?.string {
            defaults.set(val, forKey: "preferredTerminal")
        }
        if let val = params["themeMode"]?.string {
            defaults.set(val, forKey: "gpuiThemeMode")
        }
        return buildPrefs()
    }

    // MARK: - Helpers

    private func requireBottle(_ params: [String: AnyCodable], key: String = "url") throws -> Bottle {
        let path = try requireString(params, key)
        let targetURL = URL(fileURLWithPath: path)
        if let found = self.bottle(for: targetURL) {
            return found
        }
        reloadBottles()
        guard let reloaded = self.bottle(for: targetURL) else {
            throw BridgeError("PC not found: \(path)")
        }
        return reloaded
    }

    private func requireString(_ params: [String: AnyCodable], _ key: String) throws -> String {
        guard let value = params[key]?.string else {
            throw BridgeError("Missing required string parameter '\(key)'")
        }
        return value
    }

    private func requireInt(_ params: [String: AnyCodable], _ key: String) throws -> Int {
        guard let value = params[key]?.int else {
            throw BridgeError("Missing required integer parameter '\(key)'")
        }
        return value
    }

    private func runWindowsTool(_ tool: String, in bottle: Bottle) async throws {
        let args: [String]
        switch tool {
        case "control":
            args = ["control"]
        case "regedit":
            args = ["regedit"]
        case "winecfg":
            args = ["winecfg"]
        default:
            throw BridgeError("Unknown Windows tool: \(tool)")
        }
        Task {
            _ = try? await Wine.runWine(args, bottle: bottle)
        }
    }

    private func openTerminal(for bottle: Bottle) throws {
        let envCmd = Wine.generateTerminalEnvironmentCommand(bottle: bottle)
        let driveC = bottle.url.appending(path: "drive_c").path(percentEncoded: false)
        let script = """
        #!/bin/bash
        \(envCmd)
        cd \(ShellQuoting.quoted(driveC)) 2>/dev/null || true
        exec "${SHELL:-/bin/zsh}" -l
        """
        let scriptURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("gmac-env-\(UUID().uuidString).sh")
        try script.write(to: scriptURL, atomically: true, encoding: .utf8)
        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: scriptURL.path)

        let preferredRaw = defaults.string(forKey: "preferredTerminal") ?? "terminal"
        let terminal = TerminalApp(rawValue: preferredRaw).flatMap { $0.isInstalled ? $0 : nil } ?? .terminal
        let source = terminal.generateAppleScript(for: scriptURL.path)
        Task.detached(priority: .userInitiated) {
            var error: NSDictionary?
            if let appleScript = NSAppleScript(source: source) {
                appleScript.executeAndReturnError(&error)
            }
            try? await Task.sleep(for: .seconds(5))
            try? FileManager.default.removeItem(at: scriptURL)
        }
    }

    private func deleteOldLogs() {
        let days = defaults.object(forKey: "logRetentionDays") as? Int ?? 7
        guard days > 0 else { return }
        let cutoff = Date().addingTimeInterval(-Double(days) * 24 * 60 * 60)
        guard let urls = try? FileManager.default.contentsOfDirectory(
            at: Wine.logsFolder,
            includingPropertiesForKeys: [.creationDateKey]
        ) else { return }
        for url in urls where url.pathExtension == "log" {
            let created = (try? url.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? Date()
            if created < cutoff {
                try? FileManager.default.removeItem(at: url)
            }
        }
    }

    private func wipeShaderCaches() {
        let getconf = Process()
        getconf.executableURL = URL(fileURLWithPath: "/usr/bin/getconf")
        getconf.arguments = ["DARWIN_USER_CACHE_DIR"]
        let pipe = Pipe()
        getconf.standardOutput = pipe
        guard (try? getconf.run()) != nil else { return }
        getconf.waitUntilExit()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        guard let pathStr = String(data: data, encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
            !pathStr.isEmpty
        else { return }
        let d3dm = URL(fileURLWithPath: pathStr).appending(path: "d3dm")
        try? FileManager.default.removeItem(at: d3dm)
    }

    private func attachDiskImage(_ image: URL) throws -> URL {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/hdiutil")
        process.arguments = ["attach", "-readonly", "-nobrowse", "-plist", image.path(percentEncoded: false)]
        let stdout = Pipe()
        process.standardInput = FileHandle.nullDevice
        process.standardOutput = stdout
        process.standardError = FileHandle.nullDevice
        try process.run()
        let data = stdout.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        guard process.terminationStatus == 0,
              let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any],
              let entities = plist["system-entities"] as? [[String: Any]],
              let mountPoint = entities.compactMap({ $0["mount-point"] as? String }).first
        else {
            throw BridgeError("Could not mount disk image \(image.lastPathComponent)")
        }
        return URL(fileURLWithPath: mountPoint)
    }

    private func detachDiskImage(_ mount: URL) {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/hdiutil")
        process.arguments = ["detach", mount.path(percentEncoded: false)]
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        try? process.run()
        process.waitUntilExit()
    }

    // MARK: - Settings Mapping

    private func encodeEnhancedSync(_ value: EnhancedSync) -> String {
        switch value {
        case .none: "none"
        case .esync: "esync"
        case .msync: "msync"
        }
    }

    private func decodeEnhancedSync(_ raw: String) -> EnhancedSync {
        switch raw {
        case "none": .none
        case "esync": .esync
        default: .msync
        }
    }

    private func encodeDXVKHUD(_ value: DXVKHUD) -> String {
        switch value {
        case .full: "full"
        case .partial: "partial"
        case .fps: "fps"
        case .off: "off"
        }
    }

    private func decodeDXVKHUD(_ raw: String) -> DXVKHUD {
        switch raw {
        case "full": .full
        case "partial": .partial
        case "fps": .fps
        default: .off
        }
    }

    private func makeBottleSettingsDTO(_ settings: BottleSettings) -> BottleSettingsDTO {
        BottleSettingsDTO(
            name: settings.name,
            windowsVersion: settings.windowsVersion.rawValue,
            enhancedSync: encodeEnhancedSync(settings.enhancedSync),
            avxEnabled: settings.avxEnabled,
            graphicsBackend: settings.graphicsBackend.rawValue,
            metalFX: settings.metalFX,
            frameGeneration: settings.frameGeneration,
            metalHud: settings.metalHud,
            metalTrace: settings.metalTrace,
            metalValidation: settings.metalValidation,
            dxrEnabled: settings.dxrEnabled,
            sequoiaCompatMode: settings.sequoiaCompatMode,
            metal4Enabled: settings.metal4Enabled,
            dxvkAsync: settings.dxvkAsync,
            dxvkHud: encodeDXVKHUD(settings.dxvkHud),
            nativeResolution: settings.nativeResolution,
            virtualDesktopEnabled: settings.virtualDesktopEnabled,
            resolutionPreset: settings.resolutionPreset.rawValue,
            customResolutionWidth: settings.customResolutionWidth,
            customResolutionHeight: settings.customResolutionHeight,
            fasterSteamApps: Array(settings.fasterSteamApps).sorted(),
            shaderCacheEnabled: settings.shaderCacheEnabled,
            disableAppNap: settings.disableAppNap,
            audioDriver: settings.audioDriver.rawValue,
            audioLatencyPreset: settings.audioLatencyPreset.rawValue,
            outputDeviceMode: settings.outputDeviceMode.rawValue,
            pinnedDeviceName: settings.pinnedDeviceName,
            controllerCompatibilityMode: settings.controllerCompatibilityMode,
            disableHIDAPI: settings.disableHIDAPI,
            allowBackgroundEvents: settings.allowBackgroundEvents,
            disableControllerMapping: settings.disableControllerMapping,
            useButtonLabels: settings.useButtonLabels,
            commandActsAsControl: settings.commandActsAsControl,
            launcherCompatibilityMode: settings.launcherCompatibilityMode,
            launcherMode: settings.launcherMode.rawValue,
            detectedLauncher: settings.detectedLauncher?.rawValue,
            launcherLocale: settings.launcherLocale.rawValue,
            gpuSpoofing: settings.gpuSpoofing,
            gpuVendor: settings.gpuVendor.rawValue,
            networkTimeout: settings.networkTimeout,
            autoEnableDXVK: settings.autoEnableDXVK,
            discordPresence: settings.discordPresence,
            discordBridge: settings.discordBridge,
            clipboardPolicy: settings.clipboardPolicy.rawValue,
            killOnQuit: settings.killOnQuit.rawValue,
            closeWithProcessesPolicy: settings.closeWithProcessesPolicy.rawValue,
            customDLLOverrides: settings.dllOverrides.map {
                DLLOverrideDTO(dllName: $0.dllName, mode: $0.mode.rawValue)
            }
        )
    }

    private func applyBottleSettingsDTO(_ dto: BottleSettingsDTO, to settings: inout BottleSettings) {
        settings.name = dto.name
        settings.windowsVersion = WinVersion(rawValue: dto.windowsVersion) ?? settings.windowsVersion
        settings.enhancedSync = decodeEnhancedSync(dto.enhancedSync)
        settings.avxEnabled = dto.avxEnabled
        settings.graphicsBackend = GraphicsBackend(rawValue: dto.graphicsBackend) ?? settings.graphicsBackend
        settings.metalFX = dto.metalFX
        settings.frameGeneration = dto.frameGeneration
        settings.metalHud = dto.metalHud
        settings.metalTrace = dto.metalTrace
        settings.metalValidation = dto.metalValidation
        settings.dxrEnabled = dto.dxrEnabled
        settings.sequoiaCompatMode = dto.sequoiaCompatMode
        settings.metal4Enabled = dto.metal4Enabled
        settings.dxvkAsync = dto.dxvkAsync
        settings.dxvkHud = decodeDXVKHUD(dto.dxvkHud)
        settings.nativeResolution = dto.nativeResolution
        settings.virtualDesktopEnabled = dto.virtualDesktopEnabled
        settings.resolutionPreset = ResolutionPreset(rawValue: dto.resolutionPreset) ?? settings.resolutionPreset
        settings.customResolutionWidth = dto.customResolutionWidth
        settings.customResolutionHeight = dto.customResolutionHeight
        settings.fasterSteamApps = Set(dto.fasterSteamApps)
        settings.shaderCacheEnabled = dto.shaderCacheEnabled
        settings.disableAppNap = dto.disableAppNap
        settings.audioDriver = AudioDriverMode(rawValue: dto.audioDriver) ?? settings.audioDriver
        settings.audioLatencyPreset = AudioLatencyPreset(rawValue: dto.audioLatencyPreset)
            ?? settings.audioLatencyPreset
        settings.outputDeviceMode = OutputDeviceMode(rawValue: dto.outputDeviceMode) ?? settings.outputDeviceMode
        settings.pinnedDeviceName = dto.pinnedDeviceName
        settings.controllerCompatibilityMode = dto.controllerCompatibilityMode
        settings.disableHIDAPI = dto.disableHIDAPI
        settings.allowBackgroundEvents = dto.allowBackgroundEvents
        settings.disableControllerMapping = dto.disableControllerMapping
        settings.useButtonLabels = dto.useButtonLabels
        settings.commandActsAsControl = dto.commandActsAsControl
        settings.launcherCompatibilityMode = dto.launcherCompatibilityMode
        settings.launcherMode = LauncherMode(rawValue: dto.launcherMode) ?? settings.launcherMode
        settings.detectedLauncher = dto.detectedLauncher.flatMap(LauncherType.init(rawValue:))
        settings.launcherLocale = Locales(rawValue: dto.launcherLocale) ?? settings.launcherLocale
        settings.gpuSpoofing = dto.gpuSpoofing
        settings.gpuVendor = GPUVendor(rawValue: dto.gpuVendor) ?? settings.gpuVendor
        settings.networkTimeout = dto.networkTimeout
        settings.autoEnableDXVK = dto.autoEnableDXVK
        settings.discordPresence = dto.discordPresence
        settings.discordBridge = dto.discordBridge
        settings.clipboardPolicy = ClipboardPolicy(rawValue: dto.clipboardPolicy) ?? settings.clipboardPolicy
        settings.killOnQuit = KillOnQuitPolicy(rawValue: dto.killOnQuit) ?? settings.killOnQuit
        settings.closeWithProcessesPolicy = CloseWithProcessesPolicy(rawValue: dto.closeWithProcessesPolicy)
            ?? settings.closeWithProcessesPolicy
        settings.dllOverrides = dto.customDLLOverrides.compactMap { entry in
            DLLOverrideMode(rawValue: entry.mode).map { DLLOverrideEntry(dllName: entry.dllName, mode: $0) }
        }
    }
}

private final class DownloadProgressDelegate: NSObject, URLSessionDownloadDelegate, @unchecked Sendable {
    private let onProgress: @Sendable (Double) -> Void

    init(onProgress: @escaping @Sendable (Double) -> Void) {
        self.onProgress = onProgress
    }

    func urlSession(
        _: URLSession,
        downloadTask _: URLSessionDownloadTask,
        didWriteData _: Int64,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        guard totalBytesExpectedToWrite > 0 else { return }
        onProgress(Double(totalBytesWritten) / Double(totalBytesExpectedToWrite))
    }

    func urlSession(_: URLSession, downloadTask _: URLSessionDownloadTask, didFinishDownloadingTo _: URL) {}
}
