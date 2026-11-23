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

    @Test("GTA V gets Option as Alt, under its own key and whatever the name's case")
    func gtaGetsOptionAsAlt() throws {
        let bottle = try makeBottle(userReg: nil)
        for exe in ["GTA5_Enhanced.exe", "gta5.exe"] {
            let document = WineGameInput.document(bottle: bottle, gameExecutables: [exe])
            #expect(document.contains(#"AppDefaults\\#(exe)\Mac Driver]"#))
            #expect(document.contains(#""LeftOptionIsAlt"="y""#))
            #expect(document.contains(#""RightOptionIsAlt"="y""#))
        }
    }

    @Test("Other games keep Option as it is")
    func otherGamesKeepOption() throws {
        let bottle = try makeBottle(userReg: nil)
        let document = WineGameInput.document(bottle: bottle, gameExecutables: ["teardown.exe"])
        #expect(document.contains("ScrollMomentum"))
        #expect(!document.contains("OptionIsAlt"))
    }

    @Test("GTA V already set costs nothing")
    func gtaAlreadySetIsLeftAlone() throws {
        let bottle = try makeBottle(userReg: #"""
        WINE REGISTRY Version 2

        [Software\\Wine\\AppDefaults\\GTA5_Enhanced.exe\\Mac Driver] 1788028146
        "LeftOptionIsAlt"="Y"
        "MetalFXUpscale"="y"
        "RightOptionIsAlt"="y"
        "ScrollMomentum"="n"
        "UpscaleSharpness"="50"
        "UsePreciseScrolling"="n"
        """#)
        #expect(WineGameInput.document(bottle: bottle, gameExecutables: ["GTA5_Enhanced.exe"]).isEmpty)
    }
}
