//
//  GraphicsAPIDetector.swift
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

/// The graphics API a Windows game renders with.
public enum GraphicsAPI: String, Sendable, CaseIterable {
    case d3d12, d3d11, d3d10, d3d9, vulkan, openGL

    /// What the API is called in the UI.
    public var displayName: String {
        switch self {
        case .d3d12: "DirectX 12"
        case .d3d11: "DirectX 11"
        case .d3d10: "DirectX 10"
        case .d3d9: "DirectX 9"
        case .vulkan: "Vulkan"
        case .openGL: "OpenGL"
        }
    }
}

/// Works out which graphics API a game uses from the DLLs its executables
/// import, so Automatic can pick a translation layer per game the way
/// CrossOver's Auto does from its database.
///
/// Both the import and the delay-import tables count: engines such as Unreal
/// delay-load `d3d12.dll`. Only headers and the import tables are read, so a
/// multi-gigabyte executable costs a few small reads.
public enum GraphicsAPIDetector {
    /// The newest API any of `executables` imports, or `nil` when none imports one.
    public static func detect(executables: [URL]) -> GraphicsAPI? {
        var found: Set<GraphicsAPI> = []
        for url in executables {
            for dll in importedDLLs(of: url) {
                if let api = api(forDLL: dll) { found.insert(api) }
            }
        }
        // D3D12 titles usually also import D3D11 (for D3D11On12 or a fallback);
        // the newest API is the one they render with by default.
        let priority: [GraphicsAPI] = [.d3d12, .d3d11, .d3d10, .d3d9, .vulkan, .openGL]
        return priority.first(where: found.contains)
    }

    /// The backend Automatic should use for `api`.
    ///
    /// - Parameter d3dMetalAvailable: Whether Apple's D3DMetal is deployed.
    /// - Returns: `nil` when the bottle's recommended backend is already right.
    public static func backend(for api: GraphicsAPI, d3dMetalAvailable: Bool) -> GraphicsBackend? {
        switch api {
        case .d3d12:
            // Without D3DMetal, Wine's own d3d12 (vkd3d over MoltenVK) needs Wine's dxgi.
            d3dMetalAvailable ? .d3dMetal : .wined3d
        case .d3d11, .d3d10:
            nil
        case .d3d9, .vulkan, .openGL:
            // DXMT and D3DMetal have no D3D9, and this runtime's DXVK has none either.
            // Wine's own path renders these without a replaced dxgi in the way.
            .wined3d
        }
    }

    static func api(forDLL name: String) -> GraphicsAPI? {
        switch name.lowercased() {
        case "d3d12.dll": .d3d12
        case "d3d11.dll": .d3d11
        case "d3d10.dll", "d3d10_1.dll", "d3d10core.dll": .d3d10
        case "d3d9.dll": .d3d9
        case "vulkan-1.dll": .vulkan
        case "opengl32.dll": .openGL
        default: nil
        }
    }

    private static let cacheLock = NSLock()
    nonisolated(unsafe) private static var cache: [String: (modified: Date, dlls: Set<String>)] = [:]

    /// Lowercased names of the DLLs `url` imports, directly or delay-loaded.
    /// Remembered per file until it changes, since every launch asks again.
    static func importedDLLs(of url: URL) -> Set<String> {
        let modified = (try? url.resourceValues(forKeys: [.contentModificationDateKey]))?
            .contentModificationDate ?? .distantPast
        let key = url.standardizedFileURL.path
        cacheLock.lock()
        let cached = cache[key]
        cacheLock.unlock()
        if let cached, cached.modified == modified { return cached.dlls }
        let dlls = readImportedDLLs(of: url)
        cacheLock.lock()
        cache[key] = (modified, dlls)
        cacheLock.unlock()
        return dlls
    }

    private static func readImportedDLLs(of url: URL) -> Set<String> {
        guard let handle = try? FileHandle(forReadingFrom: url) else { return [] }
        defer { try? handle.close() }
        guard let image = ImportTableReader(handle: handle) else { return [] }
        return image.importedDLLs()
    }
}

/// Just enough of a PE image to walk its import tables.
private struct ImportTableReader {
    struct Section {
        let virtualAddress: UInt32
        let virtualSize: UInt32
        let rawSize: UInt32
        let rawPointer: UInt32
    }

    let handle: FileHandle
    let imageBase: UInt64
    let directories: [(rva: UInt32, size: UInt32)]
    let sections: [Section]

