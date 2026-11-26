# Launcher troubleshooting guide

This guide covers diagnosing and resolving compatibility issues with Windows game launchers in Gmac, including Steam, Rockstar Games Launcher, EA App, Epic Games Store, Ubisoft Connect, Battle.net, and Paradox Launcher. Gmac presents each Wine prefix as a **PC** in the user interface and calls it a **bottle** in `GmacKit` and internal paths.

## Initial procedure

For any launcher problem:

1. Open the PC in Gmac and select **Settings**.
2. Click **Show** next to **Advanced** and expand **Launcher Compatibility**.
3. Enable **Launcher Compatibility Mode**.
4. Set **Detection Mode** to **Automatic** (or select **Manual** and pick the launcher if detection does not match).
5. Launch the launcher and inspect **Active Environment Overrides** and **Configuration Warnings** in the same section.

## Common issues

### "steamwebhelper is not responding"

**Symptoms**
- Steam opens and immediately displays an error that `steamwebhelper.exe` is not responding.

**Cause**
- Steam's Chromium Embedded Framework (CEF) fails ICU date and time parsing when the Wine locale does not specify UTF-8 encoding.

**Solution**
1. Open **PC › Settings › Advanced (Show) › Launcher Compatibility** and enable **Launcher Compatibility Mode**.
2. Set **Locale Override** to **Automatic** or **English (en_US.UTF-8)**.
3. Expand **Active Environment Overrides** and confirm `LC_ALL=en_US.UTF-8` and `STEAM_DISABLE_CEF_SANDBOX=1` are active.

### Steam downloads stall at 99 percent

**Symptoms**
- Downloads stop at 99 percent and fail to finish without restarting Steam.

**Cause**
- Wine's HTTP implementation can drop or stall persistent connections before a transfer finishes.

**Solution**
1. Open **PC › Settings › Advanced (Show) › Launcher Compatibility** and set **Network Timeout** to **90s** or higher. Gmac sets `WINHTTP_CONNECT_TIMEOUT` to that millisecond value and `WINHTTP_RECEIVE_TIMEOUT` to twice that value. Gmac does not set `WINE_FORCE_HTTP11` or `WINE_MAX_CONNECTIONS_PER_SERVER`.
2. In Steam, open **Settings › Downloads**, select a geographically close download region, clear the download cache, and resume.

### Rockstar Games Launcher freezes or fails to initialize

**Symptoms**
- The standalone launcher freezes at the Rockstar logo, or Steam-launched Rockstar titles stop with "The Rockstar Games Launcher failed to initialize".

**Cause**
- The standalone launcher renders its splash screen and interface using Direct3D/Direct2D and Chromium components that fail without the appropriate per-executable rendering overrides.

**Solution**
- **Standalone launcher:**
  1. Open **PC › Settings › Advanced (Show) › Launcher Compatibility**, enable **Launcher Compatibility Mode**, and verify **Use DXVK for Rockstar Games Launcher** is enabled (`LauncherFixes` switches the PC to DXVK when Rockstar is detected and `autoEnableDXVK` is on).
  2. If the launcher executable still hangs, run `LauncherPatcher.exe` instead of `Launcher.exe` via **Run…**.
- **Rockstar games launched through Steam:**
  1. Keep **PC › Settings › Graphics** on **Automatic (Recommended)**.
  2. Launch the game from Gmac's Library or Steam. Gmac automatically writes `AppDefaults` overrides for `Launcher.exe` (OpenGL WineD3D with NVAPI and `d3d12` disabled) and `SocialClubHelper.exe` (DXVK).

### EA App displays a black screen or "GPU not supported"

**Symptoms**
- The EA App window renders black with audible background audio or shows a "GPU not supported" error.

**Cause**
- The EA App queries OpenGL and Direct3D driver capabilities and rejects Wine's default reporting when capability overrides are missing.

