//
//  RunningWinePrograms.swift
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

/// What Wine is running right now, read from the Mac's process list.
///
/// From `ps` rather than ``ProcessRegistry``: the registry only knows what this
/// launch of Vodka started, and Steam, a game it started, or a game opened
/// from a Dock shortcut while Vodka was closed are all missing from it.
public enum RunningWinePrograms {
    /// Whether any Wine server is up, which is true while anything at all runs
    /// in a PC, background services included.
    public static var anyRunning: Bool {
        processList().contains { $0.contains("/bin/wineserver") }
    }

    /// The names of the programs a person would recognise as running, such as
    /// "Steam" and "Teardown", without Wine's services and Steam's helpers.
    public static func names() -> [String] {
        names(fromArguments: processList())
    }

    static func names(fromArguments arguments: [String]) -> [String] {
        let pattern = /[A-Za-z]:\\[^"]*?\\([^\\"]+?)\.exe/.ignoresCase()
        var seen = Set<String>()
        var result: [String] = []
        for line in arguments {
            guard let match = line.firstMatch(of: pattern) else { continue }
            let image = String(match.1)
            guard ProcessKind.classify("\(image).exe") == .app,
                  !helperNames.contains(image.lowercased())
            else { continue }
            let name = displayName(for: image)
            if seen.insert(name.lowercased()).inserted {
                result.append(name)
            }
        }
        return result
    }

    /// Processes that run beside a program rather than being one.
    private static let helperNames: Set<String> = [
        "steamwebhelper", "steamservice", "crashhandler", "crashhandler64",
        "steamerrorreporter", "steamerrorreporter64",
        "gameoverlayui", "gameoverlayui64", "unitycrashhandler64", "winedbg", "wineconsole",
        "vodkadiscordbridge"
    ]

    /// "steam" reads as "Steam"; a name already in mixed case is the game's own.
    static func displayName(for image: String) -> String {
        guard image == image.lowercased() || image == image.uppercased() else { return image }
        return image.prefix(1).uppercased() + image.dropFirst().lowercased()
    }

    /// Each process's command line.
    private static func processList() -> [String] {
        let list = Process()
        list.executableURL = URL(filePath: "/bin/ps")
        list.arguments = ["-axww", "-o", "args="]
        let pipe = Pipe()
        list.standardOutput = pipe
        list.standardError = FileHandle.nullDevice
        do {
            try list.run()
        } catch {
            return []
        }
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        list.waitUntilExit()
        guard let output = String(bytes: data, encoding: .utf8) else { return [] }
        return output.split(separator: "\n").map(String.init)
    }
}