    init?(handle: FileHandle) {
        self.handle = handle
        guard let dos = Self.read(handle, at: 0, count: 64), dos.count == 64,
              dos[0] == 0x4D, dos[1] == 0x5A
        else { return nil }
        let peOffset = UInt64(Self.u32(dos, 0x3C))
        guard let header = Self.read(handle, at: peOffset, count: 24 + 240), header.count >= 24 + 112,
              header.prefix(4) == Data([0x50, 0x45, 0, 0])
        else { return nil }

        let sectionCount = Int(Self.u16(header, 6))
        let optionalSize = Int(Self.u16(header, 20))
        let magic = Self.u16(header, 24)
        let isPE32Plus = magic == 0x20B
        imageBase = isPE32Plus ? Self.u64(header, 24 + 24) : UInt64(Self.u32(header, 24 + 28))
        let directoryStart = 24 + (isPE32Plus ? 112 : 96)
        let directoryCount = min(Int(Self.u32(header, directoryStart - 4)), 16)
        var directories: [(UInt32, UInt32)] = []
        for index in 0 ..< directoryCount where directoryStart + index * 8 + 8 <= header.count {
            let offset = directoryStart + index * 8
            directories.append((Self.u32(header, offset), Self.u32(header, offset + 4)))
        }
        self.directories = directories

        let tableOffset = peOffset + 24 + UInt64(optionalSize)
        guard sectionCount < 128,
              let table = Self.read(handle, at: tableOffset, count: sectionCount * 40)
        else { return nil }
        sections = (0 ..< sectionCount).compactMap { index in
            let base = index * 40
            guard base + 40 <= table.count else { return nil }
            return Section(
                virtualAddress: Self.u32(table, base + 12), virtualSize: Self.u32(table, base + 8),
                rawSize: Self.u32(table, base + 16), rawPointer: Self.u32(table, base + 20)
            )
        }
    }

    func importedDLLs() -> Set<String> {
        var names: Set<String> = []
        // Import directory: 20-byte descriptors, name RVA at +12.
        if directories.count > 1, directories[1].rva != 0 {
            names.formUnion(descriptorNames(at: directories[1].rva, stride: 20, nameOffset: 12))
        }
        // Delay-import directory: 32-byte descriptors, name RVA at +4.
        if directories.count > 13, directories[13].rva != 0 {
            names.formUnion(descriptorNames(at: directories[13].rva, stride: 32, nameOffset: 4))
        }
        return names
    }

    private func descriptorNames(at rva: UInt32, stride: Int, nameOffset: Int) -> [String] {
        var names: [String] = []
        for index in 0 ..< 512 {
            guard let offset = fileOffset(rva: rva + UInt32(index * stride)),
                  let descriptor = Self.read(handle, at: offset, count: stride), descriptor.count == stride
            else { break }
            var nameRVA = Self.u32(descriptor, nameOffset)
            if nameRVA == 0 { break }
            // Old-style delay descriptors hold a VA rather than an RVA.
            if stride == 32, Self.u32(descriptor, 0) & 1 == 0, UInt64(nameRVA) > imageBase {
                nameRVA = UInt32(truncatingIfNeeded: UInt64(nameRVA) - imageBase)
            }
            if let name = string(at: nameRVA) { names.append(name.lowercased()) }
        }
        return names
    }

    private func string(at rva: UInt32) -> String? {
        guard let offset = fileOffset(rva: rva), let raw = Self.read(handle, at: offset, count: 64) else {
            return nil
        }
        return String(bytes: raw.prefix { $0 != 0 }, encoding: .ascii)
    }

    private func fileOffset(rva: UInt32) -> UInt64? {
        for section in sections {
            let span = max(section.virtualSize, section.rawSize)
            if rva >= section.virtualAddress, rva < section.virtualAddress &+ span {
                return UInt64(rva - section.virtualAddress) + UInt64(section.rawPointer)
            }
        }
        return nil
    }

    private static func read(_ handle: FileHandle, at offset: UInt64, count: Int) -> Data? {
        guard (try? handle.seek(toOffset: offset)) != nil else { return nil }
        return try? handle.read(upToCount: count)
    }

    private static func u16(_ data: Data, _ offset: Int) -> UInt16 {
        data.subdata(in: offset ..< offset + 2).withUnsafeBytes { $0.loadUnaligned(as: UInt16.self) }
    }

    private static func u32(_ data: Data, _ offset: Int) -> UInt32 {
        data.subdata(in: offset ..< offset + 4).withUnsafeBytes { $0.loadUnaligned(as: UInt32.self) }
    }

    private static func u64(_ data: Data, _ offset: Int) -> UInt64 {
        data.subdata(in: offset ..< offset + 8).withUnsafeBytes { $0.loadUnaligned(as: UInt64.self) }
    }
}
