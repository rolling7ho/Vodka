# Runtime dependencies

Gmac builds its native macOS application from this repository, downloads a pinned Wine gaming runtime (`Libraries.tar.gz`) during setup, optionally embeds a custom DirectX 12 bridge (`gmacmetal`), and consumes user-supplied Apple D3DMetal from Game Porting Toolkit. This document records the pinned versions, source repositories, SHA-256 digests, and update cadence so builds remain reproducible.

See [`ReleaseWorkflow.md`](ReleaseWorkflow.md) for the release and runtime publication procedures, and [`.github/workflows/RuntimeTrack.yml`](../.github/workflows/RuntimeTrack.yml) for automated upstream drift tracking.

## Active gaming runtime (`v4.6.12-gaming.1`)

The application pins `DistributionConfig.gamingRuntime` in [`GmacKit/Sources/GmacKit/Utils/DistributionConfig.swift`](../GmacKit/Sources/GmacKit/Utils/DistributionConfig.swift):

| Field | Value |
|---|---|
| **Version** | `4.6.12` |
| **Release tag** | `v4.6.12-gaming.1` |
| **Download URL** | `https://github.com/rolling7ho/gmac/releases/download/v4.6.12-gaming.1/Libraries.tar.gz` |
| **Asset size** | `458.79 MiB` |
| **SHA-256** | `c921be15b98fcb63cf9ef2a1b0f4c1eb5da161fcccf2b5267ec5bec6df785088` |

### Runtime selection logic

At setup and update time (`GmacWineDownloadView.swift` and `GmacWineInstaller.shouldUpdateGmacWine()`), Gmac fetches `DistributionConfig.versionPlistURL` (`https://frankea.github.io/Whisky/WhiskyWineVersion.plist`). When the legacy channel version (`3.1.1`) is older than `DistributionConfig.gamingRuntime.version` (`4.6.12`), Gmac downloads `DistributionConfig.gamingRuntimeURL` instead and verifies the archive against `DistributionConfig.gamingRuntime.sha256` before extraction. The installer fails closed on any SHA-256 mismatch.

### Source and bundled translation layers

`v4.6.12-gaming.1` is built from the `winecx-gptk` lane (CrossOver 26 changes on Wine 11.16) using [`runtime/local-build.rb`](../runtime/local-build.rb) with `MACOSX_DEPLOYMENT_TARGET=15.0` and `HAVE_PIPE2` left undefined so the Mac display driver (`winemac.so`) runs on macOS 15 and macOS 26 as well as newer releases.

