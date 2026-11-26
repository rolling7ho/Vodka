# Steam compatibility guide

This guide describes the recommended configuration, graphics routing, and known troubleshooting steps for running Steam and Windows Steam games in Gmac. Gmac presents each isolated Wine prefix as a **PC** in the user interface and calls it a **bottle** in `GmacKit` and internal paths.

## Recommended setup

### Option A: Guided Steam setup (recommended)

1. Open Gmac and complete first-run Wine runtime setup.
2. In the Library view, follow the four-step **Steam Setup Guide**:
   - **Step 1 (Create your Steam space):** select **Create** to create a dedicated Windows 10 PC named `Steam`.
   - **Step 2 (Choose your graphics):** select **Automatic (Recommended)** (or choose a specific DirectX option). If you intend to run DirectX 12 titles, follow the **Get It from Apple** card to download Apple's Game Porting Toolkit `.dmg` and click **Install** when Gmac detects it in `~/Downloads` (or use **Choose File…**).
   - **Step 3 (Install Steam):** select **Install Steam**. Gmac downloads `SteamSetup.exe` from Valve and runs a silent installation into the PC.
   - **Step 4 (Sign in and install a game):** select **Open Steam**. On first launch, Steam updates itself for 2 to 5 minutes, during which the window may appear blank or display "Updating Steam". Once sign-in appears, log in and install games into the library.

### Option B: Manual PC setup

1. Create a new PC named `Steam` with Windows version **Windows 10**.
2. Open the PC, select **Settings**, click **Show** next to **Advanced**, and expand **Launcher Compatibility**.
3. Enable **Launcher Compatibility Mode** and keep **Detection Mode** set to **Automatic**.
4. Select **Run…** at the bottom of the PC view and run Valve's `SteamSetup.exe` (accept the default path `C:\Program Files (x86)\Steam\`).

### Graphics routing and per-game settings

Keep **PC › Settings › Graphics** set to **Automatic (Recommended)**:

- **Steam client processes:** Gmac automatically configures DXVK per executable (`AppDefaults`) for `steam.exe`, `steamwebhelper.exe`, `steamservice.exe`, `gameoverlayui64.exe`, and `GameOverlayUI.exe`. Steam's Chromium interface renders on DXVK even when the PC runs DirectX 12 games on D3DMetal.
- **Games:** launching a game from the Gmac Library, via `GmacCmd launch`, or via a `gmac://launch?steam=<appid>` URL applies per-game settings, bundled **Game Presets** (`GameDB.json`), and import-based backend detection.
- **Without Apple Game Porting Toolkit deployed:** when a PC is on **Automatic (Recommended)** and Apple D3DMetal is not deployed, Steam's profile temporarily sets the PC to DXVK so DirectX 11 titles and the client share compatible DLLs. Importing Game Porting Toolkit later automatically restores the PC to **Automatic (Recommended)** (`LauncherBackendMigration`).
- **Rockstar games on Steam:** launching Rockstar titles through Steam automatically writes per-executable overrides for `Launcher.exe` (WineD3D OpenGL without NVAPI, `d3d12` disabled) and `SocialClubHelper.exe` (DXVK) so the Rockstar Games Launcher initializes and exits cleanly.

### Optional Steam settings

- **Network timeout:** under **PC › Settings › Advanced (Show) › Launcher Compatibility**, confirm **Network Timeout** is at least **90s** (applied automatically when Steam is detected).
- **GPU spoofing:** in the same section, keep **GPU Spoofing** enabled (**NVIDIA** selected by default).
- **Auto-start Steam:** enable **Gmac Settings › Gaming › Open Steam when Gmac opens** to start Steam automatically when Gmac launches.
- **Faster mode:** in the Library view, toggle **Faster** on an individual Steam game to render at half resolution and upscale with MetalFX.
- **Add to Dock:** right-click a game card and choose **Add to Dock** to create a standalone `.app` shortcut in `~/Applications`.

### Verify configuration

