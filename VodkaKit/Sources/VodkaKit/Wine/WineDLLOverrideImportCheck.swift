//
//  WineDLLOverrideImportCheck.swift
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

extension Wine {
    /// The last document each bottle was sent, and when, from this process.
    @MainActor static var lastImports: [URL: (document: String, at: Date)] = [:]

    /// Whether the registry already holds `document`, so a launch can skip the
    /// import, which is a whole wine process ahead of the program it starts.
    ///
    /// wineserver writes `user.reg` some time after a change, up to half a
    /// minute, so for a while after an import the file still shows what was
    /// there before. Then the import itself is the answer: same document, same
    /// registry. Later the file is, and it also catches a change made outside
    /// Vodka, from winecfg say.
    @MainActor
    static func isAlreadyImported(
        _ document: String, scopes: [(key: String, overrides: [String: String])], bottle: Bottle
    ) -> Bool {
        if let last = lastImports[bottle.url], Date().timeIntervalSince(last.at) < 60 {
            return last.document == document
        }
        let current = dllOverrideSections(bottleURL: bottle.url)
        return scopes.allSatisfy { scope in
            let expected = Dictionary(
                scope.overrides
                    .filter { isRenderable(dll: $0.key, mode: $0.value) }
                    .map { ($0.key.lowercased(), $0.value.lowercased()) },
                uniquingKeysWith: { _, last in last }
            )
            return (current[scope.key.lowercased()] ?? [:]) == expected
        }
    }

    /// Every `DllOverrides` key in the prefix's `user.reg`, keyed by its
    /// lower-cased `HKCU\…` path, with each value lower-cased.
    static func dllOverrideSections(bottleURL: URL) -> [String: [String: String]] {
        guard let text = try? String(contentsOf: bottleURL.appending(path: "user.reg"), encoding: .utf8)
        else { return [:] }
        var sections: [String: [String: String]] = [:]
        var section: String?
        for line in text.split(separator: "\n", omittingEmptySubsequences: true) {
            if line.first == "[" {
                // Wine's own files double each backslash in a key's name.
                let path = line.dropFirst().prefix { $0 != "]" }.lowercased()
                    .replacingOccurrences(of: "\\\\", with: "\\")
                section = path.hasSuffix("\\dlloverrides") ? #"hkcu\"# + path : nil
                if let section { sections[section] = [:] }
            } else if let section, line.first == "\"" {
                let parts = line.dropFirst().split(separator: "\"", omittingEmptySubsequences: false)
                // "name"="value": the name, "=", the value, then the end of the line.
                guard parts.count >= 3, parts[1] == "=" else { continue }
                sections[section]?[parts[0].lowercased()] = parts[2].lowercased()
            }
        }
        return sections
    }
}