| Component | Version or commit | Source | Notes |
|---|---|---|---|
| **Wine / CrossOver (`winecx`)** | `cea5139d87afca768e1d77d8f263492ae45172a3` | [rolling7ho/winecx](https://github.com/rolling7ho/winecx) (`d3dmetal-errno` branch) | Wine 11.16 with CrossOver 26 changes, the Retina fix for hosted Metal layers, Steam Dock/menu/fullscreen fixes, and the `ntdll` `errno` stack fix for D3DMetal 4 worker threads. |
| **DXMT** | `0.80` | [3Shain/dxmt](https://github.com/3Shain/dxmt/releases) | Direct3D 11 and 10 to Metal. Last MIT-licensed release (`v1.0` and later are LGPL; moving past `0.80` requires an explicit relicensing decision). Native `d3d11.dll`, `dxgi.dll`, and `d3d10core.dll` reside in `Libraries/DXMT/{x64,x32}` for per-bottle deployment, while builtin `winemetal.dll` and `winemetal.so` reside in the Wine library tree. |
| **DXVK (macOS)** | `1.10.3` | [Gcenx/DXVK-macOS](https://github.com/Gcenx/DXVK-macOS/releases) | Frozen at `1.10.x` by design. DXVK `2.x` requires Vulkan 1.3 features that MoltenVK and macOS do not expose. |
| **MoltenVK** | Bundled in the runtime lane | [KhronosGroup/MoltenVK](https://github.com/KhronosGroup/MoltenVK/releases) | Vulkan to Metal translation underpinning the DXVK path. |
| **msync** | Included in `winecx` | [marzent/wine-msync](https://github.com/marzent/wine-msync) | Mach-based synchronization patch integrated into the Wine build. |

## User-supplied Apple D3DMetal (Game Porting Toolkit)

Apple D3DMetal is proprietary software owned by Apple and is never bundled in `Libraries.tar.gz` or committed to this repository. Users obtain the Game Porting Toolkit disk image directly from [Apple Developer](https://developer.apple.com/games/game-porting-toolkit/) and import it through **Gmac Settings › Graphics** or the PC **Graphics** picker.

`GPTKImporter` verifies Apple's code signature on every binary and checks that `external/` contains no unsealed items, stores the payload outside `Libraries/` so it persists across runtime updates, and deploys it into `Libraries/Wine/lib/` only when the installed Wine runtime is GPTK-capable. When D3DMetal is not deployed, `GraphicsBackendResolver` selects **DXMT** (or **DXVK** if DXMT is unavailable) for Automatic bottles.

## Optional Gmac DirectX 12 layer (`GmacD3D12`)

Gmac includes support for a separate DirectX 12 to Metal bridge (`gmacmetal`) built from [rolling7ho/dxmt](https://github.com/rolling7ho/dxmt) (`teardown` branch). Because its unix-call bridge uses the `gmacmetal` name instead of `winemetal`, it sits beside the runtime's DirectX 11 DXMT payload without interfering with it.

[`scripts/build-gmac-d3d12.sh`](../scripts/build-gmac-d3d12.sh) cross-compiles the 64-bit and 32-bit DLLs and unixlib from a sibling `../dxmt` checkout (or `$GMAC_DXMT_DIR`) and stages them into `build/gmac-d3d12/`. [`scripts/install-local.sh`](../scripts/install-local.sh) embeds `build/gmac-d3d12/` into `Gmac.app/Contents/Resources/GmacD3D12/` when present.

## Bundled inside the application

Several tools ship directly inside `Gmac.app/Contents/Resources/` rather than inside `Libraries.tar.gz`, so updates reach users through normal application releases without a runtime download.

| Resource | Pinned version | Repository path | Notes |
|---|---|---|---|
| **winetricks** | `20260125` | [`Libraries/winetricks`](../Libraries/winetricks) | POSIX shell script (LGPL-2.1+) from [Winetricks/winetricks](https://github.com/Winetricks/winetricks/releases/tag/20260125). Copied by the "Embed GmacCmd" build phase and asserted by CI. |
| **verbs.txt** | Generated from `20260125` | [`Libraries/verbs.txt`](../Libraries/verbs.txt) | Verb catalog displayed in the Winetricks sheet. Regenerate after bumping winetricks with `sh Libraries/winetricks list-all` and remove the leading platform-warning line so the file starts at the first `=====` header. |
| **cabextract** | Prebuilt arm64 Mach-O | [`Libraries/cabextract`](../Libraries/cabextract) | Extracts Microsoft `.cab` archives for winetricks verbs, from [cabextract.org.uk](https://www.cabextract.org.uk/). Code-signed on copy. |
| **GmacDiscordBridge.exe** | Committed PE binary | [`GmacKit/Sources/GmacKit/Discord/Resources/GmacDiscordBridge.exe`](../GmacKit/Sources/GmacKit/Discord/Resources/GmacDiscordBridge.exe) | Built from [`scripts/discord-bridge/bridge.c`](../scripts/discord-bridge/bridge.c) with `mingw-w64`. Relays the Discord RPC named pipe to the host macOS socket. |
| **GmacAudioTest.exe** | Committed PE binary | [`Gmac/Resources/GmacAudioTest.exe`](../Gmac/Resources/GmacAudioTest.exe) | Built from [`scripts/gmac_audio_test.c`](../scripts/gmac_audio_test.c) via [`scripts/build_audio_test.sh`](../scripts/build_audio_test.sh). Used by audio troubleshooting probes. |

Swift Package Manager dependencies declared in `Gmac.xcodeproj` and `GmacKit/Package.swift`:

- [Sparkle](https://github.com/sparkle-project/Sparkle): application auto-updater.
- [SemanticVersion](https://github.com/SwiftPackageIndex/SemanticVersion): version parsing and comparisons.
- [swift-argument-parser](https://github.com/apple/swift-argument-parser): command-line parsing for `GmacCmd`.
- [swift-docc-plugin](https://github.com/swiftlang/swift-docc-plugin): DocC documentation generation for `GmacKit`.

## Legacy channel (`v3.1.1`) and archive integrity

Prior to the custom `rolling7ho/winecx` gaming runtime, the upstream fork channel published `Libraries.tar.gz` assemblies via [`scripts/assemble-runtime.sh`](../scripts/assemble-runtime.sh) and [`dist/pages/WhiskyWineVersion.plist`](../dist/pages/WhiskyWineVersion.plist). [`.github/workflows/RuntimeTrack.yml`](../.github/workflows/RuntimeTrack.yml) continues to track upstream Wine (`Gcenx/macOS_Wine_builds` `11.0_1`), DXVK (`Gcenx/DXVK-macOS` `v1.10.3-20230507-repack`), and DXMT (`3Shain/dxmt` `v0.80`) weekly.

| Artifact | SHA-256 |
|---|---|
| `Libraries.tar.gz` (`v4.6.12-gaming.1`) | `c921be15b98fcb63cf9ef2a1b0f4c1eb5da161fcccf2b5267ec5bec6df785088` |
| `Libraries.tar.gz` (`v3.1.1`) | `01f3a1b43b98065fe20c529c1023b61dd79a6d2ad93bba6040865f646481ccf3` |
| `Libraries.tar.gz` (`v3.1.0`) | `86e2d54a60736f27e6ce82cacf2a91e500c20f6d32ae959a16afd912e6b03096` |
| `Libraries.tar.gz` (`v3.0.0`) | `9c3d2a7d9bb682ae8398d8bae458e3cb52bb9f5a3345fb0830a64d9b6a1025f8` |

When publishing any runtime release, compute the digest of the exact uploaded `Libraries.tar.gz` file with `shasum -a 256 Libraries.tar.gz` and update `DistributionConfig.gamingRuntime` (for gaming runtimes) or `dist/pages/WhiskyWineVersion.plist` (for legacy channel builds), together with this table.

## Tracking cadence

- **Gaming runtime (`rolling7ho/winecx` and `rolling7ho/dxmt`):** update manually when upstream CrossOver/Wine changes, Retina fixes, or D3DMetal compatibility fixes are needed. Rebuild via `runtime/local-build.rb` and verify with `scripts/build-gmac-d3d12.sh`.
- **Upstream Wine, DXVK-macOS, and DXMT feeds:** `.github/workflows/RuntimeTrack.yml` polls these GitHub release feeds weekly and opens an issue if a pinned tag falls behind. Bumping any pin is a manual, tested decision.
- **D3DMetal (Game Porting Toolkit):** Apple distributes GPTK without a GitHub release feed; monitor [Apple's GPTK page](https://developer.apple.com/games/game-porting-toolkit/) manually for compatibility changes.
- **winetricks:** releases approximately monthly and is bumped manually when a verb download URL breaks or a new dependency is required.
- **Security:** critical Wine, DXVK, or DXMT vulnerabilities trigger an out-of-band runtime rebuild and application release per [`SECURITY.md`](../SECURITY.md).
