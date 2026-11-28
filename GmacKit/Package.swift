// swift-tools-version: 6.0
//
//  Package.swift
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

import PackageDescription

let package = Package(
    name: "GmacKit",
    platforms: [
        .macOS(.v15)
    ],
    products: [
        .library(
            name: "GmacKit",
            targets: ["GmacKit"]
        ),
        .executable(
            name: "gmac-bridge",
            targets: ["GmacBridge"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/SwiftPackageIndex/SemanticVersion.git", from: "0.4.0"),
        .package(url: "https://github.com/swiftlang/swift-docc-plugin", from: "1.4.3")
    ],
    targets: [
        .target(
            name: "GmacKit",
            dependencies: ["SemanticVersion"],
            resources: [
                .process("Diagnostics/Resources/"),
                .process("GameDatabase/Resources/"),
                .process("Troubleshooting/Resources/"),
                // Copied rather than processed: it is a PE binary built by
                // scripts/discord-bridge, not something the resource pipeline
                // should try to interpret.
                .copy("Discord/Resources/GmacDiscordBridge.exe"),
                // Carries `client-id.txt` when a build was given one. The file
                // is gitignored, so a plain checkout copies an empty directory.
                .copy("Discord/Local")
            ]
        ),
        .executableTarget(
            name: "GmacBridge",
            dependencies: ["GmacKit", "SemanticVersion"]
        ),
        .testTarget(
            name: "GmacKitTests",
            dependencies: ["GmacKit"]
        )
    ],
    swiftLanguageModes: [.v6]
)