**Solution**
1. Open **PC › Settings › Advanced (Show) › Launcher Compatibility** and enable **Launcher Compatibility Mode**.
2. Enable **GPU Spoofing** with vendor **NVIDIA**.
3. Confirm **Locale Override** is **English (en_US.UTF-8)** (applied automatically by the EA App preset).
4. Expand **Active Environment Overrides** to confirm `LC_ALL=en_US.UTF-8` and `CEF_DISABLE_SANDBOX=1` are active; `GPUDetection` also sets `MESA_GL_VERSION_OVERRIDE=4.6` and `MESA_GLSL_VERSION_OVERRIDE=460`.

### Epic Games Store does not render its interface

**Symptoms**
- The Epic Games Store window is blank or grey and sign-in cannot proceed.

**Cause**
- Epic's Chromium Embedded Framework conflicts with Wine when the CEF sandbox is enabled or the locale is non-UTF-8.

**Solution**
1. Open **PC › Settings › Advanced (Show) › Launcher Compatibility** and enable **Launcher Compatibility Mode**.
2. Confirm `CEF_DISABLE_SANDBOX=1` under **Active Environment Overrides** and keep **Locale Override** on **Automatic** or **English (en_US.UTF-8)**.

### Ubisoft Connect cannot update or launch games

**Symptoms**
- Ubisoft Connect starts, but updates stall or games fail to initialize.

**Solution**
1. Open **PC › Settings › Advanced (Show) › Launcher Compatibility** and enable **Launcher Compatibility Mode**.
2. Set **Network Timeout** to **90s** or higher.
3. Confirm **PC › Settings › Graphics** is set to **DirectX 11 (Compatibility)** (DXVK) with **DXVK Async** enabled under **PC › Settings › Advanced (Show) › Graphics Tuning › DXVK Configuration** (enabled automatically when Ubisoft Connect is detected).

### Battle.net authentication fails

**Symptoms**
- Battle.net opens, but the embedded browser sign-in flow fails to load or redirect.

**Solution**
1. Enable **Launcher Compatibility Mode** with **Battle.net** detected (or manually selected).
2. Confirm `LC_ALL=en_US.UTF-8` and `CEF_DISABLE_SANDBOX=1` are active and that DXVK is active (**DirectX 11 (Compatibility)** under **Graphics**).

### Paradox Launcher reports "recursive resource lookup"

**Symptoms**
- Paradox Launcher installation or initialization reports a resource lookup error.

**Solution**
- Enable **Launcher Compatibility Mode** with Paradox Launcher detected or selected. Gmac applies the platform `CEF_DISABLE_SANDBOX=1` and macOS 15.4+ synchronization overrides automatically. Earlier versions of this guide referenced `WINE_DISABLE_FAST_PATH`, which no shipped runtime reads and which Gmac removed.

## macOS 15.3 and 15.4+ platform fixes

On macOS 15.3 and later, Gmac applies required platform overrides automatically in `MacOSCompatibilityFixes` without requiring a manual compatibility toggle:

| Variable | Condition | Reason |
|---|---|---|
| `STEAM_DISABLE_CEF_SANDBOX=1` | All macOS versions | Disables Steam CEF sandbox incompatible with Wine |
| `CEF_DISABLE_SANDBOX=1` | All macOS versions | Disables CEF sandbox for Chromium-based launchers |
| `MTL_DEBUG_LAYER=0` | macOS 15.3 and later | Prevents Metal validation layer rendering issues |
| `WINEFSYNC=0` | macOS 15.4 and later | Disables fsync due to macOS 15.4 threading/Mach port changes |
| `STEAM_RUNTIME=0` | macOS 15.4 and later | Disables Steam Runtime under Wine |
| `WINEESYNC=1` | macOS 15.4 and later when Enhanced Sync is None | Keeps ESync active for process stability |

View the active platform fixes in **PC › Settings › Advanced (Show) › Launcher Compatibility › Active Environment Overrides**.

## Inspecting configuration and diagnostics

### Active Environment Overrides and Configuration Warnings

