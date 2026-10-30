//
//  DistributionConfig.swift
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
import SemanticVersion

public enum DistributionConfig {
    /// Base URL for GitHub Pages distribution
    public static let baseURL = "https://frankea.github.io/Whisky"

    /// URL for the VodkaWine version plist file
    public static let versionPlistURL = "\(baseURL)/WhiskyWineVersion.plist"

    /// Base URL for GitHub Releases downloads
    public static let releasesBaseURL = "https://github.com/frankea/Whisky/releases/download"

    /// URL for the Sparkle appcast feed
    public static let appcastURL = "\(baseURL)/appcast.xml"

    /// The engine this edition installs instead of the channel's: the
    /// winecx-gptk build (CrossOver 26's changes on Wine 11.16, which runs
    /// Apple's D3DMetal for DirectX 12) with this edition's Retina fix to the
    /// mac driver, its scroll, MetalFX upscaling and sharpening options, and
    /// its fixes for Steam's menus, app names, Dock icon and scaled fullscreen
    /// modes.
    /// Published on this fork's releases; its version, release tag and the
    /// archive's SHA-256.
    public static let gamingRuntime = (
        version: SemanticVersion(4, 6, 12),
        tag: "4.6.12-gaming.1",
        sha256: "c921be15b98fcb63cf9ef2a1b0f4c1eb5da161fcccf2b5267ec5bec6df785088"
    )

    /// Where this edition's engine releases live.
    public static let gamingReleasesBaseURL = "https://github.com/rolling7ho/Vodka/releases/download"

    /// The download URL for this edition's engine.
    public static var gamingRuntimeURL: String {
        "\(gamingReleasesBaseURL)/v\(gamingRuntime.tag)/Libraries.tar.gz"
    }

    /// Constructs the download URL for Wine Libraries from GitHub Releases
    /// - Parameter version: The version string (e.g., "2.5.0")
    /// - Returns: The full URL to download Libraries.tar.gz from GitHub Releases
    public static func librariesURL(version: String) -> String {
        "\(releasesBaseURL)/v\(version)/Libraries.tar.gz"
    }
}
