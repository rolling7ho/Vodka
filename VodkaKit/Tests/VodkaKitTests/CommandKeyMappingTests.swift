//
//  CommandKeyMappingTests.swift
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

@Suite("Command Key Mapping Tests")
@MainActor
struct CommandKeyMappingTests {
    private func makeBottle(userReg: String?) throws -> Bottle {
        let url = FileManager.default.temporaryDirectory.appending(path: "command-key-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        if let userReg {
            try userReg.write(to: url.appending(path: "user.reg"), atomically: true, encoding: .utf8)
        }
        return Bottle(bottleUrl: url)
    }

    @Test("A new bottle maps Command to Ctrl")
    func defaultIsOn() {
        #expect(BottleSettings().commandActsAsControl)
    }

    @Test("Settings saved before the option existed decode with it on")
    func missingKeyDecodesOn() throws {
        let config = try PropertyListDecoder().decode(
            BottleInputConfig.self, from: PropertyListEncoder().encode([String: Bool]())
        )
        #expect(config.commandActsAsControl)
    }

    @Test("A bottle without the keys gets both written")
    func writesMissingKeys() throws {
        let bottle = try makeBottle(userReg: nil)
        let document = Wine.commandKeyDocument(bottle: bottle)
        #expect(document.contains(#"[HKEY_CURRENT_USER\Software\Wine\Mac Driver]"#))
        #expect(document.contains(#""LeftCommandIsCtrl"="Y""#))
        #expect(document.contains(#""RightCommandIsCtrl"="Y""#))
    }

    @Test("A bottle already set costs nothing")
    func setBottleIsLeftAlone() throws {
        let bottle = try makeBottle(userReg: #"""
        WINE REGISTRY Version 2

        [Software\\Wine\\Mac Driver] 1788028146
        "LeftCommandIsCtrl"="y"
        "RightCommandIsCtrl"="Y"
        """#)
        #expect(Wine.commandKeyDocument(bottle: bottle).isEmpty)
    }

    @Test("Turned off, set keys are turned back off and unset ones left alone")
    func offClearsOnlySetKeys() throws {
        let bottle = try makeBottle(userReg: #"""
        WINE REGISTRY Version 2

        [Software\\Wine\\Mac Driver] 1788028146
        "LeftCommandIsCtrl"="Y"
        """#)
        bottle.settings.commandActsAsControl = false
        let document = Wine.commandKeyDocument(bottle: bottle)
        #expect(document.contains(#""LeftCommandIsCtrl"="N""#))
        #expect(!document.contains("RightCommandIsCtrl"))
    }
}
