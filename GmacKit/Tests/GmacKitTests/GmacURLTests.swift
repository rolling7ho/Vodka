//
//  GmacURLTests.swift
//  GmacKit
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

import Foundation
@testable import GmacKit
import Testing

@Suite("Gmac URL Tests")
struct GmacURLTests {
    private func parse(_ string: String) -> GmacURL.Request? {
        guard let url = URL(string: string) else { return nil }
        return GmacURL.parse(url)
    }

    // MARK: - The two forms

    @Test("A steam app id parses, with and without a bottle")
    func steamForm() {
        #expect(parse("gmac://launch?steam=1086940") == .steam(appId: 1_086_940, bottle: nil))
        #expect(
            parse("gmac://launch?steam=1086940&bottle=Steam") == .steam(appId: 1_086_940, bottle: "Steam")
        )
    }

    @Test("A pin name parses, with and without a bottle")
    func pinForm() {
        #expect(parse("gmac://launch?pin=ULTRAKILL") == .pin(name: "ULTRAKILL", bottle: nil))
        #expect(
            parse("gmac://launch?pin=ULTRAKILL&bottle=Games") == .pin(name: "ULTRAKILL", bottle: "Games")
        )
    }

    @Test("A percent-encoded pin name survives parsing")
    func pinNameIsDecoded() {
        #expect(parse("gmac://launch?pin=Deep%20Rock%20Galactic")
            == .pin(name: "Deep Rock Galactic", bottle: nil))
    }

    // MARK: - Everything a web page might try

    @Test("There is no path form, which is what makes this safe")
    func noPathForm() {
        #expect(parse("gmac://launch?path=/Users/me/evil.exe") == nil)
        #expect(parse("gmac://launch?exe=C:%5CWindows%5Csystem32%5Ccmd.exe") == nil)
        #expect(parse("gmac://launch?program=cmd.exe") == nil)
    }

    @Test("An unknown parameter rejects the whole url rather than the half it knows")
    func unknownParameterIsFatal() {
        // a future form must not degrade into this one on an older build
        #expect(parse("gmac://launch?steam=1086940&path=/evil.exe") == nil)
        #expect(parse("gmac://launch?pin=Game&elevate=1") == nil)
    }

    @Test("Naming both a steam id and a pin is ambiguous, so neither runs")
    func bothFormsAtOnce() {
        #expect(parse("gmac://launch?steam=1086940&pin=Game") == nil)
    }

    @Test("A url that says nothing to launch parses to nothing")
    func emptyRequest() {
        #expect(parse("gmac://launch") == nil)
        #expect(parse("gmac://launch?bottle=Steam") == nil)
        #expect(parse("gmac://launch?pin=") == nil)
    }

    @Test("An app id that is not a positive number is refused")
    func malformedAppID() {
        #expect(parse("gmac://launch?steam=notanumber") == nil)
        #expect(parse("gmac://launch?steam=") == nil)
        #expect(parse("gmac://launch?steam=0") == nil)
        #expect(parse("gmac://launch?steam=-1") == nil)
    }

    @Test("Another scheme or another host is not ours")
    func wrongSchemeOrHost() {
        #expect(parse("steam://launch?steam=1086940") == nil)
        #expect(parse("https://example.com/launch?steam=1086940") == nil)
        #expect(parse("gmac://install?steam=1086940") == nil)
        #expect(parse("gmac://launch/extra?steam=1086940") != nil)
    }

    @Test("Scheme and host are matched case-insensitively, as the loader hands them over")
    func caseInsensitiveSchemeAndHost() {
        #expect(parse("GMAC://LAUNCH?steam=1086940") == .steam(appId: 1_086_940, bottle: nil))
    }

    @Test("An empty bottle name is the same as not naming one")
    func emptyBottleIsNoBottle() {
        #expect(parse("gmac://launch?steam=1086940&bottle=") == .steam(appId: 1_086_940, bottle: nil))
    }
}
