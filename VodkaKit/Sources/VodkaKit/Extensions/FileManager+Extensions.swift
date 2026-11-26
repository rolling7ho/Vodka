//
//  FileManager+Extensions.swift
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

extension FileManager {
    func replaceDLLs(
        in destinationDirectory: URL, withContentsIn sourceDirectory: URL, makeOriginalCopy: Bool = false
    ) throws {
        let enumerator = FileManager.default.enumerator(
            at: sourceDirectory, includingPropertiesForKeys: [.isRegularFileKey]
        )

        while let fileURL = enumerator?.nextObject() as? URL {
            // Skip non-DLL entries and keep scanning. The enumerator is
            // recursive, so it also yields subdirectory URLs and stray files
            // (.DS_Store, license text). Using `return` here would abort the
            // whole copy on the first such entry, silently leaving later DLLs
            // uninstalled.
            guard fileURL.pathExtension.lowercased() == "dll" else { continue }
            let originalURL = destinationDirectory.appending(path: fileURL.lastPathComponent)
            // Every launch on DXVK lands here. A copy keeps its source's size
            // and date, so a match is the same file, already in place.
            if !makeOriginalCopy, isSameFile(originalURL, as: fileURL) { continue }
            try FileManager.default.replaceFile(at: originalURL, with: fileURL, makeOriginalCopy: makeOriginalCopy)
        }
    }

    /// Whether `url` has the same size and modification date as `sourceURL`.
    private func isSameFile(_ url: URL, as sourceURL: URL) -> Bool {
        let keys: Set<URLResourceKey> = [.fileSizeKey, .contentModificationDateKey]
        guard let installed = try? url.resourceValues(forKeys: keys),
              let source = try? sourceURL.resourceValues(forKeys: keys),
              installed.fileSize != nil, installed.contentModificationDate != nil
        else { return false }
        return installed.fileSize == source.fileSize
            && installed.contentModificationDate == source.contentModificationDate
    }

    /// Installs `sourceURL` at `destinationURL`, replacing any existing file —
    /// unlike ``replaceFile(at:with:makeOriginalCopy:)``, the copy also happens
    /// when the destination does not exist yet. A silently skipped install
    /// would leave a translation layer half-deployed with no error.
    ///
    /// The replace is non-destructive on failure: the source is copied to a
    /// sibling temp file first and only swapped into place once the copy
    /// succeeds, so an unreadable source or an interrupted copy can never leave
    /// the destination missing (which would degrade even unrelated launches
    /// when the destination is a shared runtime file).
    func installFile(at destinationURL: URL, from sourceURL: URL) throws {
        let destPath = destinationURL.path(percentEncoded: false)
        let entryExists = (try? attributesOfItem(atPath: destPath)) != nil
        guard entryExists else {
            try copyItem(at: sourceURL, to: destinationURL)
            return
        }
        // Remove a dangling symlink directly because replaceItemAt fails on it.
        if !fileExists(atPath: destPath) {
            try removeItem(at: destinationURL)
            try copyItem(at: sourceURL, to: destinationURL)
            return
        }
        let tempURL = destinationURL.appendingPathExtension("vodka-tmp-\(UUID().uuidString)")
        try copyItem(at: sourceURL, to: tempURL)
        do {
            _ = try replaceItemAt(destinationURL, withItemAt: tempURL)
        } catch {
            try? removeItem(at: tempURL)
            throw error
        }
    }

    /// Installs `sourceURL` at `destinationURL` only when the destination is
    /// missing or its contents differ. Returns `true` when a copy happened.
    /// Used for idempotent placement of runtime components that a runtime
    /// update may revert (the installer replaces all of `Libraries/`).
    @discardableResult
    func installFileIfContentDiffers(at destinationURL: URL, from sourceURL: URL) throws -> Bool {
        if fileExists(atPath: destinationURL.path(percentEncoded: false)),
           let existing = try? Data(contentsOf: destinationURL),
           let replacement = try? Data(contentsOf: sourceURL),
           existing == replacement {
            return false
        }
        try installFile(at: destinationURL, from: sourceURL)
        return true
    }

    func replaceFile(at originalURL: URL, with replacementURL: URL, makeOriginalCopy: Bool = true) throws {
        guard fileExists(atPath: originalURL.path(percentEncoded: false)) else { return }
        if makeOriginalCopy {
            let copyURL = originalURL.appendingPathExtension("orig")

            if (try? attributesOfItem(atPath: copyURL.path(percentEncoded: false))) != nil {
                try removeItem(at: copyURL)
            }

            try moveItem(at: originalURL, to: copyURL)
            do {
                try copyItem(at: replacementURL, to: originalURL)
            } catch {
                try? moveItem(at: copyURL, to: originalURL)
                throw error
            }
        } else {
            try installFile(at: originalURL, from: replacementURL)
        }
    }
}