Under **PC › Settings › Advanced (Show) › Launcher Compatibility**:

- Expand **Active Environment Overrides** to see each launcher-specific and macOS platform environment variable along with its reason.
- Review **Configuration Warnings**, which surface conditions detected by `LauncherDetection`:

| Warning | Meaning | Action |
|---|---|---|
| Steam locale warning | Steam is selected and Locale Override is set to a non-English, non-Automatic locale | Set **Locale Override** to **Automatic** or **English (en_US.UTF-8)** |
| Steam GPU spoofing warning | GPU Spoofing is disabled for Steam | Enable **GPU Spoofing** |
| Rockstar DXVK required | Rockstar Games Launcher is selected and bottle DXVK is off | Select **DirectX 11 (Compatibility)** or enable **Use DXVK for Rockstar Games Launcher** |
| EA App GPU spoofing required | EA App is selected and GPU Spoofing is off | Enable **GPU Spoofing** |
| EA App / Epic / Battle.net locale recommended | Locale Override is not English (`en_US.UTF-8`) | Set **Locale Override** to **English (en_US.UTF-8)** |
| Launcher Compatibility Mode disabled | Compatibility mode is off | Enable **Launcher Compatibility Mode** |

### Diagnostic tools

- **View Latest Diagnosis / Export Diagnostic Report…:** available under **PC › Settings › Advanced (Show) › Diagnostic Reports** (and via the **View Diagnostics** button in **Launcher Compatibility**). Exports a Markdown summary or ZIP bundle with privacy toggles for scrubbing sensitive arguments and logs.
- **Generate Stability Diagnostics:** available under **PC › Settings › Advanced (Show) › Diagnostic Reports**. Produces a bounded report containing system versions, PC settings, environment keys only (without values), and the tail of the newest Wine log.
- **Help › Run Diagnostics… (`⇧⌘D`)** and **Help › Troubleshoot… (`⇧⌘T`):** analyze a program's last run log or launch the guided troubleshooting wizard.

## Advanced troubleshooting

### Consult Wine logs

1. Select **File › Open Logs Folder** (`⌘L`) or click **Show in Finder** next to **Logs** in **Gmac Settings › Storage**.
2. Open `~/Library/Logs/com.rolling7ho.Gmac/` and inspect the newest `.log` file by timestamp.
3. Search for `steamwebhelper`, `CEF`, `locale`, `err:`, or `segfault`.

### Verify the Wine installation

Confirm that `~/Library/Application Support/com.rolling7ho.Gmac/Libraries/Wine/` contains `bin/`, `lib/`, and `share/`, and that `~/Library/Application Support/com.rolling7ho.Gmac/Libraries/WhiskyWineVersion.plist` exists. If the runtime is damaged, open **Gmac › Setup…** to reinstall it.

### Reset launcher configuration

`Metadata.plist` stores all settings for a PC (name, pinned programs, graphics settings, and launcher compatibility settings) inside the PC directory (`~/Library/Containers/com.rolling7ho.Gmac/Bottles/<UUID>/Metadata.plist` by default).

1. Quit everything running in the PC (**Quit Everything Running**).
2. Right-click the PC in the sidebar and select **Show in Finder**.
3. Back up `Metadata.plist`, then delete `Metadata.plist` if the configuration is corrupted.
4. Restart Gmac. Gmac regenerates default `Metadata.plist` settings without deleting `drive_c` or installed games; re-enable **Launcher Compatibility Mode** afterwards.

### Test in a clean PC

1. Create a new PC named `Launcher Test` with **Windows 10**.
2. Enable **Launcher Compatibility Mode** before installing the launcher.
3. Install the launcher from its official installer and test sign-in and rendering. If the launcher works in the clean PC, the issue is isolated to the original PC's configuration or prefix state.

## Launcher reference

