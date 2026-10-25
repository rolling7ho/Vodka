//
//  CompatibilityWarning.swift
//  Vodka
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
import VodkaKit

/// What the game database knows that someone should hear before pressing Play:
/// anti-cheat that refuses Wine, or a game that is known not to run.
struct CompatibilityWarning {
    let label: String
    let detail: String

    /// GameDB entries by Steam App ID, read once.
    @MainActor private static let bySteamApp: [Int: GameDBEntry] = Dictionary(
        GameDBLoader.loadDefaults().compactMap { entry in entry.steamAppId.map { ($0, entry) } },
        uniquingKeysWith: { first, _ in first }
    )

    @MainActor
    init?(item: LibraryEntry) {
        guard case let .steam(appID) = item.launch, let entry = Self.bySteamApp[appID] else { return nil }
        let broken = entry.rating == .broken || entry.rating == .notSupported
        if let antiCheat = entry.antiCheat {
            label = broken ? "Won't run" : "Offline only"
            detail = "\(entry.title) uses \(antiCheat) anti-cheat, which blocks Wine. "
                + (broken ? "It doesn't start on a Mac this way." : "Online modes won't work; offline play may.")
        } else if broken {
            label = "Known issues"
            detail = "\(entry.title) is known not to run well on a Mac yet."
        } else {
            return nil
        }
    }
}
