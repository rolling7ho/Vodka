# Getting Started with GmacKit

This guide explains how to integrate `GmacKit` into a macOS application to install the Wine runtime, create bottles, configure graphics backends, and run Windows programs.

## Prerequisites

Before using `GmacKit`, verify that:

1. Your target runs on macOS 15.0 or later on Apple Silicon.
2. Rosetta 2 is installed for x86_64 Windows execution.
3. The Wine runtime (`Libraries.tar.gz`) is installed via ``GmacWineInstaller``.

## Adding GmacKit to Your Project

Add `GmacKit` as a dependency in `Package.swift`:

```swift
dependencies: [
    .package(path: "../GmacKit")
],
targets: [
    .target(
        name: "YourApp",
        dependencies: ["GmacKit"]
    )
]
```

## Installing GmacWine

Check whether the Wine runtime is installed and install from a verified `Libraries.tar.gz` archive:

```swift
import GmacKit
import SemanticVersion

@MainActor
func ensureRuntimeInstalled(tarballURL: URL, expectedSHA256: String) async throws {
    if !GmacWineInstaller.isGmacWineInstalled() {
        let integrity = GmacWineInstaller.integrityResult(
            forFileAt: tarballURL,
            expectedSHA256: expectedSHA256
        )
        guard integrity == .match else {
            return
        }
        try GmacWineInstaller.install(from: tarballURL)
        GmacWineInstaller.cleanupTarball(at: tarballURL)
    }

    let (shouldUpdate, newVersion): (Bool, SemanticVersion) =
        await GmacWineInstaller.shouldUpdateGmacWine()
    if shouldUpdate {
        print("Update available: \(newVersion)")
    }
}
```

## Creating a Bottle

Create an isolated Wine prefix under ``BottleData/defaultBottleDir`` (or a custom directory) and register it in ``BottleData``:

```swift
import Foundation
import GmacKit

@MainActor
func createBottle(named name: String) throws -> Bottle {
    let bottleURL = BottleData.defaultBottleDir.appending(path: UUID().uuidString)
    try FileManager.default.createDirectory(
        at: bottleURL,
        withIntermediateDirectories: true
    )

    let bottle = Bottle(bottleUrl: bottleURL)
    bottle.settings.name = name
    bottle.settings.windowsVersion = .win10
    bottle.saveBottleSettings()

    var registry = BottleData()
    _ = registry.registerBottlePath(bottleURL)
    return bottle
}
```

## Running a Windows Program

Execute a Windows `.exe` within a bottle using ``Wine/runProgram(at:args:bottle:environment:programOverrides:programSettings:gameProfileEnvironment:overridesApplyToDescendants:descendantExecutables:descendantLaunchers:onOutput:)``:

```swift
import Foundation
import GmacKit

@MainActor
func runProgram(at url: URL, in bottle: Bottle) async throws -> Wine.ProgramRunResult {
    try await Wine.runProgram(
        at: url,
        args: ["-windowed"],
        bottle: bottle,
        environment: ["WINEDEBUG": "-all"]
    )
}
```

## Discovering Installed Programs

Inspect executables discovered in a bottle and read parsed PE architecture metadata:

```swift
import GmacKit

@MainActor
func discoverPrograms(in bottle: Bottle) {
    for program in bottle.programs {
        print("Found: \(program.name)")

        if let arch = program.peFile?.architecture.toString() {
            print("  Architecture: \(arch)")
        }
    }

    for (pin, _, _) in bottle.pinnedPrograms {
        print("Pinned: \(pin.name)")
    }
}
```

## Configuring Graphics Settings

Select a bottle graphics backend via ``BottleSettings/graphicsBackend`` and tune performance options:

```swift
import GmacKit

@MainActor
func configureGraphics(bottle: Bottle) {
    // Let GraphicsBackendResolver choose D3DMetal, DXMT, or DXVK per game
    bottle.settings.graphicsBackend = .recommended
    bottle.settings.shaderCacheEnabled = true

    // Enable the Metal performance HUD overlay when needed
    bottle.settings.metalHud = true
}
```

## Next Steps

- Read <doc:Architecture> to understand the 9-layer environment cascade and backend resolution.
- Review ``BottleSettings`` for all available bottle configuration options.
- Review ``Wine`` for process management, registry helpers, and log handling.
