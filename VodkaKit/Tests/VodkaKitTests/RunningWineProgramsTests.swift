//
//  RunningWineProgramsTests.swift
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

final class RunningWineProgramsTests: XCTestCase {
    func testNamesProgramsAndSkipsServicesAndHelpers() {
        let lines = [
            "/Applications/Vodka.app/Libraries/Wine/bin/wineserver",
            "C:\\windows\\system32\\services.exe",
            "C:\\windows\\system32\\winedevice.exe",
            "C:\\Program Files (x86)\\Steam\\steam.exe -silent",
            "C:\\Program Files (x86)\\Steam\\bin\\cef\\cef.win7x64\\steamwebhelper.exe --type=renderer",
            "\"C:\\Program Files (x86)\\Steam\\steamapps\\common\\Teardown\\teardown.exe\"",
            "C:\\Program Files (x86)\\Steam\\bin\\cef\\cef.win7x64\\steamwebhelper.exe --type=gpu",
            "C:\\Program Files (x86)\\Steam\\GameOverlayUI.exe -pid 42",
            "c:\\games\\Celeste\\Celeste.exe"
        ]
        let names = RunningWinePrograms.names(fromArguments: lines)
        XCTAssertTrue(names.contains("Steam"))
        XCTAssertTrue(names.contains("Teardown"))
        XCTAssertTrue(names.contains("Celeste"))
        XCTAssertFalse(names.contains { $0.lowercased().hasPrefix("services") })
        XCTAssertFalse(names.contains { $0.lowercased().hasPrefix("winedevice") })
        XCTAssertFalse(names.contains("GameOverlayUI"))
        XCTAssertFalse(names.contains { $0.lowercased() == "steamwebhelper" })
        XCTAssertEqual(names.filter { $0 == "Steam" }.count, 1)
    }

    func testDisplayNameKeepsMixedCase() {
        XCTAssertEqual(RunningWinePrograms.displayName(for: "steam"), "Steam")
        XCTAssertEqual(RunningWinePrograms.displayName(for: "HOLLOWKNIGHT"), "Hollowknight")
        XCTAssertEqual(RunningWinePrograms.displayName(for: "RDR2"), "Rdr2")
        XCTAssertEqual(RunningWinePrograms.displayName(for: "EldenRing"), "EldenRing")
    }
}