| Launcher | Applied profile (`LauncherFixes`) | Managed environment (`fixDetails`) | Helper executables (`AppDefaults`) |
|---|---|---|---|
| **Steam** | `en_US.UTF-8` locale, GPU spoofing on, 90s network timeout; DXVK per-executable (restores Automatic when GPTK is present) | `LC_ALL=en_US.UTF-8`, `LANG=en_US.UTF-8`, `LC_TIME=C`, `LC_NUMERIC=C`, `STEAM_DISABLE_CEF_SANDBOX=1`, `STEAM_RUNTIME=0`, `DXVK_ASYNC=1` | `steamwebhelper.exe`, `steamservice.exe`, `gameoverlayui64.exe`, `GameOverlayUI.exe` |
| **Rockstar Games Launcher** | Enables DXVK if `autoEnableDXVK` is on, `en_US.UTF-8` locale | `WINE_LARGE_ADDRESS_AWARE=1`, `LC_ALL=en_US.UTF-8` | Chain executables: `Launcher.exe` (OpenGL WineD3D, no NVAPI, no `d3d12`), `SocialClubHelper.exe` (DXVK) |
| **EA App** | GPU spoofing on (NVIDIA), `en_US.UTF-8` locale | `LC_ALL=en_US.UTF-8`, `LANG=en_US.UTF-8` | `EABackgroundService.exe` |
| **Epic Games Store** | `en_US.UTF-8` locale, GPU spoofing on | `LC_ALL=en_US.UTF-8` | `EpicWebHelper.exe` |
| **Ubisoft Connect** | Enables DXVK and DXVK Async, 90s network timeout | `DXVK_ASYNC=1` | None |
| **Battle.net** | `en_US.UTF-8` locale, GPU spoofing on, enables DXVK | `LC_ALL=en_US.UTF-8` | `Battle.net Helper.exe` |
| **Paradox Launcher** | Enables Launcher Compatibility Mode | None (relies on platform fixes) | None |

Note on **GPU Spoofing**: enabling GPU spoofing emits `MESA_GL_VERSION_OVERRIDE=4.6` and `MESA_GLSL_VERSION_OVERRIDE=460` regardless of the selected vendor, because no shipped runtime reads the legacy vendor-ID environment variables. `D3DM_SUPPORT_DXR` is controlled independently by **DirectX Raytracing** under **Graphics Tuning › Metal**.

## Security considerations

Launcher Compatibility Mode disables the Chromium sandbox (`CEF_DISABLE_SANDBOX=1` and `STEAM_DISABLE_CEF_SANDBOX=1`), which is required for Chromium-based launchers to run under Wine. Embedded browser content runs with the privileges of the Wine process. Use Launcher Compatibility Mode only with established, trusted launchers and avoid browsing untrusted websites inside launcher web views.

## FAQ

**Can Launcher Compatibility Mode be used with standalone games?**
It is intended for game launchers. Standalone games receive their own per-game environment and preset overrides without needing launcher mode.

**Why does automatic launcher detection miss an executable?**
Detection inspects the executable filename and path (`LauncherType.detect(from:)`). If a launcher uses a non-standard path or executable name, switch **Detection Mode** to **Manual** and select the launcher explicitly.

**Does GPU spoofing interfere with anti-cheat?**
GPU spoofing only overrides OpenGL capability strings (`MESA_GL_VERSION_OVERRIDE`, `MESA_GLSL_VERSION_OVERRIDE`) and does not modify game memory. Anti-cheat compatibility still depends on the anti-cheat system itself; kernel-level anti-cheat drivers remain unsupported under Wine.

**Can settings be customized per game instead of for the entire PC?**
Yes. Open **PC › Advanced (Show) › Installed Apps** and select an executable to configure per-program arguments, environment overrides, locale, and graphics backend overrides. Popular titles also receive automatic presets from **PC › Advanced (Show) › Game Presets** (`GameDB.json`).

## Related documentation

- [Steam compatibility guide](SteamCompatibility.md)
- [Stability troubleshooting guide](StabilityTroubleshooting.md)
