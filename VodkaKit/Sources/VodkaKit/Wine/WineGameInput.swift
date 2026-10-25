//
//  WineGameInput.swift
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

/// Mac driver settings games get, per executable.
///
/// A trackpad or Magic Mouse keeps sending scroll events after the fingers
/// lift, to coast. A game reads every one as a wheel notch, so it goes on
/// switching weapons or zooming after the player stopped, which reads as
/// scrolling that lags behind. The engine's `ScrollMomentum` option (from
/// 4.6.6) drops those events.
///
/// `UsePreciseScrolling` off has a trackpad scroll reach the game as whole
/// wheel notches, the first one on the first event of a swipe. Left on, the
/// game gets the trackpad's own deltas, a few twentieths of a notch each, and
/// a game that adds them up only acts once enough have arrived: the scroll
/// lands near the end of the swipe rather than at its start. Off, the driver
/// sends a notch at once and holds back the next until the swipe has covered
/// it, so the speed is the same and the delay is gone. A clicky wheel sends
/// whole notches either way.
///
/// `MetalFXUpscale` (from 4.6.7) has a game that renders below its window's
/// pixel size, as one set to Faster does, upscaled with MetalFX instead of
/// stretched, so Faster keeps its frame rate with a much sharper image. It
/// does nothing for a game already rendering every pixel.
///
/// `UpscaleSharpness` (from 4.6.8) sharpens that upscale, 0 to 100, with
/// FSR 1's RCAS pass: MetalFX's spatial scaler softens edges and has no
/// sharpening of its own.
///
/// All are set under each game's own `AppDefaults` key, so Steam and other
/// programs in the bottle keep the defaults.
enum WineGameInput {
    private static let values = [
        ("ScrollMomentum", "n"), ("UsePreciseScrolling", "n"), ("MetalFXUpscale", "y"), ("UpscaleSharpness", "50")
    ]

    /// The registry changes the bottle's games still need, or an empty string.
    @MainActor
    static func document(bottle: Bottle, gameExecutables: [String]) -> String {
        Wine.dpiAwareExecutables(bottle: bottle, gameExecutables: gameExecutables).map { exe in
            let key = #"HKCU\Software\Wine\AppDefaults\"# + exe + #"\Mac Driver"#
            let missing = values.filter { name, value in
                WineRegistryFile.readValue(bottleURL: bottle.url, key: key, valueName: name)?.lowercased() != value
            }
            guard !missing.isEmpty else { return "" }
            return "[HKEY_CURRENT_USER\\Software\\Wine\\AppDefaults\\\(exe)\\Mac Driver]\n"
                + missing.map { "\"\($0.0)\"=\"\($0.1)\"\n" }.joined() + "\n"
        }
        .joined()
    }
}
