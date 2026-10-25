# Getting Started with VodkaKit

Learn how to integrate VodkaKit into your macOS application to manage Wine bottles and run Windows programs.

## Overview

VodkaKit provides a high-level API for managing Wine bottles—isolated Windows environments that contain their own registry, installed programs, and configuration. This guide walks you through the basic setup and common operations.

## Prerequisites

Before using VodkaKit, ensure that:

1. Your app runs on macOS 15.0 or later
2. VodkaWine is installed via ``VodkaWineInstaller``
3. Rosetta 2 is installed (for Apple Silicon Macs)

## Adding VodkaKit to Your Project

Add VodkaKit as a dependency in your `Package.swift`:

```swift
dependencies: [
    .package(path: "../VodkaKit")
],
targets: [
    .target(
        name: "YourApp",
        dependencies: ["VodkaKit"]
    )
]
```

## Installing VodkaWine

Before managing bottles, you need to install the Wine runtime:

```swift
import VodkaKit

// Check if VodkaWine is installed
if !VodkaWineInstaller.isVodkaWineInstalled() {
    // Download and install VodkaWine
    let tarballURL = // ... download VodkaWine tarball
    do {
        try VodkaWineInstaller.install(from: tarballURL)
    } catch {
        print("Install failed: \(error.localizedDescription)")
    }
}

// Check for updates
let (shouldUpdate, newVersion) = await VodkaWineInstaller.shouldUpdateVodkaWine()
if shouldUpdate {
    print("Update available: \(newVersion)")
}
```

## Creating a Bottle

Create an isolated Wine environment for your Windows applications:

```swift
import VodkaKit

// Create a bottle at a specific location
let bottleURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    .appendingPathComponent("MyApp")
    .appendingPathComponent("Bottles")
    .appendingPathComponent("MyBottle")

// Initialize the bottle
let bottle = Bottle(bottleUrl: bottleURL)

// Configure bottle settings
bottle.settings.name = "My Windows Environment"
bottle.settings.windowsVersion = .win10
```

## Running a Windows Program

Execute a Windows application within a bottle:

```swift
import VodkaKit

@MainActor
func runProgram(at url: URL, in bottle: Bottle) async throws {
    // Run the program
    try await Wine.runProgram(at: url, bottle: bottle)
}

// With custom arguments and environment
@MainActor
func runWithOptions(at url: URL, in bottle: Bottle) async throws {
    let environment = ["WINEDEBUG": "-all"]
    try await Wine.runProgram(
        at: url,
        args: ["-windowed"],
        bottle: bottle,
        environment: environment
    )
}
```

## Discovering Installed Programs

Find Windows executables in a bottle:

```swift
import VodkaKit

@MainActor
func discoverPrograms(in bottle: Bottle) {
    // Programs are automatically populated when loading a bottle
    for program in bottle.programs {
        print("Found: \(program.name)")
        
        // Check program architecture
        if let arch = program.peFile?.architecture.toString() {
            print("  Architecture: \(arch)")
        }
    }
    
    // Access pinned programs
    for (pin, program, _) in bottle.pinnedPrograms {
        print("Pinned: \(pin.name)")
    }
}
```

## Configuring Performance Settings

Optimize bottles for different scenarios:

```swift
import VodkaKit

@MainActor
func configurePerformance(bottle: Bottle) {
    // Enable DXVK for better DirectX performance
    bottle.settings.dxvk = true
    bottle.settings.dxvkAsync = true
    
    // Enable Metal HUD for debugging
    bottle.settings.metalHud = true
}
```

## Next Steps

- Learn about the <doc:Architecture> to understand how VodkaKit components work together
- Explore ``BottleSettings`` for all available configuration options
- See ``Wine`` for advanced Wine process management
