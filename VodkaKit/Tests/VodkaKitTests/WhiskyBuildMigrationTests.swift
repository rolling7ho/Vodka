//
//  WhiskyBuildMigrationTests.swift
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

final class WhiskyBuildMigrationTests: XCTestCase {
    var home: URL!
    var defaults: UserDefaults!
    var suite: String!

    override func setUp() {
        super.setUp()
        home = FileManager.default.temporaryDirectory.appending(path: "migration_\(UUID().uuidString)")
        suite = "migration-test-\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suite)
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: home)
        defaults.removePersistentDomain(forName: suite)
        defaults.removePersistentDomain(forName: "test.Whisky")
        defaults.removePersistentDomain(forName: "test.Vodka")
        super.tearDown()
    }

    private var locations: WhiskyBuildMigration.Locations {
        .init(home: home, oldIdentifier: "test.Whisky", newIdentifier: "test.Vodka")
    }

    private func write(_ text: String, to path: String) throws {
        let url = home.appending(path: path)
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try text.write(to: url, atomically: true, encoding: .utf8)
    }

    func testNothingToMoveIsRecordedAsDone() {
        let outcome = WhiskyBuildMigration.runIfNeeded(locations: locations, defaults: defaults) { _ in nil }
        XCTAssertEqual(outcome, .notNeeded)
        XCTAssertTrue(defaults.bool(forKey: WhiskyBuildMigration.doneKey))
    }

    func testABlockedMigrationMovesNothing() throws {
        try write("x", to: "Library/Containers/test.Whisky/BottleVM.plist")
        let outcome = WhiskyBuildMigration.runIfNeeded(locations: locations, defaults: defaults) { _ in "open" }
        XCTAssertEqual(outcome, .blocked(reason: "open"))
        XCTAssertTrue(FileManager.default.fileExists(
            atPath: home.appending(path: "Library/Containers/test.Whisky/BottleVM.plist").path
        ))
        XCTAssertFalse(defaults.bool(forKey: WhiskyBuildMigration.doneKey))
    }

    func testFoldersMoveAndRecordedPathsFollow() throws {
        let oldBottle = home.appending(path: "Library/Containers/test.Whisky/Bottles/PC")
        let registry = try PropertyListEncoder().encode(["paths": [oldBottle]])
        try FileManager.default.createDirectory(at: oldBottle, withIntermediateDirectories: true)
        try registry.write(to: home.appending(path: "Library/Containers/test.Whisky/BottleVM.plist"))

        let binary = PropertyListEncoder()
        binary.outputFormat = .binary
        try binary.encode(["log": home.appending(path: "Library/Logs/test.Whisky/a.log").path])
            .write(to: oldBottle.appending(path: "Metadata.plist"))
        try write(
            #""Marlett"="Z:\\Users\\me\\Library\\Application Support\\test.Whisky\\Libraries\\fonts""# + "\n",
            to: "Library/Containers/test.Whisky/Bottles/PC/user.reg"
        )
        try write("engine", to: "Library/Application Support/test.Whisky/Libraries/version")
        try write(
            "WHISKY_CMD=\"/Applications/Whisky.app/Contents/Resources/WhiskyCmd\"\n",
            to: "Applications/Game.app/Contents/MacOS/launch"
        )

        let outcome = WhiskyBuildMigration.runIfNeeded(locations: locations, defaults: defaults) { _ in nil }
        XCTAssertEqual(outcome, .migrated)

        let newBottle = home.appending(path: "Library/Containers/test.Vodka/Bottles/PC")
        let oldContainer = home.appending(path: "Library/Containers/test.Whisky")
        XCTAssertFalse(FileManager.default.fileExists(atPath: oldContainer.path))
        XCTAssertTrue(FileManager.default.fileExists(
            atPath: home.appending(path: "Library/Application Support/test.Vodka/Libraries/version").path
        ))

        let paths = try PropertyListDecoder().decode(
            [String: [URL]].self,
            from: Data(contentsOf: home.appending(path: "Library/Containers/test.Vodka/BottleVM.plist"))
        )
        let registered = paths["paths"]?.first?.path(percentEncoded: false).trimmingCharacters(in: ["/"])
        XCTAssertEqual(registered, newBottle.path(percentEncoded: false).trimmingCharacters(in: ["/"]))

        let metadata = try PropertyListDecoder().decode(
            [String: String].self, from: Data(contentsOf: newBottle.appending(path: "Metadata.plist"))
        )
        XCTAssertEqual(metadata["log"], home.appending(path: "Library/Logs/test.Vodka/a.log").path)

        let reg = try String(contentsOf: newBottle.appending(path: "user.reg"), encoding: .utf8)
        XCTAssertTrue(reg.contains(#"Application Support\\test.Vodka\\Libraries"#))

        let launcher = try String(
            contentsOf: home.appending(path: "Applications/Game.app/Contents/MacOS/launch"), encoding: .utf8
        )
        XCTAssertEqual(launcher, "VODKA_CMD=\"/Applications/Vodka.app/Contents/Resources/VodkaCmd\"\n")
    }

    func testOnlyFolderNamesAreRewritten() {
        XCTAssertEqual(
            WhiskyBuildMigration.rewritten(
                "/L/test.Whisky/x and test.Whisky.WineGame", old: "test.Whisky", new: "test.Vodka"
            ),
            "/L/test.Vodka/x and test.Whisky.WineGame"
        )
    }
}
