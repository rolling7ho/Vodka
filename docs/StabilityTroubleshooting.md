# Stability troubleshooting guide

This guide describes immediate mitigations, diagnostic collection, and triage steps for critical stability issues in Gmac, including crashes, UI freezes, system hangs, and macOS kernel panics. Gmac presents each Wine prefix as a **PC** in the user interface and calls it a **bottle** in `GmacKit` and internal paths.

## Applicability

Use this guide when investigating:

- a macOS kernel panic, WindowServer hang, or forced reboot during game launch or gameplay;
- a complete Gmac UI freeze during PC management, launch, or configuration;
- a crash on application startup or during Wine runtime installation (`GmacWineInstaller`);
- a recurring game crash at startup or loading screens.

## Immediate mitigations

Test these controls in order to isolate graphics, runtime, or prefix faults:

1. **Stop hung Wine processes:** select **File › Quit Everything Running** (`⇧⌘K`) or right-click the PC in the sidebar and select **Quit Everything Running**.
2. **Keep DLSS Frame Generation disabled:** open **PC › Settings › Advanced (Show) › Graphics Tuning** and confirm **DLSS Frame Generation** is off. Enabling it has caused command buffer failures and WindowServer `IOGPUFamily` hangs on tested systems.
3. **Disable Metal 4 Backend:** under **PC › Settings › Advanced (Show) › Graphics Tuning**, turn off **Metal 4 Backend** when a DirectX 12 game freezes on loading screens.
4. **Disable DirectX Raytracing:** under **PC › Settings › Advanced (Show) › Graphics Tuning › Metal** (shown on Apple9 and newer GPUs), turn off **DirectX Raytracing**.
5. **Switch graphics backend:** under **PC › Settings › Graphics**, test switching from **Automatic (Recommended)** or **DirectX 12** to **DirectX 11 (Compatibility)** (DXVK) or **DirectX 11** (DXMT) if the title supports Direct3D 11.
6. **Clear shader caches:** select **File › Clear Shader Caches** (or **Gmac Settings › Storage › Shader caches › Clear…**). Note that clearing caches stops running PCs first.
7. **Repair the PC prefix:** select **PC › Settings › Troubleshooting › Repair This PC** to rebuild missing prefix directories and validate prefix health.
8. **Run the guided troubleshooter:** select **PC › Settings › Troubleshooting › Fix a Game That Won’t Start** or **Help › Troubleshoot…** (`⇧⌘T`).

## Collecting diagnostics

Include complete, bounded diagnostics when filing a bug report at <https://github.com/rolling7ho/gmac/issues>.

### Stability diagnostics report

1. Open the affected PC and select **Settings**.
2. Click **Show** next to **Advanced** and scroll to **Diagnostic Reports**.
3. Select **Generate Stability Diagnostics**.
4. Copy the report to the clipboard or select **Export to File**.

The stability report (`StabilityDiagnostics`) is bounded and privacy-safe:

- environment entries list **keys only** without values so paths and tokens are omitted;
- the log summary lists the 5 newest log files and includes at most 64 KiB (200 lines) from the tail of the newest log.

### Crash and launch diagnostics

When a program exits abnormally or crashes, use:

- **Help › Run Diagnostics… (`⇧⌘D`)** to select the PC and program and inspect the classified diagnosis (`CrashClassifier`).
- **PC › Settings › Advanced (Show) › Diagnostic Reports › View Latest Diagnosis** or **Export Diagnostic Report…** to save a Markdown summary or ZIP archive (`DiagnosticExporter`). By default, sensitive details are excluded and common secret shapes are redacted.

### Wine logs

Select **File › Open Logs Folder** (`⌘L`) or **Gmac Settings › Storage › Logs › Show in Finder** to open `~/Library/Logs/com.rolling7ho.Gmac/`.

Gmac caps each log file at **20 MiB** and enforces a **200 MiB** total folder cap (`Wine.maxLogFileBytes` and `Wine.maxLogsFolderBytes`), plus age-based deletion configurable under **Gmac Settings › Storage › Keep Wine logs for** (`1 day`, `1 week`, `1 month`, or `Forever`).

### macOS crash and panic reports

For application crashes, WindowServer hangs, or kernel panics:

1. Open **Console.app**.
2. Check **Crash Reports** for `Gmac`, `wine64`, or `WindowServer` reports, and check **System Reports** / **Panic reports** for kernel panic logs.
3. Include the exact panic string if visible (for example `IOMFB int_handler_gated: failure: axi_rd_err`).

## Minimal reproduction template

Include these details in the issue report:

- **Mac model and chip** (for example, M3 Max, 36 GB)
- **macOS version** (for example, 15.4.1 or 26.0)
- **Gmac version** (from **Gmac › About Gmac**) and **GmacWine version**
- **Game or launcher** and distribution channel (Steam, Epic, GOG, standalone)
- **PC settings:** Graphics backend, **Sharp, full-resolution games**, **Metal 4 Backend**, **DLSS via MetalFX**, **DLSS Frame Generation**, **DirectX Raytracing**, and **Enhanced Sync**
- **Steps to reproduce:** the shortest sequence that triggers the issue
- **Expected and actual behaviour**
- **Attached diagnostics:** Stability Diagnostics report, exported Crash Diagnostic report, and relevant Wine or Console crash logs

## Triage guidance for maintainers

- **UI freezes correlated with Wine commands:** check for main-thread blocking, synchronous `Process.waitUntilExit()` calls, or pipe buffer deadlocks when draining stdout/stderr.
- **Kernel panics or WindowServer hangs:** treat as GPU driver or Metal translation issues. Confirm **DLSS Frame Generation** and **Metal 4 Backend** state, check **DirectX Raytracing**, and test alternate graphics backends before filing upstream.
- **GmacWine installation failures:** inspect `GmacWineSetupDiagnostics` output, verify the `Libraries.tar.gz` SHA-256 digest against `DistributionConfig.gamingRuntime` and `docs/DEPENDENCIES.md`, and verify the extracted `Libraries/Wine/bin/wine64` and `Libraries/WhiskyWineVersion.plist` layout.
