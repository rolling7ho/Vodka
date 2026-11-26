//
//  BridgeIconExporter.swift
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
import CryptoKit
import Foundation
import GmacKit

/// Exports PE executable icons to cached PNG files on disk so GPUI can render
/// them via standard file-backed image views without passing raw bitmaps over JSON-RPC.
actor BridgeIconExporter {
    static let shared = BridgeIconExporter()

    private let cacheDir: URL
    private var resolvedPaths: [String: String] = [:]

    private init() {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        cacheDir = caches
            .appending(path: Bundle.gmacBundleIdentifier)
            .appending(path: "gpui-icons")
        try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
    }

    func exportIconPath(for url: URL?) async -> String? {
        guard let url else { return nil }
        let rawPath = url.path(percentEncoded: false)
        let ext = url.pathExtension.lowercased()

        // Steam cached icons and artwork are already raster images on disk.
        if ext == "jpg" || ext == "jpeg" || ext == "png" {
            return FileManager.default.fileExists(atPath: rawPath) ? rawPath : nil
        }

        if let cached = resolvedPaths[rawPath],
           FileManager.default.fileExists(atPath: cached) {
            return cached
        }

        let digest = SHA256.hash(data: Data(rawPath.utf8))
        let hex = digest.prefix(12).map { String(format: "%02x", $0) }.joined()
        let outURL = cacheDir.appending(path: "\(hex).png")
        let outPath = outURL.path(percentEncoded: false)

        if FileManager.default.fileExists(atPath: outPath) {
            resolvedPaths[rawPath] = outPath
            return outPath
        }

        guard let image = await IconCache.shared.icon(for: url),
              let tiff = image.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiff),
              let pngData = bitmap.representation(using: .png, properties: [:])
        else {
            return nil
        }

        do {
            try pngData.write(to: outURL, options: .atomic)
            resolvedPaths[rawPath] = outPath
            return outPath
        } catch {
            return nil
        }
    }
}