1. Open **PC › Settings › Advanced (Show) › Launcher Compatibility**.
2. Confirm **Detected:** shows `Steam`.
3. Expand **Active Environment Overrides** to inspect the exact Steam and macOS platform overrides applied at launch:

   ```text
   LC_ALL=en_US.UTF-8
   LANG=en_US.UTF-8
   LC_TIME=C
   LC_NUMERIC=C
   STEAM_DISABLE_CEF_SANDBOX=1
   CEF_DISABLE_SANDBOX=1
   STEAM_RUNTIME=0
   DXVK_ASYNC=1
   MTL_DEBUG_LAYER=0          (macOS 15.3 and later)
   WINEFSYNC=0                (macOS 15.4 and later)
   ```

   With **Network Timeout** at 90s and **GPU Spoofing** enabled, Gmac also sets `WINHTTP_CONNECT_TIMEOUT=90000`, `WINHTTP_RECEIVE_TIMEOUT=180000`, `MESA_GL_VERSION_OVERRIDE=4.6`, and `MESA_GLSL_VERSION_OVERRIDE=460`.
4. Check the **Configuration Warnings** subsection; no warnings appear when the configuration is valid.

## Common issues

### "steamwebhelper is not responding"

**Symptoms**
- The Steam window reports that `steamwebhelper.exe` is not responding immediately after launch, and restart options do not resolve it.

**Cause**
- Steam's Chromium Embedded Framework (CEF) fails to initialize ICU date/time parsing when the Wine locale lacks UTF-8 encoding.

**Solution**
1. Open **PC › Settings › Advanced (Show) › Launcher Compatibility** and confirm **Launcher Compatibility Mode** is enabled.
2. Confirm **Detected:** is `Steam` (or set **Detection Mode** to **Manual** and select **Steam**) and confirm **Locale Override** is **Automatic** or **English (en_US.UTF-8)**.
3. Expand **Active Environment Overrides** and verify `LC_ALL=en_US.UTF-8` and `STEAM_DISABLE_CEF_SANDBOX=1` are listed. `en_US` without `.UTF-8` is insufficient.
4. If Steam still fails, delete the Steam folder inside `drive_c/Program Files (x86)/Steam/`, verify compatibility mode is enabled, and reinstall Steam.

### Steam downloads stall at 99 percent

**Symptoms**
- Download progress reaches 99 percent, repeats "Download starting…", and fails to finish until Steam restarts.

**Cause**
- Wine's HTTP stack can stall on persistent connections before a download completes.

**Solution**
1. Open **PC › Settings › Advanced (Show) › Launcher Compatibility** and raise **Network Timeout** to **90s** or higher (`WINHTTP_CONNECT_TIMEOUT` and `WINHTTP_RECEIVE_TIMEOUT` at twice that value). Gmac does not set `WINE_FORCE_HTTP11` or `WINE_MAX_CONNECTIONS_PER_SERVER`, as no shipped runtime reads them.
2. Quit Steam cleanly (from the Steam panel `…` menu › **Quit Steam** or right-click PC › **Quit Everything Running**) and relaunch it.
3. If stalls continue, open Steam **Settings › Downloads**, choose a geographically close download region, clear the download cache, and resume.

### Steam disconnects repeatedly

**Symptoms**
- "No connection" errors occur repeatedly and the friends list drops offline.

**Solution**
1. Raise **Network Timeout** to **120s** or higher under **Launcher Compatibility**. Gmac does not set `WINE_ENABLE_SSL` or `WINE_SSL_VERSION_MIN`.
2. Verify **System Settings › Network** and temporarily disable any VPN to test whether the connection stabilizes.

### Steam interface is blurry or stutters

**Symptoms**
- Steam text appears blurry or pixelated, or scrolling and animations stutter.

**Solution**
1. Under **PC › Settings › Game Settings**, ensure **Sharp, full-resolution games** is enabled (this also keeps Steam sharp on Retina displays). If you turn it off to adjust scaling manually, configure **Retina Mode** and **DPI Scaling** (96 DPI standard or 192 DPI Retina) under **PC › Settings › Advanced (Show) › Wine**.
2. Verify Steam is not running on WineD3D: keep **Graphics** on **Automatic (Recommended)** (which routes Steam processes to DXVK) or **DirectX 11 (Compatibility)**, and confirm **DXVK Async** is enabled if using bottle-wide DXVK under **PC › Settings › Advanced (Show) › Graphics Tuning › DXVK Configuration**.

### Steam starts without a visible window

**Symptoms**
- Steam processes appear active, or notification sounds play, but no window is visible.

**Solution**
1. Right-click the PC in the sidebar and choose **Quit Everything Running** (or press `⇧⌘K` for **File › Quit Everything Running**).
2. Confirm **Launcher Compatibility Mode** is enabled with **Steam** detected.
3. Under **PC › Settings › Advanced (Show) › Graphics Tuning › Metal**, confirm **Metal Validation** is off.
4. Open Wine logs via **File › Open Logs Folder** (`⌘L`, stored in `~/Library/Logs/com.rolling7ho.Gmac/`) and inspect the newest log for CEF or graphics errors.

