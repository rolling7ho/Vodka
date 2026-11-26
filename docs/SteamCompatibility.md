# Steam compatibility guide

**Feature:** Launcher compatibility system (frankea/Whisky#41)
**Last updated:** 12 January 2026

> **Note:** This document references issue numbers from this fork (frankea/Whisky) and from
> the original upstream project (whisky-app/whisky). Upstream references are retained for
> historical context. Report new issues to
> [rolling7ho/Vodka](https://github.com/rolling7ho/Vodka/issues).

## Overview

Steam is the most commonly used launcher with Vodka and accounts for the largest share of
launcher compatibility reports. This guide describes the recommended configuration and the
known failure modes.

## Recommended configuration

### Step 1: Create a dedicated Steam bottle

1. Create a new bottle with the name "Steam" and Windows version **Windows 10**
   (recommended), at the default location.
2. Open **Config → Launcher Compatibility** and enable **Launcher Compatibility Mode**.
3. Set **Detection Mode** to **Automatic**. Launching Steam should then report
   "Detected Launcher: Steam".

### Step 2: Install Steam

1. Download `SteamSetup.exe`, the Windows installer, from
   <https://store.steampowered.com/about/>.
2. Select **Bottle → Run**, choose `SteamSetup.exe` and accept the default installation
   path (`C:\Program Files (x86)\Steam\`).
3. Steam starts automatically after installation. If `steamwebhelper.exe` fails, see the
   first issue below.

### Step 3: Configure graphics and network settings

1. Leave the graphics backend on **Recommended**. Steam's own processes (`steam.exe`,
   `steamwebhelper.exe`, `steamservice.exe`, `gameoverlayui64.exe`) receive DXVK through
   per-executable overrides, so the client renders through DXVK while games retain the
   bottle's backend. When the D3DMetal payload is installed, the recommended backend is
   D3DMetal, which DirectX 12 games require.
   A game started from the Vodka library, from `vodka launch` or from a `vodka://` link
   receives its own settings from the Programs tab and the game database, applied to its
   own executables regardless of which process starts it.
   On a runtime without the D3DMetal payload, **Play** switches the bottle to DXVK.
   Importing the Game Porting Toolkit later restores the recommended backend once, with a
   note in the bottle's graphics settings, unless DXVK was selected explicitly.
   Setting the entire bottle to DXVK disables Direct3D 12 for every game when the payload is
   deployed; do this only for a bottle whose games all require DXVK.
2. In **Config → Launcher Compatibility**, set the network timeout to **90 seconds**.
3. In the same section, enable **GPU Spoofing** with the **NVIDIA** vendor, which provides
   the best compatibility.

### Step 4: Verify the configuration

1. In **Config → Launcher Compatibility**, select **Generate Diagnostics Report**.
2. Confirm the critical settings:

   ```
   LC_ALL = en_US.UTF-8                      # required; prevents steamwebhelper failure
   STEAM_DISABLE_CEF_SANDBOX = 1             # required; CEF under Wine
   STEAM_RUNTIME = 0                         # required; Steam Runtime under Wine
   DXVK_ASYNC = 1                            # UI performance
   ```

3. Review the reported warnings. "Configuration is optimal" indicates a complete setup;
   any warning requires the corresponding change.

## Common issues

### Issue 1: "steamwebhelper is not responding"

This is the most frequent Steam issue.

**Symptoms**

- The Steam window reports an error immediately after launch.
- A dialog states that `steamwebhelper.exe` is not responding, and the restart and wait
  options do not help.
- The Steam interface is unusable.

**Cause**

Steam's Chromium Embedded Framework (CEF) fails when the locale does not specify UTF-8
encoding, when ICU fails to initialise, or when date and time parsing encounters an
unexpected format.

**Solution**

1. Open **Config → Launcher Compatibility** and enable compatibility mode.
2. Set **Locale Override** to **English**.
3. Generate diagnostics and confirm `LC_ALL=en_US.UTF-8`.

The `.UTF-8` suffix is required. `en_US` alone does not resolve the failure.

```
LC_ALL=en_US.UTF-8   # correct
LC_ALL=en_US         # incorrect; steamwebhelper still fails
```

If the failure persists, delete the Steam installation, create a new bottle with
compatibility mode enabled before installation, install Steam again and verify the locale
before the first launch.

**Related issues:** whisky-app/whisky#946, #1224, #1241.

### Issue 2: Downloads stall at 99 percent

**Symptoms**

- Progress reaches 99 percent and does not complete.
- The "Download starting…" message repeats.
- Steam must be restarted to continue.
- The behaviour occurs with several games.

**Cause**

Wine's HTTP implementation misbehaves with persistent connections under some conditions,
so downloads time out before completion.

**Solution**

1. Open **Config → Launcher Compatibility** and set **Network Timeout** to **90 seconds** or
   higher, then restart Steam. The timeout configures `WINHTTP_CONNECT_TIMEOUT`, and
   `WINHTTP_RECEIVE_TIMEOUT` is set to twice that value.
2. Alternatively, in Steam open **Settings → Downloads**, select a different download
   region, pause and resume the download, and clear the download cache.

Longer timeouts prevent premature connection closure. Vodka does not set
`WINE_FORCE_HTTP11` or `WINE_MAX_CONNECTIONS_PER_SERVER`; earlier versions of this guide
listed variables that no shipped runtime reads.

**Related issues:** whisky-app/whisky#1148, #1072, #991, #1222.

### Issue 3: Steam disconnects repeatedly

**Symptoms**

- "No connection" errors occur every few minutes.
- Reconnection is required repeatedly, and download progress is lost.
- The friends list disconnects.

**Cause**

Network keepalive timeouts and TLS handshake behaviour under Wine.

**Solution**

1. Raise the network timeout to **120 seconds** or more.
2. Generate diagnostics and confirm that the locale and sandbox variables listed under
   Step 4 are present. Vodka does not set `WINE_ENABLE_SSL` or `WINE_SSL_VERSION_MIN`.
3. In **System Settings → Network**, confirm a stable connection and temporarily disable
   any VPN for testing.

**Related issues:** whisky-app/whisky#1176, #954.

### Issue 4: Steam interface is blurry or stutters

**Symptoms**

- Text appears blurry or pixelated.
- Interface animations stutter and scrolling is uneven.
- Window dragging lags.

**Solution**

1. Enable **DXVK Async** in **Config → DXVK** and restart Steam. DXVK provides better GPU
   acceleration for the Steam interface.
2. If text remains blurry, adjust the DPI under **Config → Wine → DPI Configuration**,
   selecting 96 DPI (standard) or 192 DPI (Retina).

**Related issues:** whisky-app/whisky#1256, #1233.

### Issue 5: Steam starts without a visible interface

**Symptoms**

- The Steam process runs but no window appears, or the window is blank.
- Notification sounds are audible.

**Solution**

1. Select **Bottle → Kill All Processes**.
2. Enable compatibility mode if it is not already enabled.
3. Enable DXVK, disable Metal validation if enabled, and enable Sequoia compatibility mode
   on macOS 15 or later.
4. Generate diagnostics and confirm `CEF_DISABLE_SANDBOX=1`.

If the interface remains invisible, delete Steam, reinstall it, and inspect
`~/Library/Logs/com.rolling7ho.Vodka/` for errors.

**Related issues:** whisky-app/whisky#1183, #1009.

## macOS 15.4 and later

**Symptoms**

- Steam worked on macOS 15.3 and fails to start after updating to 15.4 or 15.4.1.
- Wine preloader threads remain blocked.
- Mach port timeouts occur.

**Cause**

Apple changed Mach port and threading behaviour in macOS 15.4, which breaks Wine's process
creation.

**Solution**

1. Enable **Config → Metal → Sequoia Compatibility Mode**.
2. Generate diagnostics and confirm the macOS version and the following variables:

   ```
   WINEFSYNC = 0
   STEAM_RUNTIME = 0
   CEF_DISABLE_SANDBOX = 1
   ```

3. Terminate all Wine processes and relaunch Steam.

**Related issues:** whisky-app/whisky#1372, #1310, #1307.

## Advanced configuration

### Launch options

For individual games started through Steam, open the game's **Properties** and set launch
options. Common values:

```
-windowed    force windowed mode
-dx11        force Direct3D 11
-nojoy       disable joystick support
-novid       skip introductory videos
```

### Big Picture mode

Big Picture generally works with compatibility mode enabled. Enable DXVK for performance,
connect the controller before launching, and exit through the Steam menu rather than forcing
the process to quit.

### Steam Workshop

Workshop content generally works with compatibility mode enabled. If it fails, raise the
network timeout to 180 seconds, confirm that no firewall blocks the download, and install
the content manually as a fallback.

### Steam Cloud

Cloud saves are generally functional. Confirm that the game has Cloud enabled under
**Properties → Updates**, and test synchronisation by launching the same game from a second
bottle.

## Performance tuning

**Frame rate**

- Enable DXVK and DXVK Async.
- Leave the DXVK HUD off unless diagnosing a problem.
- Enable the shader cache after the first run to reduce stuttering.

**Stability**

- Set Enhanced Sync to ESync under **Config → Wine**.
- Use Windows 10, which is the most tested Windows version.
- Enable AVX only for games that require it.

**Download throughput**

- Set the network timeout to 120 to 180 seconds.
- Select a geographically close download region.
- Clear the Steam download cache.
- Prefer a wired connection where possible.

## Pre-report checklist

Before reporting a Steam issue, confirm the following:

- Launcher Compatibility Mode is enabled.
- The locale is `en_US.UTF-8`.
- DXVK is enabled.
- The network timeout is at least 90 seconds.
- Sequoia Compatibility Mode is enabled on macOS 15 or later.
- A diagnostics report has been generated and its warnings reviewed.
- The issue reproduces in a clean bottle.
- Wine logs have been checked for errors.

## Known limitations

**Supported:** Steam client features (store, library, friends), game downloads, most
Direct3D 9, 10 and 11 games, Workshop content, Cloud saves in most cases, achievements and
screenshots.

**Limited:** Steam Input controller configuration, the Steam overlay (game dependent).

**Unsupported:** broadcasting, Remote Play and VR.

**Game compatibility:** Direct3D 9 and 11 games generally work well, older titles work
well, and Direct3D 12 titles vary. Multiplayer with kernel-level anti-cheat varies by
title, and VR titles are unsupported.

## Reporting issues

Include the following:

1. The diagnostics report, attached to the issue.
2. The Steam version and build date (**Help → About Steam**).
3. The exact error message and the point at which it occurs (sign-in, download, launch).
4. Reproduction steps.
5. System details: macOS version, Mac model and available disk space.

Example report:

```markdown
**Issue:** Steam downloads stall at 99 percent

**System:**
- macOS 15.4.1
- M2 Pro MacBook Pro
- Vodka version 4.x
- Steam version: December 2025 build

**Configuration:**
- Launcher Compatibility: enabled
- Network Timeout: 60 seconds
- DXVK: enabled

**Steps to reproduce:**
1. Queue a large game download.
2. Progress reaches 99 percent.
3. The download stalls indefinitely.
4. Restarting Steam resumes the download, which stalls again at 99 percent.

**Diagnostics report:** attached

**Attempted fixes:**
- Changed the download region; no change.
- Raised the timeout to 90 seconds; the download still stalls.
- Cleared the download cache; no change.
```

## Further resources

- Steam support: <https://help.steampowered.com/>
- Launcher troubleshooting: [LauncherTroubleshooting.md](LauncherTroubleshooting.md)
- Issue tracker: <https://github.com/rolling7ho/Vodka/issues>
- Upstream project: <https://github.com/whisky-app/whisky>

## Comparison of execution methods

| Method | Setup effort | Compatibility | Performance | Assessment |
|---|---|---|---|---|
| Vodka with launcher compatibility | Low | High | Good | Recommended |
| Native macOS Steam | Low | macOS titles only | Native | Limited catalog |
| CrossOver | Medium | High | Good | Commercial |
| Virtual machine | High | High | Fair | Resource intensive |
| Boot Camp | High | Complete | Complete | Requires reboot |

Vodka is free and open source, requires no reboot, integrates with macOS, and applies the
compatibility configuration described above automatically once launcher compatibility is
enabled.

## FAQ

**Can an existing Steam library be reused?**
Games must be downloaded again, or restored from a Steam backup. Save files may not transfer
automatically, and individual games may require configuration.

**Does Steam report that the machine runs macOS?**
No. Steam reports the Windows version presented by Wine.

**Does the Workshop work?**
Generally yes. Raise the network timeout for large Workshop items.

**Does the Steam overlay work?**
This depends on the game; some titles do not render it correctly.

**Is game streaming supported?**
Streaming from this Steam installation to other devices is limited. Streaming to this
installation is not recommended, because it adds a second translation layer.

**Do achievements work?**
Yes.

**Is the Steam Controller supported?**
Partially. Basic controller input works; advanced Steam Input features may not.

**Does anti-cheat work?**
This depends on the game. VAC is reported to work generally, while EAC and BattlEye are
frequently blocked. Consult ProtonDB for a specific title.

## Recommended settings summary

```
Bottle
  Name: Steam
  Windows version: Windows 10

Launcher compatibility
  Mode: enabled
  Detection: automatic
  Locale: English (en_US.UTF-8)
  GPU spoofing: enabled (NVIDIA)
  Network timeout: 90 seconds

Graphics
  Backend: Recommended
  DXVK HUD: off, or FPS while monitoring

Performance
  Shader cache: enabled

Wine
  Enhanced Sync: ESync
  AVX: enabled only when required

Metal
  Sequoia compatibility mode: on (macOS 15 or later)
  Metal HUD: off
  Validation: off
```

## Monitoring and maintenance

**Weekly:** Steam updates automatically. Check for Vodka updates and review new
configuration warnings.

**After a macOS update:** confirm that Steam launches, that `steamwebhelper.exe` starts,
that downloads complete, and regenerate diagnostics if problems appear.

**After a Wine update:** test compatibility, recreate the bottle if failures are severe,
and review the issue tracker for known problems with the runtime version.

**Healthy indicators:** Steam launches within 10 seconds, store pages load promptly,
downloads sustain their throughput, and games launch without delay.

**Warning signs:** launches taking longer than 30 seconds, frequent disconnects, downloads
that consistently stall, and high CPU usage while idle.

## Recovery

**Reset Steam within the bottle**

1. Select **Bottle → Open in Finder**.
2. Navigate to `drive_c/Program Files (x86)/Steam/`.
3. Delete `steam.exe` and `steamwebhelper.exe`.
4. Run `SteamSetup.exe` again.

**Create a fresh bottle**

1. Create a new bottle with compatibility mode enabled before installation.
2. Install Steam.
3. Sign in and verify the client before downloading games.

**Restore from backup**

If `Metadata.plist` was backed up, replace the current file with the backup, restart Vodka
and test Steam.

**Save file location**

```
~/Library/Application Support/<Bottle>/drive_c/users/<username>/My Documents/
```

Most games store saves in the Documents directory. Back it up before recreating a bottle.
