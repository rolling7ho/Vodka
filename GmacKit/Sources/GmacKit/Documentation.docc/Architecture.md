# Architecture Overview

This document describes how `GmacKit` components work together to manage Wine bottles, build launch environments, resolve graphics backends, and execute Windows programs on macOS.

## Overview

`GmacKit` separates Wine, bottle, Steam, graphics, diagnostics, and persistence logic from the SwiftUI application layer (`Gmac`) and CLI (`GmacCmd`).

```text
+-----------------------------------------------------------------------+
|                           Application Layer                           |
|                    (Gmac.app, GmacCmd, GmacThumbnail)                 |
+-----------------------------------------------------------------------+
|                                GmacKit                                |
|  +------------------+  +-------------------+  +--------------------+  |
|  | Bottle & Library |  |  Wine & Env       |  | Runtime & GPTK     |  |
|  | Management       |  |  Cascade          |  | (GmacWineInstaller)|  |
|  +------------------+  +-------------------+  +--------------------+  |
|  +------------------+  +-------------------+  +--------------------+  |
|  | Steam, Launchers |  |  Diagnostics &    |  | PE Parsing &       |  |
|  | & GameDB         |  |  Troubleshooting  |  | Shortcut Creation  |  |
|  +------------------+  +-------------------+  +--------------------+  |
+-----------------------------------------------------------------------+
|                             Wine Runtime                              |
|        (Libraries/Wine/bin/wine64, DXMT, DXVK, D3DMetal, GmacD3D12)   |
+-----------------------------------------------------------------------+
```

## Core Components

### Bottle Management

The bottle management layer manages isolated Wine prefixes:

| Component | Responsibility |
|---|---|
| ``Bottle`` | Represents an isolated Wine prefix (`@MainActor` isolated) |
| ``BottleData`` | Reads and persists the bottle registry (`BottleVM.plist`) and detects orphaned bottles |
| ``BottleSettings`` | Stores configuration for a bottle and populates `EnvironmentBuilder` layers |
| ``BottleWineConfig`` | Wine version, Windows version, enhanced sync, and AVX advertisement |
| ``BottleGraphicsConfig`` | Selected ``GraphicsBackend``, DLSS-to-MetalFX, and frame generation flags |
| ``BottleMetalConfig`` | Metal HUD, trace, validation, DXR, and Metal 4 settings |
| ``BottleDXVKConfig`` | DXVK async compilation and HUD settings |
| ``BottlePerformanceConfig`` | Shader cache, App Nap prevention, and VC++ tracking |
| ``BottleLauncherConfig`` | Launcher compatibility mode, detection mode, locale, GPU spoofing, and timeout |

Each bottle is stored as a directory on disk (by default under `~/Library/Containers/com.rolling7ho.Gmac/Bottles/<UUID>/`):

```text
MyBottle/
├── Metadata.plist                 # BottleSettings serialized as XML property list
├── drive_c/                       # Windows C: drive
│   ├── windows/
│   ├── Program Files/
│   ├── Program Files (x86)/
│   └── users/
└── Program Settings/              # Per-executable plists keyed by stem and path hash
    └── <stem>-<shortHash>.plist   # Automatically copied from legacy <exe>.plist if present
```

### Wine Execution and Environment Cascade

``Wine`` prepares the bottle, resolves the graphics backend, constructs the layered environment, composes `WINEDLLOVERRIDES`, and runs `wine64`:

```text
Wine.runProgram(at: url, bottle: bottle, ...)
       │
       ▼
┌────────────────────────────────────┐
│ Resolve graphics backend           │
│ (GraphicsBackendResolver + imports)│
└──────────────────┬─────────────────┘
                   │
                   ▼
┌────────────────────────────────────┐
│ Deploy DXVK / DXMT / GmacD3D12     │
│ and sync Windows AppDefaults       │
└──────────────────┬─────────────────┘
                   │
                   ▼
┌────────────────────────────────────┐
│ Build 9-layer EnvironmentBuilder   │
│ and compose WINEDLLOVERRIDES       │
└──────────────────┬─────────────────┘
                   │
                   ▼
┌────────────────────────────────────┐
│ Execute wine64 start /unix         │
│ and capture bounded log output     │
└──────────────────┬─────────────────┘
                   │
                   ▼
         Wine.ProgramRunResult
```

