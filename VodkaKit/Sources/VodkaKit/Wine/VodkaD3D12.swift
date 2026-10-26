//
//  VodkaD3D12.swift
//  VodkaKit
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
import os.log

/// Vodka's own DirectX 12 to Metal layer: a build of DXMT
/// (https://github.com/rolling7ho/dxmt, branch `teardown`) that runs games such
/// as Teardown, offered per game as ``GraphicsBackend/dxmtD3D12``.
///
/// It lives beside everything else rather than replacing it:
///
/// - Its Wine bridge is built as `vodkametal` rather than `winemetal`, so the
///   runtime's own DXMT (whose unix calls differ) keeps working for DirectX 11.
///   The bridge is a builtin, so its PE goes into the runtime's `lib/wine` with
///   its unixlib, and a builtin-marked copy into the prefix, without which this
///   Wine reports it as not found.
/// - `d3d12.dll` and `dxgi.dll` go next to the game's executable, the first
///   place Wine looks for a native DLL. In the prefix they would collide with
///   the DXVK `dxgi` Steam's own processes need, which is copied there.
///
/// The game's `AppDefaults` then load them with `d3d12,dxgi=n,b`.
public enum VodkaD3D12 {
    private static let logger = Logger(subsystem: "com.rolling7ho.VodkaKit", category: "vodka-d3d12")

    /// The bridge's name, for its PE and its unixlib alike.
    static let bridgeName = "vodkametal"

    /// What goes next to a game's executable.
    static let gameDLLs = ["d3d12.dll", "dxgi.dll"]

    /// Where the app carries the payload: `x64/` and `x32/` with the game's DLLs
    /// and the bridge PE, and `unix/` with the bridge's unixlib.
    public static var payloadRoot: URL? {
        Bundle.main.resourceURL?.appending(path: "VodkaD3D12")
    }

    /// Whether the payload this app carries is complete.
    public static func isAvailable() -> Bool {
        payloadRoot.map(isAvailable(payloadRoot:)) ?? false
    }

    static func isAvailable(payloadRoot: URL) -> Bool {
        payloadFiles(payloadRoot).allSatisfy { FileManager.default.fileExists(atPath: $0.path(percentEncoded: false)) }
    }

    private static func payloadFiles(_ root: URL) -> [URL] {
        ["x64", "x32"].flatMap { arch in
            (gameDLLs + ["\(bridgeName).dll"]).map { root.appending(path: arch).appending(path: $0) }
        } + [root.appending(path: "unix").appending(path: "\(bridgeName).so")]
    }

    /// Places the payload for the games in `gameExecutables` and takes Vodka's
    /// copies away from beside `otherExecutables`, whose games run on something
    /// else: next to them its `dxgi.dll` would win over DXVK's under `n,b`.
    ///
    /// Throws only when the payload is incomplete; a game folder that cannot be
    /// written is logged and skipped, and that game falls back to D3DMetal.
    @MainActor
    public static func sync(bottle: Bottle, gameExecutables: [URL], otherExecutables: [URL]) throws {
        guard let payloadRoot else { throw Wine.DXMTError.payloadMissing }
        try sync(
            payloadRoot: payloadRoot,
            wineLibRoot: VodkaWineInstaller.libraryFolder.appending(path: "Wine").appending(path: "lib")
                .appending(path: "wine"),
            prefixRoot: bottle.url,
            gameExecutables: gameExecutables,
            otherExecutables: otherExecutables
        )
    }

