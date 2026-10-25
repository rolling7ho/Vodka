//
//  PlaytimeTests.swift
//  WhiskyKitTests
//
//  This file is part of Whisky.
//
//  Whisky is free software: you can redistribute it and/or modify it under the terms
//  of the GNU General Public License as published by the Free Software Foundation,
//  either version 3 of the License, or (at your option) any later version.
//
//  Whisky is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
//  without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
//  See the GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License along with Whisky.
//  If not, see https://www.gnu.org/licenses/.
//

@testable import WhiskyKit
import XCTest

final class PlaytimeTests: XCTestCase {
    func testSteamRecordsComeFromLocalConfigApps() throws {
        let text = """
        "UserLocalConfigStore"
        {
            "Software"
            {
                "Valve"
                {
                    "Steam"
                    {
                        "apps"
                        {
                            "1167630"
                            {
                                "LastPlayed"        "1792938811"
                                "Playtime2wks"      "887"
                                "Playtime"          "6148"
                            }
                            "228980"
                            {
                                "cloud" { "last_sync_state" "synchronized" }
                            }
                        }
                    }
                }
            }
        }
        """
        let records = SteamPlaytimeReader.records(fromDocument: try VDFParser.parse(text))

        XCTAssertEqual(records.count, 1)
        XCTAssertEqual(records.first?.appID, 1_167_630)
        XCTAssertEqual(records.first?.total, 6148 * 60)
        XCTAssertEqual(records.first?.lastTwoWeeks, 887 * 60)
        XCTAssertEqual(records.first?.lastPlayed, Date(timeIntervalSince1970: 1_792_938_811))
    }

    func testProgramTotalsSeedFromHistoryWithoutTheCurrentRun() {
        var history = RunLogHistory()
        var earlier = RunLogEntry(programName: "game.exe", logFileName: "a.log")
        earlier.endTime = earlier.startTime.addingTimeInterval(600)
        let running = RunLogEntry(programName: "game.exe", logFileName: "b.log")
        history.append(earlier)
        history.append(running)

        let playtime = ProgramPlaytime(history: history, excluding: earlier.id)
        XCTAssertEqual(playtime.sessions, 0)

        let all = ProgramPlaytime(history: history)
        XCTAssertEqual(all.sessions, 1)
        XCTAssertEqual(all.total, 600, accuracy: 0.001)
        XCTAssertEqual(all.longestSession, 600, accuracy: 0.001)
    }
}
