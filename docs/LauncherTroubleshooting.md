# Launcher troubleshooting guide

**Feature:** Launcher compatibility system (frankea/Whisky#41)
**Last updated:** 12 January 2026

> **Note:** This document references issue numbers from this fork (frankea/Whisky) and from
> the original upstream project (whisky-app/whisky). Upstream references are retained for
> historical context. Report new issues to
> [rolling7ho/vodka](https://github.com/rolling7ho/vodka/issues).

## Initial procedure

For any launcher problem:

1. Open the bottle and select the **Config** tab.
2. Expand **Launcher Compatibility**.
3. Enable **Launcher Compatibility Mode**.
4. Set **Detection Mode** to **Automatic**.
5. Launch the launcher and review any warnings displayed in the interface.

If the problem persists, consult the section for that launcher below.

## Common issues

### "steamwebhelper is not responding"

**Symptoms**

- The Steam window appears and immediately reports an error.
- The interface is unusable, and the restart options do not help.

**Solution**

1. Open **Config → Launcher Compatibility** and enable compatibility mode.
2. Confirm that **Locale Override** is **English (en_US.UTF-8)**. This resolves ICU parsing
   failures in `steamwebhelper.exe`.
3. Select **Generate Diagnostics Report** and confirm `LC_ALL=en_US.UTF-8` and
   `STEAM_DISABLE_CEF_SANDBOX=1`.

**Cause**

Steam's Chromium-based helper fails when parsing dates and times in certain locales. The
`.UTF-8` suffix is required for correct Unicode handling.

**Related issues:** whisky-app/whisky#946, #1224, #1241.

### Steam downloads stall at 99 percent

**Symptoms**

- Downloads reach 99 percent and never complete.
- A restart of Steam is required to continue, and several games are affected.

**Solution**

1. Open **Config → Launcher Compatibility**, enable compatibility mode and set **Network
   Timeout** to **90 seconds** or higher.
2. Generate a diagnostics report and confirm `WINHTTP_CONNECT_TIMEOUT`. The receive timeout
   is set to twice that value. Vodka does not set `WINE_FORCE_HTTP11`.
3. In Steam, open **Settings → Downloads**, select a geographically close region, then pause
   and resume the download.

**Cause**

Wine's HTTP behaviour is unstable under some persistent connection conditions. Higher
timeouts resolve the connection failures.

**Related issues:** whisky-app/whisky#1148, #1072, #1176.

### Rockstar Games Launcher freezes on the logo

**Symptoms**

- The launcher starts and freezes at the Rockstar logo without an error message.
- CPU usage may increase while the splash screen remains visible.

**Solution**

1. Enable DXVK under **Config → DXVK**. It is required for the logo to render.
2. Open **Config → Launcher Compatibility**, enable compatibility mode and set detection to
   Automatic or select **Rockstar Games Launcher** explicitly.
3. Generate a diagnostics report and confirm that DXVK is enabled and that
   `WINEDLLOVERRIDES` contains the Direct3D libraries.

**Alternative:** use `LauncherPatcher.exe` instead of `Launcher.exe`.

**Cause**

The logo screen renders with Direct3D. Without DXVK the rendering fails without an error and
the launcher blocks.

**Related issues:** whisky-app/whisky#835, #1335, #1120.

### EA App displays a black screen

**Symptoms**

- The window is entirely black, although background sound is audible.
- The cursor changes over invisible controls, and a "GPU not supported" error may appear.

**Solution**

1. Open **Config → Launcher Compatibility**, enable compatibility mode and enable **GPU
   Spoofing** with the **NVIDIA** vendor.
2. Generate a diagnostics report and confirm GPU spoofing is active. The spoof sets
   `MESA_GL_VERSION_OVERRIDE=4.6`.
3. Set **Locale Override** to **English**.

**Cause**

The EA App queries GPU capabilities through Direct3D. Wine's incomplete driver reporting
causes the launcher to conclude that the GPU is unsupported.

**Related issues:** whisky-app/whisky#1195, #1322.

### Epic Games Store does not render its interface

**Symptoms**

- The window appears blank or grey and the web view does not load.
- Sign-in is impossible and connection errors may be reported.

**Solution**

1. Open **Config → Launcher Compatibility**, enable compatibility mode and set **Locale
   Override** to **English**.
2. Generate a diagnostics report and confirm `CEF_DISABLE_SANDBOX=1`.

**Cause**

Epic's Chromium Embedded Framework conflicts with Wine's threading model. Disabling the CEF
sandbox resolves the conflict.

### Ubisoft Connect cannot update or launch games

**Symptoms**

- Ubisoft Connect starts, but games do not launch.
- Update progress does not advance and "Failed to initialize" errors appear.

**Solution**

1. Under **Config → DXVK**, enable DXVK and **DXVK Async**.
2. Under **Config → Launcher Compatibility**, set the network timeout to **90 seconds**.

**Related issues:** whisky-app/whisky#1004, #879.

### Battle.net authentication fails

**Symptoms**

- The launcher opens, but the sign-in page does not load and redirects fail.

**Solution**

Enable compatibility mode with the English locale. Battle.net's web-based authentication
requires working Chromium rendering.

### Paradox Launcher reports "recursive resource lookup"

**Symptoms**

- Installation fails with a resource lookup error and initialisation does not complete.

**Solution**

Enable compatibility mode and allow automatic or manual detection of the Paradox Launcher.

Vodka applies no Paradox-specific environment fix. The `WINE_DISABLE_FAST_PATH` workaround
that earlier versions set is read by no shipped runtime and has been removed.

**Related issues:** whisky-app/whisky#1091.

## macOS 15.4 and later

**Symptoms**

- Launchers that worked on macOS 15.3 crash on 15.4 or later.
- Wine preloader threads remain blocked and Mach port timeouts occur.

**Solution**

1. Enable **Config → Metal → Sequoia Compatibility Mode**.
2. Generate a diagnostics report and confirm the macOS version and `WINEFSYNC=0`.

**Cause**

Apple changed threading and Mach port behaviour in macOS 15.4. The compatibility mode applies
the required Wine environment changes.

**Related issues:** whisky-app/whisky#1372, #1310, #1307.

## Diagnostics report

### Generating a report

1. Open **Bottle → Config → Launcher Compatibility**.
2. Select **Generate Diagnostics Report** and review the configuration in the window.
3. Copy the report to the clipboard for a GitHub issue, or export it to a file.

### Reading a report

**System information**

```
macOS version: 15.4.1
Wine version: 11.0
Architecture: Apple Silicon (arm64)
Rosetta 2: installed
```

**Launcher configuration**

```
Compatibility mode: enabled
Detected launcher: Steam
Launcher locale: English (en_US.UTF-8)
GPU spoofing: enabled (NVIDIA)
```

**Environment variables**

- `LC_ALL=en_US.UTF-8` (locale fix)
- `STEAM_DISABLE_CEF_SANDBOX=1` (Steam CEF fix)
- `CEF_DISABLE_SANDBOX=1` (global CEF fix)
- `MESA_GL_VERSION_OVERRIDE=4.6` (GPU spoofing)
- `WINHTTP_CONNECT_TIMEOUT=90000` (network timeout)

**Validation results**

The report states either that the configuration is optimal or that warnings require
attention.

## Configuration warnings

| Warning | Impact | Action |
|---|---|---|
| DXVK should be enabled for Steam | Steam interface may stutter | Enable DXVK under **Config → DXVK** |
| DXVK required for the Rockstar Launcher | Logo does not render; launcher unusable | Enable DXVK |
| Steam may fail without the en_US locale | `steamwebhelper.exe` failure likely | Set Locale Override to English |
| GPU spoofing required for the EA App | Black screen or "GPU not supported" | Enable GPU spoofing |

## Advanced troubleshooting

### Reset launcher configuration

1. Disable Launcher Compatibility Mode.
2. Right-click the bottle, select **Show in Finder** and delete `Metadata.plist`.
3. Recreate the bottle; Vodka regenerates it with defaults.
4. Enable Launcher Compatibility Mode again.

### Consult Wine logs

1. Open `~/Library/Logs/com.rolling7ho.Vodka/`.
2. Locate the newest log by timestamp and inspect entries around launcher startup.
3. Search for `steamwebhelper`, `CEF`, `locale`, `crash` and `segfault`.

### Verify the Wine installation

Confirm that `~/Library/Application Support/com.rolling7ho.Vodka/Libraries/Wine/` contains
the `bin/`, `lib/` and `share/` directories. The application reports the runtime version it
uses in the diagnostics report.

### Test in a clean bottle

1. Create a new bottle named "Launcher Test" with Windows 10.
2. Enable Launcher Compatibility Mode before installing anything.
3. Install the launcher from the official installer.
4. Test the launcher. If it works, the original bottle had a configuration fault; if it
   fails, the fault lies with Wine or macOS.

## Launcher reference

### Steam

- Required: Launcher Compatibility Mode; locale `en_US.UTF-8`.
- Recommended: DXVK; network timeout of 90 seconds.
- Variables: `LC_ALL=en_US.UTF-8`, `STEAM_DISABLE_CEF_SANDBOX=1`.

### Rockstar Games Launcher

- Required: DXVK; Launcher Compatibility Mode.
- Recommended: locale English.
- DXVK cannot be disabled for this launcher.

### EA App

- Required: GPU spoofing; Launcher Compatibility Mode.
- Recommended: NVIDIA vendor; locale English.

### Epic Games Store

- Required: Launcher Compatibility Mode; locale English.
- Recommended: GPU spoofing.
- Variables: `CEF_DISABLE_SANDBOX=1`.

### Ubisoft Connect

- Required: Launcher Compatibility Mode.
- Recommended: DXVK with DXVK Async; network timeout of 90 seconds.
- Variables: `DXVK_ASYNC=1`.

### Battle.net

- Required: Launcher Compatibility Mode; locale English.
- Recommended: DXVK.
- Variables: `CEF_DISABLE_SANDBOX=1`.

### Paradox Launcher

- Required: Launcher Compatibility Mode.
- No additional environment configuration.

## Reporting an issue

Before reporting:

1. Generate the diagnostics report under **Config → Launcher Compatibility** and export it.
2. Review all warnings and apply the recommended changes.
3. Confirm that the issue reproduces in a clean bottle.

Include in the report:

1. The diagnostics report, attached or pasted in full.
2. System information: macOS version, Mac model and Vodka version.
3. Reproduction steps, expected behaviour and actual behaviour.
4. Screenshots of error messages and configuration screens.

## Security considerations

Launcher compatibility mode disables the Chromium sandbox, which is required under Wine.

Implications:

- Embedded browser content runs with the process's privileges.
- A browser exploit could compromise the Wine process.

Use compatibility mode with established launchers (Steam, Epic, EA, Rockstar), keep those
launchers updated, and avoid browsing untrusted sites inside them. Do not use compatibility
mode with unknown launcher software.

## Operational guidance

**Performance**

- Enable DXVK Async to reduce shader compilation stutter.
- Enable the shader cache under **Config → Performance**.

**Stability**

- Use a dedicated bottle for each launcher to avoid conflicts.
- Reinstall launchers after significant Wine updates and keep them updated.
- Monitor Wine processes in Activity Monitor; sustained high CPU usage may indicate a
  hung launcher component.

**Before changing a working configuration**

- Export the diagnostics report.
- Copy `Metadata.plist`:

  ```sh
  cp ~/path/to/bottle/Metadata.plist ~/Desktop/bottle-backup.plist
  ```

- Record the working configuration, for example with screenshots of the Config tabs.

## FAQ

**Can launcher compatibility be used with games?**
Yes, but it is designed for launchers. Games generally do not require these fixes and may
receive launcher-specific optimisations that they do not need.

**Why does launcher detection fail?**
Detection uses heuristics based on filename and path. For unusual cases, switch to Manual
detection and select the launcher explicitly.

**Is GPU spoofing safe with anti-cheat?**
GPU spoofing changes capability queries only and does not modify game memory. Whether a
given anti-cheat system tolerates it depends on that system.

**Does launcher compatibility reduce game performance?**
No measurable effect is expected. The environment variable setup occurs at launch and is
negligible.

**Can individual launcher settings be customised?**
Settings apply to the detected launcher. Per-game overrides may be added in a future
version.

**Why does a launcher require the English locale?**
The Chromium Embedded Framework used by several launchers has Unicode parsing defects with
certain locales. `en_US.UTF-8` avoids them.

## macOS compatibility

| macOS version | Compatibility | Notes |
|---|---|---|
| 15.0 to 15.2 | Full | No known issues |
| 15.3 | Full | Graphics validation handled |
| 15.4 and later | Full | Synchronisation mode and Steam Runtime handled |

macOS 15 is the minimum supported version.

## Further resources

- Issue tracker: <https://github.com/rolling7ho/vodka/issues>
- Upstream project: <https://github.com/whisky-app/whisky>
- Steam guide: [SteamCompatibility.md](SteamCompatibility.md)
- Stability guide: [StabilityTroubleshooting.md](StabilityTroubleshooting.md)
