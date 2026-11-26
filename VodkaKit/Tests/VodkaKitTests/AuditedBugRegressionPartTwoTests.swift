//
//  AuditedBugRegressionPartTwoTests.swift
//  VodkaKitTests
//
//  This file is part of Vodka, a fork of Whisky.
//
//  Vodka is free software: you can redistribute it and/or modify it under the terms
//  of the GNU General Public License as published by the Free Software Foundation,
//  either version 3 of the License, or (at your option) any later version.
//
//  Vodka is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
//  without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
//  See the GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License along with Vodka.
//  If not, see https://www.gnu.org/licenses/.
//

import Foundation
import Testing
@testable import VodkaKit

@Suite("Audited Bug Regression Tests (Pass 2)")
struct AuditedBugRegressionPartTwoTests {
    // MARK: - VodkaWineInstaller atomic staged replacement

    @Test("VodkaWineInstaller preserves existing Libraries when tarball extraction fails")
    func runtimeInstallPreservesExistingOnFailure() throws {
        let tempDir = FileManager.default.temporaryDirectory
            .appending(path: "installer-atomic-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let destination = tempDir.appending(path: "dest")
        let existingMarker = destination.appending(path: "Libraries/existing.txt")
        try FileManager.default.createDirectory(
            at: existingMarker.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data("working runtime".utf8).write(to: existingMarker)

        let badTarball = tempDir.appending(path: "corrupt.tar.gz")
        try Data("not a valid tar archive".utf8).write(to: badTarball)

        #expect(throws: (any Error).self) {
            try VodkaWineInstaller.install(tarball: badTarball, into: destination)
        }
        #expect(FileManager.default.fileExists(atPath: existingMarker.path(percentEncoded: false)))
    }

    // MARK: - GPTKImporter NVAPI symlink repair

    @Test("GPTKImporter.installNVAPIBridge repairs missing unix symlink when DLL is already present")
    func nvapiBridgeRepairsMissingUnixSymlink() throws {
        let root = FileManager.default.temporaryDirectory
            .appending(path: "nvapi-repair-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }

        let store = root.appending(path: "store")
        let storePE = store.appending(path: "lib/wine/x86_64-windows")
        try FileManager.default.createDirectory(at: storePE, withIntermediateDirectories: true)
        try Data("apple nvapi".utf8).write(to: storePE.appending(path: GPTKImporter.nvapiBridgeName))

        let folder = root.appending(path: "Libraries")
        let treePE = folder.appending(path: "Wine/lib/wine/x86_64-windows")
        try FileManager.default.createDirectory(at: treePE, withIntermediateDirectories: true)
        try Data("wine placeholder".utf8).write(to: treePE.appending(path: GPTKImporter.nvapiBridgeName))

        try GPTKImporter.installNVAPIBridge(intoLibraryFolder: folder, usingStore: store)
        let link = GPTKImporter.nvapiBridgeUnixLink(inLibraryFolder: folder)
        try FileManager.default.removeItem(at: link)

        try GPTKImporter.installNVAPIBridge(intoLibraryFolder: folder, usingStore: store)
        let target = try FileManager.default.destinationOfSymbolicLink(atPath: link.path(percentEncoded: false))
        #expect(target == GPTKImporter.unixLinkDestination)
    }

    // MARK: - FileManager installFile and replaceFile

    @Test("installFile replaces dangling symlinks and replaceFile preserves original on copy failure")
    func fileManagerInstallAndReplaceSafety() throws {
        let tempDir = FileManager.default.temporaryDirectory
            .appending(path: "fm-safety-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let source = tempDir.appending(path: "source.dll")
        try Data("new".utf8).write(to: source)

        let dangling = tempDir.appending(path: "dangling.dll")
        try FileManager.default.createSymbolicLink(
            atPath: dangling.path(percentEncoded: false),
            withDestinationPath: "nonexistent-target.dll"
        )
        try FileManager.default.installFile(at: dangling, from: source)
        #expect(try Data(contentsOf: dangling) == Data("new".utf8))

        let original = tempDir.appending(path: "original.dll")
        try Data("keep".utf8).write(to: original)
        let missing = tempDir.appending(path: "missing.dll")

        #expect(throws: (any Error).self) {
            try FileManager.default.replaceFile(at: original, with: missing, makeOriginalCopy: false)
        }
        #expect(try Data(contentsOf: original) == Data("keep".utf8))

        #expect(throws: (any Error).self) {
            try FileManager.default.replaceFile(at: original, with: missing, makeOriginalCopy: true)
        }
        #expect(try Data(contentsOf: original) == Data("keep".utf8))
    }

    // MARK: - Case-insensitive .EXE discovery and URL prefix update

    @Test("Bottle.discoverInstalledExecutables finds uppercase .EXE files")
    func discoversUppercaseEXE() throws {
        let tempDir = FileManager.default.temporaryDirectory
            .appending(path: "exe-case-\(UUID().uuidString)")
        let gameDir = tempDir.appending(path: "drive_c/Program Files/OldGame")
        try FileManager.default.createDirectory(at: gameDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let upperExe = gameDir.appending(path: "GAME.EXE")
        try Data("MZ".utf8).write(to: upperExe)

        let discovered = Bottle.discoverInstalledExecutables(
            driveC: tempDir.appending(path: "drive_c"),
            blocklist: []
        )
        #expect(discovered.contains { $0.lastPathComponent == "GAME.EXE" })
    }

    @Test("URL.updateParentBottle replaces only the leading bottle prefix")
    func updateParentBottleReplacesLeadingPrefixOnly() {
        let oldBottle = URL(filePath: "/Bottles/A")
        let newBottle = URL(filePath: "/Bottles/B")
        let nested = URL(filePath: "/Bottles/A/drive_c/Bottles/A/game.exe")

        let updated = nested.updateParentBottle(old: oldBottle, new: newBottle)
        #expect(updated.path(percentEncoded: false) == "/Bottles/B/drive_c/Bottles/A/game.exe")
    }

    // MARK: - Diagnostics URL credential sanitization

    @Test("VodkaWineSetupDiagnostics strips userinfo credentials from URLs")
    func diagnosticsSanitizesURLCredentials() {
        var diagnostics = VodkaWineSetupDiagnostics()
        diagnostics.versionPlistURL = "https://user:secret@example.com/version.plist?token=abc#frag"

        let report = diagnostics.reportString(stage: "download")
        #expect(!report.contains("user:secret"))
        #expect(!report.contains("token=abc"))
        #expect(report.contains("https://example.com/version.plist"))
    }

    // MARK: - Wine registry, virtual desktop, and deterministic shell command

    @Test("steamAutostartRemoval matches Run value names case-insensitively")
    @MainActor
    func steamAutostartRemovalMatchesCaseInsensitively() throws {
        let bottleDir = FileManager.default.temporaryDirectory
            .appending(path: "steam-run-case-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: bottleDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: bottleDir) }

        let userReg = """
        WINE REGISTRY Version 2

        [Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Run] 1700000000
        "steam"="C:\\\\Program Files (x86)\\\\Steam\\\\steam.exe"
        """
        try userReg.write(to: bottleDir.appending(path: "user.reg"), atomically: true, encoding: .utf8)

        let bottle = Bottle(bottleUrl: bottleDir)
        let removal = Wine.steamAutostartRemoval(bottle: bottle)
        #expect(removal.contains("\"Steam\"=-"))
    }

    @Test("launchArguments strips commas from virtual desktop names and generateRunCommand sorts env keys")
    func virtualDesktopCommaAndDeterministicCommand() {
        var overrides = ProgramOverrides()
        overrides.virtualDesktopEnabled = true
        overrides.resolutionPreset = .r1280x720

        let exe = URL(filePath: "/tmp/My, Game.exe")
        let args = Wine.launchArguments(for: exe, args: [], programOverrides: overrides)
        #expect(args.contains("/desktop=My__Game.exe,1280x720"))

        let launch = Wine.PreparedLaunch(
            environment: ["Z_VAR": "1", "A_VAR": "2", "M_VAR": "3"],
            arguments: ["start", "/unix", "/tmp/game.exe"]
        )
        let command = Wine.generateRunCommand(for: launch, wineBinary: URL(filePath: "/usr/bin/wine64"))
        #expect(command.hasPrefix("A_VAR=2 M_VAR=3 Z_VAR=1 "))
    }

    // MARK: - WineUserProfile case-insensitive Temp detection

    @Test("WineUserProfile ignores lowercase temp folders when checking for user data")
    func userProfileIgnoresLowercaseTemp() throws {
        let profile = FileManager.default.temporaryDirectory
            .appending(path: "profile-temp-\(UUID().uuidString)")
        let tempDir = profile.appending(path: "AppData/Local/temp")
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: profile) }

        try Data("scratch".utf8).write(to: tempDir.appending(path: "cache.tmp"))
        #expect(!WineUserProfile.hasUserData(profile))
    }

    // MARK: - GraphicsAPIDetector malformed PE safety

    @Test("GraphicsAPIDetector handles malformed PE magic and high RVAs without trapping")
    func graphicsAPIDetectorMalformedPESafety() throws {
        let tempDir = FileManager.default.temporaryDirectory
            .appending(path: "pe-malformed-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        var peBytes = Data(repeating: 0, count: 0x300)
        peBytes[0] = 0x4D
        peBytes[1] = 0x5A
        // e_lfanew = 0x80
        peBytes[0x3C] = 0x80
        // PE\0\0
        peBytes[0x80] = 0x50
        peBytes[0x81] = 0x45
        // NumberOfSections = 1, SizeOfOptionalHeader = 0xF0
        peBytes[0x86] = 1
        peBytes[0x94] = 0xF0
        // Optional header magic = 0x20B (PE32+)
        peBytes[0x98] = 0x0B
        peBytes[0x99] = 0x02
        // NumberOfRvaAndSizes = 2 at 0x80 + 24 + 108 = 0x104
        peBytes[0x104] = 2
        // Import directory RVA = 0xFFFF_FFF0 at 0x80 + 24 + 112 + 8 = 0x110
        peBytes[0x110] = 0xF0
        peBytes[0x111] = 0xFF
        peBytes[0x112] = 0xFF
        peBytes[0x113] = 0xFF
        // Section 0 at 0x80 + 24 + 0xF0 = 0x188: VirtualSize = 0x100, VirtualAddress = 0xFFFF_FFF0
        peBytes[0x190] = 0x00
        peBytes[0x191] = 0x01
        peBytes[0x194] = 0xF0
        peBytes[0x195] = 0xFF
        peBytes[0x196] = 0xFF
        peBytes[0x197] = 0xFF

        let exe = tempDir.appending(path: "crafted.exe")
        try peBytes.write(to: exe)
        #expect(GraphicsAPIDetector.detect(executables: [exe]) == nil)
    }

    // MARK: - SteamClientOrchestrator cancellation error suppression

    @Test("SteamClientOrchestrator.stop cancels an in-flight launch without setting launchError")
    @MainActor
    func orchestratorStopDoesNotRecordLaunchError() async throws {
        let (bottle, games) = try SteamOrchestratorFixture.makeBottle()
        let driver = FakeSteamClientDriver(script: [[]])
        var timing = SteamOrchestratorFixture.patient
        timing.clientReadyTimeout = 60
        let orchestrator = SteamClientOrchestrator(bottle: bottle, driver: driver, timing: timing)

        orchestrator.launch(games[0])
        try await Task.sleep(for: .milliseconds(20))
        orchestrator.stop()

        await SteamOrchestratorFixture.eventually("cancelled launch clears phase") {
            orchestrator.phases.isEmpty
        }
        #expect(orchestrator.launchError == nil)
    }
}
