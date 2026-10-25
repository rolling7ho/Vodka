<div align="center">

  <img src="./images/vodka-icon.png" width="128" alt="Vodka icon">

  # Vodka 🍸
  *Windows games on your Mac, neat*

  > Vodka is a fork of [Whisky](https://github.com/whisky-app/whisky) by Isaac Marovitz, by way of
  > [frankea's community fork](https://github.com/frankea/Whisky). It is not affiliated with either
  > project. Like Whisky, it is free software under the GNU GPL v3.
</div>

## What's different

Vodka is built for playing Steam games on a Mac:

- **Guided Steam setup.** The library opens on a four-step guide: create the Steam bottle, choose
  graphics, install Steam (downloaded from Valve and installed silently), then sign in.
- **Graphics by DirectX version.** Like CrossOver, the choice is named after what games use, with
  examples: Automatic, DirectX 12 (Apple D3DMetal), DirectX 11 (DXMT), DirectX 9 and OpenGL/Vulkan
  (WineD3D). Automatic reads a game's import tables (`GraphicsAPIDetector`) when it is played from the
  library and picks per game.
- **DirectX 12.** Installs the GPTK-capable engine (frankea's v4.6.4, CrossOver 26 changes on Wine 11.16).
  Apple's Game Porting Toolkit can't be redistributed, so the guide links to Apple's download, then
  finds the `.dmg` in Downloads and installs it.
- **macOS Game Mode.** Every Wine process runs from a games-category app bundle
  (`Libraries/Wine/lib/wine/Wine.app`, App Nap off), so Game Mode turns on when a game is full screen.
  `WineGameMode` keeps that layout in sync and can turn it off in Settings › Gaming.
- **Native resolution.** On by default: Wine's Retina mode at 192 DPI, with each installed game marked
  per-monitor DPI-aware (`dpiAwareness` in its Image File Execution Options), so games render at the
  panel's real pixels and Steam is sized and sharp like a Mac app. Needs this edition's engine, below.
- **Its own engine.** frankea's GPTK engine plus Vodka's mac-driver fixes
  ([rolling7ho/winecx](https://github.com/rolling7ho/winecx)): Retina sizing for Steam, Steam menus that
  draw, app names in the menu bar, fixed fullscreen modes, and MetalFX upscaling with sharpening.
- **Performance.** MoltenVK logs errors only and submits asynchronously. Right-click a Steam game in
  the library and choose *Resolution › Faster* to draw it at half resolution, a quarter of the pixels,
  scaled up by macOS.
- **Steam stays visible.** If Steam switches itself to software rendering after a GPU crash, which
  leaves its window black under Wine's mac driver, the next launch switches it back.
- **Warnings before Play.** Library cards flag games whose anti-cheat blocks Wine, or that are known
  not to run, and a DirectX 12 game started without Apple's Game Porting Toolkit says what's missing.
- **Easy reset.** *Delete Bottle…* in the sidebar menu and in a bottle's settings closes what runs in
  it and moves it to the Trash in one step.

- **Statistics.** Total and recent playtime per game, most played, longest session and storage used.
- **Add to Dock.** Any library game can become a Dock icon that starts it without opening Vodka.

Games with a GameDB preset (Teardown included) get it applied when launched from Steam. Technical
settings sit behind *Show advanced settings*.

## Overview

Vodka provides a clean and easy-to-use graphical wrapper for Wine built in native SwiftUI. You can make and manage bottles, install and run Windows apps and games, and unlock the full potential of your Mac with no technical knowledge required.

<img width="650" alt="Vodka in action" src="./images/demo.gif">

<img width="650" alt="Config" src="./images/config-screenshot.png">

*Familiar UI that integrates seamlessly with macOS*

<div align="right">
  <img width="650" alt="New Bottle" src="./images/new-bottle-screenshot.png">

  *One-click bottle creation and management*
</div>

<img width="650" alt="debug" src="./images/debug-screenshot.png">

*Debug and profile with ease*

---

## Key Features

- **Wine 11.0** - Latest stable Wine with improved compatibility and networking
- **DXMT & DXVK Graphics** - DirectX 11 through native Metal translation (DXMT) out of the box, with DXVK over MoltenVK as the universal fallback
- **Launcher Compatibility** - Built-in support for Steam, Epic, EA App, Rockstar, Battle.net, and more
- **Controller Support** - SDL environment variable controls for gamepad detection and mapping issues
- **Stability Diagnostics** - One-click diagnostic reports for troubleshooting crashes and freezes
- **Native SwiftUI** - Beautiful, familiar macOS interface

## System requirements

- **CPU**: Apple Silicon (M-series chips)
- **OS**: macOS Sequoia 15.0 or later

## Installation

Vodka isn't distributed as a signed download yet. To build and install it on your Mac:

```sh
git clone https://github.com/rolling7ho/Whisky.git Vodka
cd Vodka
scripts/install-local.sh   # ad-hoc signed, for this Mac only
```

On first launch Vodka downloads its Wine engine (~330 MB) from this repo's releases.

### Coming from Whisky

- **From an earlier build of this fork** (`com.rolling7ho.Whisky`): the first launch of Vodka moves
  your Windows PCs, engine, logs and settings over by itself.
- **From the original Whisky:** choose **File → Migrate from the Original Whisky**. It imports the
  bottles the original app left in `~/Library/Containers/com.isaacmarovitz.Whisky/` in place, so
  nothing is moved or copied.

## Uninstalling

Dragging **Vodka.app** to the Trash leaves the engine, your Windows PCs and settings behind, so a
reinstall doesn't download them again. To remove everything, back up anything you want to keep and
delete:

```sh
rm -rf /Applications/Vodka.app
rm -rf ~/Library/Containers/com.rolling7ho.Vodka          # Windows PCs and their list
rm -rf ~/Library/Application\ Support/com.rolling7ho.Vodka # the Wine engine
rm -rf ~/Library/Caches/com.rolling7ho.Vodka ~/Library/Logs/com.rolling7ho.Vodka
rm -f  ~/Library/Preferences/com.rolling7ho.Vodka.plist
```

Windows PCs made in a custom folder live wherever you put them.

## Privacy

Vodka collects no usage data and has no analytics SDK. The only network
requests it makes on its own are update checks (Sparkle's appcast) and Wine
runtime downloads from GitHub Releases.

## Documentation

- **[Runtime dependencies](docs/DEPENDENCIES.md)** - The bundled Wine/DXVK/D3DMetal/DXMT versions and their upstream sources

### Troubleshooting

- **[Launcher Troubleshooting](docs/LauncherTroubleshooting.md)** - Fix issues with Steam, Epic, Battle.net, etc.
- **[Steam Compatibility Guide](docs/SteamCompatibility.md)** - Detailed guide for Steam on Vodka
- **[Stability Troubleshooting](docs/StabilityTroubleshooting.md)** - Diagnose crashes, freezes, reboots, and kernel panics
- **Controller Issues** - Enable "Controller Compatibility Mode" in Bottle Config → Controller & Input
- **[Game Configurations](VodkaKit/Sources/VodkaKit/GameDatabase/Resources/GameDB.json)** - 80+ curated per-game compatibility configs, also browsable in-app under Game Configurations

---

## Credits & Acknowledgments

Vodka is possible thanks to the magic of several projects:

- [Whisky](https://github.com/whisky-app/whisky) by Isaac Marovitz and contributors, which Vodka is built from
- [frankea/Whisky](https://github.com/frankea/Whisky), the community fork Vodka continues from

- [msync](https://github.com/marzent/wine-msync) by marzent
- [DXVK-macOS](https://github.com/Gcenx/DXVK-macOS) by Gcenx and doitsujin
- [DXMT](https://github.com/3Shain/dxmt) by 3Shain
- [MoltenVK](https://github.com/KhronosGroup/MoltenVK) by KhronosGroup
- [Sparkle](https://github.com/sparkle-project/Sparkle) by sparkle-project
- [SemanticVersion](https://github.com/SwiftPackageIndex/SemanticVersion) by SwiftPackageIndex
- [swift-argument-parser](https://github.com/apple/swift-argument-parser) by Apple
- [CrossOver](https://www.codeweavers.com/crossover) by CodeWeavers and WineHQ
- D3DMetal by Apple

Special thanks to Gcenx, ohaiibuzzle, Nat Brown, and [Isaac Marovitz](https://github.com/IsaacMarovitz) (original author) for their support and contributions!

---

<table>
  <tr>
    <td>
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset="./images/cw-dark.png">
          <img src="./images/cw-light.png" width="500">
        </picture>
    </td>
    <td>
        Vodka doesn't exist without CrossOver. If you want a fully-supported commercial Wine experience on macOS, check out <a href="https://www.codeweavers.com/crossover">CrossOver</a> from CodeWeavers. (This fork has no affiliate arrangement and receives nothing from CrossOver sales.)
    </td>
  </tr>
</table>
