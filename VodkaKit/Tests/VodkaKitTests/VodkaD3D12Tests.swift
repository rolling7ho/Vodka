//
//  VodkaD3D12Tests.swift
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

@testable import VodkaKit
import XCTest

final class VodkaD3D12Tests: XCTestCase {
    private var tempDir: URL!
    private var payloadRoot: URL!
    private var wineLibRoot: URL!
    private var prefixRoot: URL!
    private var gameDir: URL!

    /// A PE header stub for `machine`: e_lfanew at 0x3C pointing at 0x40,
    /// "PE\0\0", then the COFF machine field.
    private func executable(machine: UInt16) -> Data {
        var data = Data(count: 0x3C)
        data += withUnsafeBytes(of: UInt32(0x40).littleEndian) { Data($0) }
        data += Data("PE\0\0".utf8)
        data += withUnsafeBytes(of: machine.littleEndian) { Data($0) }
        return data + Data(count: 16)
    }

    /// One of this layer's DLLs: they import the bridge by name.
    private func vodkaDLL(_ tag: String) -> Data {
        Data("MZ \(tag) vodkametal.dll".utf8)
    }

    private func path(_ url: URL) -> String { url.path(percentEncoded: false) }

    override func setUpWithError() throws {
        tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        payloadRoot = tempDir.appending(path: "VodkaD3D12")
        wineLibRoot = tempDir.appending(path: "lib/wine")
        prefixRoot = tempDir.appending(path: "bottle")
        gameDir = prefixRoot.appending(path: "drive_c/Games/Teardown")
        let fileManager = FileManager.default
        for arch in ["x64", "x32"] {
            let dir = payloadRoot.appending(path: arch)
            try fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
            for name in ["d3d12.dll", "dxgi.dll", "vodkametal.dll"] {
                try vodkaDLL("\(arch)-\(name)").write(to: dir.appending(path: name))
            }
        }
        try fileManager.createDirectory(at: payloadRoot.appending(path: "unix"), withIntermediateDirectories: true)
        try Data("so".utf8).write(to: payloadRoot.appending(path: "unix/vodkametal.so"))
        for dir in ["x86_64-unix", "x86_64-windows", "i386-windows"] {
            try fileManager.createDirectory(at: wineLibRoot.appending(path: dir), withIntermediateDirectories: true)
        }
        for dir in ["system32", "syswow64"] {
            try fileManager.createDirectory(
                at: prefixRoot.appending(path: "drive_c/windows/\(dir)"), withIntermediateDirectories: true
            )
        }
        try fileManager.createDirectory(at: gameDir, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: tempDir)
    }

    private func sync(games: [URL], others: [URL] = []) throws {
        try VodkaD3D12.sync(
            payloadRoot: payloadRoot, wineLibRoot: wineLibRoot, prefixRoot: prefixRoot,
            gameExecutables: games, otherExecutables: others
        )
    }

    func testPlacesBridgeAndGameDLLsForA64BitGame() throws {
        let exe = gameDir.appending(path: "teardown.exe")
        try executable(machine: 0x8664).write(to: exe)

        try sync(games: [exe])

        XCTAssertEqual(try Data(contentsOf: gameDir.appending(path: "d3d12.dll")), vodkaDLL("x64-d3d12.dll"))
        XCTAssertEqual(try Data(contentsOf: gameDir.appending(path: "dxgi.dll")), vodkaDLL("x64-dxgi.dll"))
        for file in ["x86_64-unix/vodkametal.so", "i386-windows/vodkametal.dll"] {
            XCTAssertTrue(FileManager.default.fileExists(atPath: path(wineLibRoot.appending(path: file))))
        }
        XCTAssertEqual(
            try Data(contentsOf: prefixRoot.appending(path: "drive_c/windows/system32/vodkametal.dll")),
            vodkaDLL("x64-vodkametal.dll")
        )
        XCTAssertEqual(
            try Data(contentsOf: prefixRoot.appending(path: "drive_c/windows/syswow64/vodkametal.dll")),
            vodkaDLL("x32-vodkametal.dll")
        )
    }

