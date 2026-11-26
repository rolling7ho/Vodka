# ``GmacKit``

A Swift framework for managing Wine bottles, graphics translation backends, Steam libraries, diagnostics, and Windows program execution on macOS.

## Overview

`GmacKit` provides the core logic for Gmac, `GmacCmd`, and `GmacThumbnail`. It handles:

- **Bottle Management:** create, configure, validate, repair, duplicate, export, migrate, and delete isolated Wine prefixes (presented as PCs in the application).
- **Wine Process Control:** build layered environments, resolve DLL overrides, execute Windows binaries, and stream process output.
- **Graphics and Runtime Installation:** install and verify the Wine runtime (`Libraries.tar.gz`), verify and deploy Apple Game Porting Toolkit (`D3DMetal`), resolve DirectX backends, and stage `GmacD3D12` (`gmacmetal`).
- **Steam and Game Database:** parse Steam VDF files and manifests, orchestrate Steam client launches, match games to `GameDB.json` presets, and track playtime.
- **Diagnostics and Troubleshooting:** classify Wine crash logs, export redacted diagnostic bundles, generate bounded stability reports, and drive guided troubleshooting and audio probe flows.
- **PE File and Shortcut Parsing:** parse Windows PE headers, extract icons and color palettes, parse `.lnk` shortcuts, and create Dock shortcut bundles.

## Topics

### Essentials

- <doc:GettingStarted>
- <doc:Architecture>

### Managing Bottles

- ``Bottle``
- ``BottleData``
- ``BottleOperations``
- ``BottleSettings``
- ``PinnedProgram``
- ``LegacyBottleImport``
- ``WhiskyBuildMigration``

### Running Programs

- ``Program``
- ``ProgramSettings``
- ``ProgramOverrides``
- ``Locales``
- ``ShortcutCreator``
- ``GmacURL``

### Wine Integration and Environment

- ``Wine``
- ``EnvironmentBuilder``
- ``EnvironmentLayer``
- ``EnvironmentProvenance``
- ``DLLOverrideResolver``
- ``DLLOverrideEntry``
- ``DLLOverrideMode``
- ``WineGameMode``
- ``WinePrefixValidation``
- ``WinePrefixDiagnostics``

### Graphics Backends and Runtime

- ``GmacWineInstaller``
- ``GmacWineVersion``
- ``GPTKImporter``
- ``GraphicsBackend``
- ``GraphicsBackendResolver``
- ``GraphicsAPIDetector``
- ``GmacD3D12``
- ``DistributionConfig``

### Configuration Types

- ``BottleWineConfig``
- ``BottleMetalConfig``
- ``BottleDXVKConfig``
- ``BottleGraphicsConfig``
- ``BottlePerformanceConfig``
- ``BottleLauncherConfig``
- ``BottleInputConfig``
- ``BottleAudioConfig``
- ``BottleDisplayConfig``
- ``BottleDiscordConfig``
- ``BottleCleanupConfig``
- ``WinVersion``
- ``EnhancedSync``
- ``DXVKHUD``

### Launchers, Steam, and Game Database

- ``LauncherType``
- ``LauncherFixes``
- ``MacOSCompatibilityFixes``
- ``GPUDetection``
- ``SteamInstaller``
- ``SteamLauncher``
- ``SteamLibrary``
- ``SteamClientOrchestrator``
- ``LaunchResolver``
- ``VDFParser``
- ``GameDBLoader``
- ``GameDBEntry``
- ``GameMatcher``
- ``GameConfigApplicator``
- ``LibraryCatalogue``
- ``PlaytimeStore``

### Diagnostics, Audio, and Discord

- ``CrashClassifier``
- ``CrashDiagnosis``
- ``DiagnosticExporter``
- ``StabilityDiagnostics``
- ``TroubleshootingFlowEngine``
- ``Redactor``
- ``AudioTroubleshootingEngine``
- ``DiscordBridge``
- ``DiscordPresence``

### PE File and Resource Parsing

- ``PEFile``
- ``Architecture``
- ``PEError``
- ``PEFile/COFFFileHeader``
- ``PEFile/OptionalHeader``
- ``PEFile/Section``
- ``ResourceDirectoryTable``
- ``ResourceDirectoryEntry``
- ``ResourceDataEntry``
- ``ResourceType``
