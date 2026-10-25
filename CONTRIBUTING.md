# Contributing to Vodka

Thanks for helping out. Bug reports, fixes and game compatibility notes are all welcome.

## Reporting a bug

[Open an issue](https://github.com/rolling7ho/Vodka/issues/new/choose) and use the template that fits.
In the app, **Help › Run Diagnostics…** writes a report covering your PC's settings and recent logs;
attaching it usually saves a round of questions. Before you attach it, remove anything you'd rather
not share.

## Building

You need an Apple Silicon Mac on macOS 15 or later, with Xcode 16 or later. Dependencies come from
the Swift Package Manager.

```sh
git clone https://github.com/rolling7ho/Vodka.git
cd Vodka
open Vodka.xcodeproj           # or build from the command line:
scripts/install-local.sh       # Release build, ad-hoc signed, installed to /Applications
```

The project has four parts:

| Part | What it is |
| --- | --- |
| `Vodka/` | The SwiftUI app |
| `VodkaKit/` | A Swift package with the logic: Wine, PCs, Steam, the library and playtime |
| `VodkaCmd/` | The command-line tool that Dock shortcuts use to start games |
| `VodkaThumbnail/` | The Quick Look thumbnail extension for `.exe` files |

## Before you open a pull request

```sh
swift test --package-path VodkaKit   # unit tests
swiftformat --lint .                 # formatting (SwiftFormat 0.58.7, the version CI uses)
```

SwiftLint runs as part of the Xcode build, and any violation fails the build. Every Swift file starts
with the license header, which reads "This file is part of Vodka, a fork of Whisky."; copy it from any
existing file.

Some launcher tests depend on whether the engine installed on your Mac includes D3DMetal. If those
fail for you on a clean checkout too, mention it in the PR and leave them alone.

## Guidelines

- **Keep pull requests small.** One fix or feature per PR.
- **Strings.** Add new user-facing text to `Vodka/Localizable.xcstrings` in English only. Edit the
  file as text and only touch the lines you need. Re-saving it with a JSON tool reorders the whole
  catalog and the diff becomes unreviewable.
- **Xcode project.** VodkaKit picks up new files on its own. Files you add to the app target also need
  entries in `Vodka.xcodeproj`.
- **Changelog.** Describe user-facing changes under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md).
- **Game fixes.** A fix that only changes settings belongs in
  `VodkaKit/Sources/VodkaKit/GameDatabase/Resources/GameDB.json`, with a link to where the fix came from.
- **Secrets.** CI scans every push with TruffleHog. To run the same check locally, use
  `scripts/scan-secrets.sh`.

## License

By contributing, you agree that your work is released under the [GNU GPL v3](LICENSE), the same
license as the rest of Vodka.
