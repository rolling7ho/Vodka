# Runtime dependencies

The Vodka application is built from this repository, but the **Wine runtime** it downloads
during setup (`Libraries.tar.gz`) is assembled from third-party binaries. This document is
the authoritative record of which versions are bundled and where they originate, so that
the runtime cannot become stale silently and any maintainer can reproduce a build. Update
it whenever a runtime release is produced.

See [`ReleaseWorkflow.md`](ReleaseWorkflow.md) for the assembly and publication procedure,
and [`.github/workflows/RuntimeTrack.yml`](../.github/workflows/RuntimeTrack.yml) for the
automation that reports when a bundled component falls behind upstream.

The application currently pins the `gamingRuntime` release `4.6.12-gaming.1` in
`VodkaKit/Sources/VodkaKit/Utils/DistributionConfig.swift`. The table below records the most
recent fully documented assembly, `v3.1.1`; complete it when the pinned runtime is
documented.

## Bundled in runtime `v3.1.1`

| Component | Bundled version | Upstream source | Notes |
|-----------|-----------------|-----------------|-------|
| **Wine** | 11.0 (Gcenx `11.0_1` repack) | [Gcenx/macOS_Wine_builds](https://github.com/Gcenx/macOS_Wine_builds/releases) | Wine publishes a new stable release each January; 11.0 is the January 2026 release. The Gcenx tag is `11.0_1`, a repack of the same Wine 11.0 after the bare `11.0` tag was retired. `RuntimeTrack.yml` pins that exact tag. |
| **DXVK (macOS)** | 1.10.3 | [Gcenx/DXVK-macOS](https://github.com/Gcenx/DXVK-macOS/releases) | Frozen at 1.10.x **by design**: the DXVK 2.x line requires Vulkan 1.3 features that MoltenVK and macOS do not expose. The pin is intentional; do not upgrade to upstream 2.x. |
| **DXMT** | 0.80 | [3Shain/dxmt](https://github.com/3Shain/dxmt/releases) | Direct3D 11 to Metal. Bundled from the project's prebuilt v0.80 release, the **last MIT-licensed** build (v1.0 and later are LGPL; moving past 0.80 is a deliberate relicensing decision, not routine drift). The release ships only the `wine_builtin_dll=true` asset, whose trio carries winebuild's "Wine builtin DLL" header marker and is intended for a global `lib/wine` installation. For per-bottle selection, `scripts/assemble-runtime.sh` strips that marker from `d3d11`, `dxgi` and `d3d10core` (x64 and x32), reproducing the project's `wine_builtin_dll=false` (native) variant, and stages them in `Libraries/DXMT/{x64,x32}`. The application then copies the native trio into each bottle's `system32` and `syswow64` with `dxgi,d3d11,d3d10core=n,b`, as it does for DXVK. `winemetal` remains a builtin: its `winemetal.dll` is synchronised into both Wine Windows trees, paired with `winemetal.so` in the Unix tree, and the application copies it into the prefix as the import redirect. Selectable per bottle or per program in app 3.4.0 and later (Experimental); requires a runtime assembled by the current script, because the older builtin-variant payload is rejected, since it would redirect to WineD3D without reporting an error. |
| **D3DMetal** | from Apple Game Porting Toolkit | [Apple GPTK](https://developer.apple.com/games/game-porting-toolkit/) | **Apple-proprietary. Extracted, never built.** Redistribution is governed by Apple's GPTK license; review its terms before bumping. Not bundled in the published runtime, and used only when a GPTK payload exists on disk. Since app 3.5.2 the Recommended backend resolves to DXMT or DXVK when the payload is absent, and the picker disables D3DMetal rather than offering a silent WineD3D fallback. |
| **MoltenVK** | confirm against the published archive | [KhronosGroup/MoltenVK](https://github.com/KhronosGroup/MoltenVK/releases) | Vulkan to Metal translation; underpins the DXVK path. |
| **msync** | confirm against the published archive | [marzent/wine-msync](https://github.com/marzent/wine-msync) | Mach-based synchronisation patch included in the Gcenx build. |

> The exact MoltenVK and msync versions are contained in the published `Libraries.tar.gz`,
> not in this repository. When producing a runtime release, read them from the build and
> record them here so that this table remains authoritative.

### Archive integrity

| Artifact | SHA-256 |
|----------|---------|
| `Libraries.tar.gz` (`v3.1.1`) | `01f3a1b43b98065fe20c529c1023b61dd79a6d2ad93bba6040865f646481ccf3` |
| `Libraries.tar.gz` (`v3.1.0`) | `86e2d54a60736f27e6ce82cacf2a91e500c20f6d32ae959a16afd912e6b03096` |
| `Libraries.tar.gz` (`v3.0.0`) | `9c3d2a7d9bb682ae8398d8bae458e3cb52bb9f5a3345fb0830a64d9b6a1025f8` |

The same digest is published in
[`dist/pages/WhiskyWineVersion.plist`](../dist/pages/WhiskyWineVersion.plist) under the
`sha256` key. The application verifies the downloaded archive against it before
installation and **fails closed** on a mismatch, the common cause of which is a corrupted
or truncated download. This is an integrity check, not a substitute for transport security.
When producing a runtime release, compute the digest of the exact published asset
(`shasum -a 256 Libraries.tar.gz`) and update **both** this table and the plist; an
incorrect value blocks every fresh installation.

## Bundled in the application

These files ship **inside the application bundle** (`Vodka.app/Contents/Resources/`). They
are committed to this repository under [`Libraries/`](../Libraries) and copied in by the
application target's "Embed VodkaCmd" build phase. They are **not** part of the downloaded
`Libraries.tar.gz` runtime: bundling them in the application means that a fix reaches every
installation through a normal application update, with no runtime download.

| Component | Pinned version | Upstream source | Notes |
|-----------|----------------|-----------------|-------|
| **winetricks** | `20260125` | [Winetricks/winetricks](https://github.com/Winetricks/winetricks/releases/tag/20260125) | Self-contained POSIX shell script (LGPL-2.1+). Drives dependency installations (VC++, .NET, DirectX, fonts) and verb queries. Invoked as `bash winetricks <verb>` with the bundled `cabextract` and the runtime's `Wine/bin` on `PATH`. To bump, fetch `src/winetricks` at a newer release tag and regenerate `verbs.txt`. |
| **verbs.txt** | generated from winetricks `20260125` | produced by `winetricks list-all` | Verb catalog displayed in the Winetricks browser. Regenerate whenever winetricks is bumped: `sh Libraries/winetricks list-all`, then remove the leading platform-warning line so the file begins at the first `=====` category header. |
| **cabextract** | prebuilt arm64 binary | [cabextract.org.uk](https://www.cabextract.org.uk/) | Extracts Microsoft `.cab` archives and is a hard dependency of many winetricks verbs. Committed as a Mach-O executable that is code-signed on copy. |

## Tracking cadence

- **Wine:** check each January for the new stable release (next expected: Wine 12,
  approximately January 2027). Test before bundling.
- **Wine, DXVK-macOS and DXMT:** `RuntimeTrack.yml` polls these GitHub release feeds weekly
  and opens an issue when a bundled version falls behind. Triage is manual; bumping is a
  deliberate and tested decision.
- **D3DMetal (GPTK):** Apple distributes it as a Game Porting Toolkit download without a
  GitHub release feed, so it is **tracked manually**. Check Apple's GPTK page when a new
  GPTK is released.
- **Security:** a critical Wine or DXVK CVE should trigger an out-of-band runtime rebuild and
  application release. See `SECURITY.md`.
- **winetricks:** releases approximately monthly and is tracked manually, since no feed
  exists in `RuntimeTrack.yml`. Bump it when a required verb's download URL breaks or a new
  component is required. It ships with an application release, not a runtime release.

## Rationale for consuming upstream binaries

Building and maintaining the macOS Wine runtime is the most specialised and fragile task in
this ecosystem; it is effectively the full-time role of the Gcenx project and CodeWeavers'
paid team. On a project with a single maintainer, assuming that responsibility would
increase the bus-factor risk it is intended to reduce. The project therefore consumes
upstream binaries and invests in discipline instead: pinned versions, automated staleness
detection and a documented, reproducible assembly procedure.