    func testA32BitGameGetsThe32BitDLLs() throws {
        let exe = gameDir.appending(path: "old.exe")
        try executable(machine: 0x14C).write(to: exe)

        try sync(games: [exe])

        XCTAssertEqual(try Data(contentsOf: gameDir.appending(path: "d3d12.dll")), vodkaDLL("x32-d3d12.dll"))
    }

    func testLeavesAGamesOwnDLLAlone() throws {
        let exe = gameDir.appending(path: "teardown.exe")
        try executable(machine: 0x8664).write(to: exe)
        let own = Data("MZ the game's own dxgi".utf8)
        try own.write(to: gameDir.appending(path: "dxgi.dll"))

        try sync(games: [exe])

        XCTAssertEqual(try Data(contentsOf: gameDir.appending(path: "dxgi.dll")), own)
        XCTAssertEqual(try Data(contentsOf: gameDir.appending(path: "d3d12.dll")), vodkaDLL("x64-d3d12.dll"))
    }

    func testRemovesItsOwnCopiesFromOtherGamesOnly() throws {
        let other = prefixRoot.appending(path: "drive_c/Games/Other")
        try FileManager.default.createDirectory(at: other, withIntermediateDirectories: true)
        try vodkaDLL("old").write(to: other.appending(path: "d3d12.dll"))
        let own = Data("MZ the game's own dxgi".utf8)
        try own.write(to: other.appending(path: "dxgi.dll"))

        try sync(games: [], others: [other.appending(path: "other.exe")])

        XCTAssertFalse(FileManager.default.fileExists(atPath: path(other.appending(path: "d3d12.dll"))))
        XCTAssertEqual(try Data(contentsOf: other.appending(path: "dxgi.dll")), own)
    }

    func testKeepsTheDLLsInAFolderAGameUsesEvenWhenAnotherExecutableThereDoesNot() throws {
        let exe = gameDir.appending(path: "teardown.exe")
        try executable(machine: 0x8664).write(to: exe)

        try sync(games: [exe], others: [gameDir.appending(path: "teardown_modtest.exe")])

        XCTAssertTrue(FileManager.default.fileExists(atPath: path(gameDir.appending(path: "d3d12.dll"))))
    }

    func testAnIncompletePayloadThrowsAndPlacesNothing() throws {
        try FileManager.default.removeItem(at: payloadRoot.appending(path: "unix/vodkametal.so"))
        let exe = gameDir.appending(path: "teardown.exe")
        try executable(machine: 0x8664).write(to: exe)

        XCTAssertThrowsError(try sync(games: [exe])) { error in
            XCTAssertEqual(error as? Wine.DXMTError, .payloadMissing)
        }
        XCTAssertFalse(FileManager.default.fileExists(atPath: path(gameDir.appending(path: "d3d12.dll"))))
    }

    func testPresetLoadsTheGamesD3D12AndDXGIWithTheBridgeBuiltin() {
        let preset = DLLOverrideResolver.dxmtD3D12Preset()
        XCTAssertEqual(preset.first { $0.dllName == "d3d12" }?.mode, .nativeThenBuiltin)
        XCTAssertEqual(preset.first { $0.dllName == "dxgi" }?.mode, .nativeThenBuiltin)
        XCTAssertEqual(preset.first { $0.dllName == "vodkametal" }?.mode, .builtin)
    }

    func testTeardownDefaultsToIt() {
        let plan = LaunchResolver.plan(steamAppId: 1_167_630)
        XCTAssertEqual(plan.overrides.graphicsBackend, .dxmtD3D12)
        XCTAssertTrue(plan.gameExecutables.contains("teardown.exe"))
    }

    func testABottleSetToItContributesNoBottleOverrides() {
        XCTAssertTrue(DLLOverrideResolver.managedPreset(for: .dxmtD3D12, builtinD3D12IsD3DMetal: true).isEmpty)
    }
}