    /// ``sync(bottle:gameExecutables:otherExecutables:)`` against explicit
    /// roots, so tests can use temporary folders.
    static func sync(
        payloadRoot: URL, wineLibRoot: URL, prefixRoot: URL, gameExecutables: [URL], otherExecutables: [URL]
    ) throws {
        if !gameExecutables.isEmpty {
            guard isAvailable(payloadRoot: payloadRoot) else { throw Wine.DXMTError.payloadMissing }
            try installBridge(payloadRoot: payloadRoot, wineLibRoot: wineLibRoot, prefixRoot: prefixRoot)
        }
        let fileManager = FileManager.default
        for executable in gameExecutables {
            let arch = (try? architecture(of: executable)) == .i386 ? "x32" : "x64"
            let folder = executable.deletingLastPathComponent()
            for name in gameDLLs {
                let destination = folder.appending(path: name)
                // Never over a game's own copy: only an absent file or one of ours.
                if fileManager.fileExists(atPath: destination.path(percentEncoded: false)),
                   !isVodkaBuild(destination) {
                    logger.warning("\(destination.path, privacy: .public) is the game's own; leaving it")
                    continue
                }
                do {
                    try fileManager.installFileIfContentDiffers(
                        at: destination, from: payloadRoot.appending(path: arch).appending(path: name)
                    )
                } catch {
                    logger.error("Could not place \(name, privacy: .public): \(error.localizedDescription)")
                }
            }
        }
        let placed = Set(gameExecutables.map { $0.deletingLastPathComponent().standardizedFileURL })
        for executable in otherExecutables {
            let folder = executable.deletingLastPathComponent()
            guard !placed.contains(folder.standardizedFileURL) else { continue }
            for name in gameDLLs {
                let file = folder.appending(path: name)
                guard isVodkaBuild(file) else { continue }
                try? fileManager.removeItem(at: file)
            }
        }
    }

    /// The bridge: PE and unixlib into the runtime, and the builtin-marked PE
    /// into the prefix, for each architecture the prefix has.
    private static func installBridge(payloadRoot: URL, wineLibRoot: URL, prefixRoot: URL) throws {
        let fileManager = FileManager.default
        let dll = "\(bridgeName).dll"
        try fileManager.installFileIfContentDiffers(
            at: wineLibRoot.appending(path: "x86_64-unix").appending(path: "\(bridgeName).so"),
            from: payloadRoot.appending(path: "unix").appending(path: "\(bridgeName).so")
        )
        try fileManager.installFileIfContentDiffers(
            at: wineLibRoot.appending(path: "x86_64-windows").appending(path: dll),
            from: payloadRoot.appending(path: "x64").appending(path: dll)
        )
        try fileManager.installFileIfContentDiffers(
            at: wineLibRoot.appending(path: "i386-windows").appending(path: dll),
            from: payloadRoot.appending(path: "x32").appending(path: dll)
        )
        let windows = prefixRoot.appending(path: "drive_c").appending(path: "windows")
        try fileManager.installFileIfContentDiffers(
            at: windows.appending(path: "system32").appending(path: dll),
            from: payloadRoot.appending(path: "x64").appending(path: dll)
        )
        let syswow64 = windows.appending(path: "syswow64")
        if fileManager.fileExists(atPath: syswow64.path(percentEncoded: false)) {
            try fileManager.installFileIfContentDiffers(
                at: syswow64.appending(path: dll), from: payloadRoot.appending(path: "x32").appending(path: dll)
            )
        }
    }

    /// Whether `file` is one of this layer's DLLs: they, and nothing a game
    /// ships, import the bridge by name.
    static func isVodkaBuild(_ file: URL) -> Bool {
        guard let data = try? Data(contentsOf: file, options: .mappedIfSafe) else { return false }
        return data.range(of: Data("\(bridgeName).dll".utf8)) != nil
    }

    enum Architecture: Equatable {
        case i386, x64, other
    }

    /// The machine a PE executable is built for, from its COFF header.
    static func architecture(of executable: URL) throws -> Architecture {
        let handle = try FileHandle(forReadingFrom: executable)
        defer { try? handle.close() }
        try handle.seek(toOffset: 0x3C)
        guard let offsetBytes = try handle.read(upToCount: 4), offsetBytes.count == 4 else { return .other }
        let offset = offsetBytes.withUnsafeBytes { UInt32(littleEndian: $0.loadUnaligned(as: UInt32.self)) }
        try handle.seek(toOffset: UInt64(offset) + 4)
        guard let machineBytes = try handle.read(upToCount: 2), machineBytes.count == 2 else { return .other }
        switch machineBytes.withUnsafeBytes({ UInt16(littleEndian: $0.loadUnaligned(as: UInt16.self)) }) {
        case 0x14C: return .i386
        case 0x8664: return .x64
        default: return .other
        }
    }
}