``EnvironmentBuilder`` resolves environment variables across nine priority-ordered ``EnvironmentLayer`` stages (higher layers override earlier layers per key):

1. ``EnvironmentLayer/base``: `WINEPREFIX`, default `WINEDEBUG`, and `PATH` defaults.
2. ``EnvironmentLayer/platform``: macOS compatibility overrides from ``MacOSCompatibilityFixes``.
3. ``EnvironmentLayer/bottleManaged``: bottle graphics, Metal, sync, performance, and controller toggles.
4. ``EnvironmentLayer/launcherManaged``: launcher presets, locale overrides, GPU spoofing, and network timeouts.
5. ``EnvironmentLayer/gameProfile``: environment entries from a matched ``GameDBEntry`` variant.
6. ``EnvironmentLayer/bottleUser``: user-defined bottle environment variables.
7. ``EnvironmentLayer/programUser``: per-program environment variables and locale.
8. ``EnvironmentLayer/featureRuntime``: launch-time diagnostic overrides.
9. ``EnvironmentLayer/callsiteOverride``: explicit overrides passed to `Wine.runProgram(environment:)`.

``DLLOverrideResolver`` composes managed overrides (DXVK, DXMT, `GmacD3D12`, launcher presets) with bottle and program custom ``DLLOverrideEntry`` lists.

### Program Discovery and Metadata

- ``Program`` represents a Windows `.exe` discovered under `drive_c`.
- ``ProgramSettings`` persists per-program arguments, environment variables, locale, ``ProgramOverrides``, and diagnostic metadata under `Program Settings/<stem>-<shortHash>.plist`.
- ``PinnedProgram`` tracks user-pinned programs on the bottle detail and library views.
- ``PEFile`` parses COFF headers, optional headers, section tables, and resource directories to determine 32-bit versus 64-bit architecture and extract icons.

### Steam, Launchers, and Game Database

- ``SteamInstaller``, ``SteamLibrary``, ``SteamClientOrchestrator``, and ``LaunchResolver`` manage Steam installation, VDF parsing, per-executable routing, and Steam game launches.
- ``LauncherFixes`` detects and configures Steam, Rockstar Games Launcher, EA App, Epic Games Store, Ubisoft Connect, Battle.net, and Paradox Launcher.
- ``GameDBLoader``, ``GameMatcher``, and ``GameConfigApplicator`` match installed titles against `GameDB.json` and apply reversible configuration snapshots.

## Thread Safety

`GmacKit` enforces Swift 6 strict concurrency:

- ``Bottle`` and ``Program`` are `@MainActor` isolated.
- Cross-actor identity access is exposed via `nonisolated` `id` properties.
- ``Wine`` execution methods require `@MainActor` context, while heavy filesystem walks (such as ``Bottle/discoverInstalledExecutables(driveC:blocklist:)``) and archive hashing run off the main actor.

```swift
@MainActor
func runGame(at gameURL: URL, in bottle: Bottle) async throws -> Wine.ProgramRunResult {
    try await Wine.runProgram(at: gameURL, bottle: bottle)
}
```

## Data Flow

Modifying ``Bottle/settings`` triggers a `didSet` observer on ``Bottle`` that synchronously encodes `Metadata.plist`. Before launching a program, callers such as ``LauncherFixes`` invoke ``Bottle/saveBottleSettings()`` when immediate persistence is required before Wine reads the prefix state.

## See Also

- <doc:GettingStarted>
- ``Bottle``
- ``Wine``
- ``GmacWineInstaller``
- ``EnvironmentBuilder``
