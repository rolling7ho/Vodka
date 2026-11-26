# Stability troubleshooting guide

**Feature:** Stability troubleshooting (frankea/Whisky#40)
**Last updated:** 13 January 2026

This document is a contributor-facing procedure for triaging **critical stability issues**:
crashes, hard freezes, reboots and kernel panics.

## Applicability

Use this guide for reports of:

- a macOS kernel panic or reboot during game launch or gameplay;
- a complete system freeze requiring a forced reboot;
- a Gmac UI freeze, for example while opening bottle configuration;
- a Gmac crash on launch or during GmacWine installation.

## Immediate mitigations for users

- **Enable Sequoia Compatibility Mode** (Bottle → Config → Metal → "Sequoia Compatibility
  Mode"). This addresses several macOS 15.x behaviours.
- **Disable DXR.** Ray tracing stresses graphics paths on some systems.
- **Kill All Bottles** (menu item). Terminates Wine processes for all bottles; use it when
  those processes are unresponsive or the UI is frozen.

## Collecting diagnostics

A complete report is required for actionable triage.

### Stability diagnostics report

If the build includes the stability diagnostics control (see `frankea/Whisky#56`), collect
this report first:

1. Open the affected bottle.
2. Open **Config**.
3. If a **Stability** section is present, select **Generate Stability Diagnostics**.
4. Export the report to a file and attach it to the issue.

If the section is absent, skip this step and attach Wine logs instead.

Notes:

- The stability report is **bounded**, so it is safe to share.
- It includes **environment keys only**, without values, to reduce privacy risk.

### Wine log folder

In the application, select **Open Logs Folder** (menu item) and attach the newest `.log`
files if requested.

Gmac enforces log size limits, comprising a per-file cap and a folder cap, to prevent
excessive disk use.

### macOS crash and panic logs

For kernel panics and reboots:

- Collect the panic report from **Console.app** (System Reports, Panic reports).
- Include the exact error string if one is visible, for example
  `IOMFB int_handler_gated: failure: axi_rd_err`.

## Minimal reproduction template

Include the following in the issue:

- **Mac model** (for example, M3 Max)
- **macOS version** (for example, 15.2 or 15.4.1)
- **Gmac version** and **GmacWine version**
- **Game or application** and its distribution channel (Steam, GOG and so on)
- **Bottle settings**: Sequoia compatibility, DXVK, DXR, Enhanced Sync
- **Steps to reproduce**, reduced to the shortest reliable sequence
- **Expected and actual behaviour**
- The **stability diagnostics report** if available, plus any relevant logs

## Triage guidance for maintainers

- If the report indicates a **UI freeze** correlated with Wine commands, investigate
  main-thread starvation and long-running aggregation of Wine commands first.
- If the report indicates a **kernel panic**, treat it as likely to be at driver level.
  Focus on mitigations (DXR disabled, a different graphics backend) and on collecting
  high-quality reproduction data.
- If the report indicates a **GmacWine installation failure**, collect the exact error
  message, validate the tarball structure and the version plist, and attach the relevant
  logs.
