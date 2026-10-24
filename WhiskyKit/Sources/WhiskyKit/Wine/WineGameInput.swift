//
//  WineGameInput.swift
//  WhiskyKit
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

import Foundation

/// Input settings games get from the mac driver, per executable.
///
/// A trackpad or Magic Mouse keeps sending scroll events after the fingers
/// lift, to coast. A game reads every one as a wheel notch, so it goes on
/// switching weapons or zooming after the player stopped, which reads as
/// scrolling that lags behind. The engine's `ScrollMomentum` option (from
/// 4.6.6) drops those events; it is set under each game's own `AppDefaults`
/// key, so Steam and other programs in the bottle still coast.
enum WineGameInput {
    /// The registry changes the bottle's games still need, or an empty string.
    @MainActor
    static func document(bottle: Bottle, gameExecutables: [String]) -> String {
        Wine.dpiAwareExecutables(bottle: bottle, gameExecutables: gameExecutables)
            .filter { exe in
                WineRegistryFile.readValue(
                    bottleURL: bottle.url,
                    key: #"HKCU\Software\Wine\AppDefaults\"# + exe + #"\Mac Driver"#,
                    valueName: "ScrollMomentum"
                )?.lowercased() != "n"
            }
            .map { exe in
                "[HKEY_CURRENT_USER\\Software\\Wine\\AppDefaults\\\(exe)\\Mac Driver]\n\"ScrollMomentum\"=\"n\"\n\n"
            }
            .joined()
    }
}