## macOS 15.3 and 15.4+ behaviour

Apple changed Mach port and threading behaviour in macOS 15.4 and Metal debug layer behaviour in macOS 15.3. Gmac applies the required fixes automatically at the platform layer (`MacOSCompatibilityFixes`):

- `MTL_DEBUG_LAYER=0` on macOS 15.3 and later
- `WINEFSYNC=0` and `STEAM_RUNTIME=0` on macOS 15.4 and later
- `WINEESYNC=1` on macOS 15.4 and later when **Enhanced Sync** is set to **None**

There is no manual Sequoia compatibility toggle in the interface. You can inspect these active platform overrides under **PC › Settings › Advanced (Show) › Launcher Compatibility › Active Environment Overrides**.

## Advanced configuration and tuning

### Launch options

Set per-game Steam launch options in Steam **Properties**, or configure arguments and environment overrides per executable in Gmac under **PC › Advanced (Show) › Installed Apps**. Common Steam launch flags:

```text
-windowed    force windowed mode
-dx11        force Direct3D 11
-nojoy       disable joystick support
-novid       skip introductory videos
```

### Big Picture, Workshop, and Cloud

- **Big Picture mode:** connect any controller before launching, and exit through the Steam power menu rather than force-quitting Wine.
- **Steam Workshop:** generally works with Launcher Compatibility Mode enabled; raise **Network Timeout** to 150s or 180s for large items.
- **Steam Cloud:** generally works when enabled under the game's **Properties › Updates** in Steam.

### Performance and stability defaults

- **Graphics:** **Automatic (Recommended)**
- **Shader Cache:** enabled under **PC › Settings › Advanced (Show) › Performance**
- **Enhanced Sync:** **ESync** (or **MSync** if supported by a title) under **PC › Settings › Advanced (Show) › Wine**
- **Windows Version:** **Windows 10**
- **Advertise AVX Support:** off unless a specific game requires AVX instructions via Rosetta 2
- **Metal 4 Backend:** experimental under **PC › Settings › Advanced (Show) › Graphics Tuning**; disable if a game freezes on loading screens
- **DLSS Frame Generation:** keep disabled unless testing a specific title, as enabling it has caused WindowServer hangs on tested systems

## Known limitations

- **Supported:** Steam Store, Library, Friends, downloads, Direct3D 9/10/11/12 games (with D3DMetal deployed for D3D12), Workshop, Cloud saves, and achievements.
- **Limited:** advanced Steam Input features and the in-game Steam overlay (game dependent).
- **Unsupported:** VR titles, Remote Play, Steam broadcasting, and multiplayer games using kernel-level anti-cheat (such as BattlEye, Easy Anti-Cheat kernel mode, or Vanguard).

## Recovery and save locations

- **Find PC files on disk:** right-click the PC in Gmac's sidebar and select **Show in Finder**, or click **Open C: Drive** under **PC › Advanced (Show)**. Default PCs reside in `~/Library/Containers/com.rolling7ho.Gmac/Bottles/<UUID>/`.
- **Save files:** most Windows games write saves under `drive_c/users/<username>/Documents/` or `drive_c/users/<username>/AppData/`. Back up save directories before deleting or recreating a PC.
- **Reset Steam in place:** close all running processes, open `drive_c/Program Files (x86)/Steam/`, remove `steam.exe` and `steamwebhelper.exe` (preserving `steamapps/`), and run `SteamSetup.exe` again.

## Reporting Steam issues

Before opening an issue at <https://github.com/rolling7ho/gmac/issues>:

1. Verify **Launcher Compatibility Mode** is enabled, **Steam** is detected, and **Configuration Warnings** is clear.
2. Run **Help › Troubleshoot…** (`⇧⌘T`) or **Help › Run Diagnostics…** (`⇧⌘D`) and export the report (**Export Diagnostic Report…** under **PC › Settings › Advanced (Show) › Diagnostic Reports**).
3. For crashes or hangs, also collect **Generate Stability Diagnostics** from the same **Diagnostic Reports** section.
4. Include your Mac model, macOS version, Gmac version, GmacWine version, reproduction steps, and the exported diagnostics.

## Related documentation

- [Launcher troubleshooting guide](LauncherTroubleshooting.md)
- [Stability troubleshooting guide](StabilityTroubleshooting.md)
