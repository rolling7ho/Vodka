# Contributing to Gmac

Contributions are welcome, including bug reports, code fixes, documentation updates, and game compatibility presets.

## Reporting a bug

[Open an issue](https://github.com/rolling7ho/gmac/issues/new/choose) and select the matching template. In the application, **Help › Run Diagnostics…** (`⇧⌘D`) analyzes a program's latest run log and exports a Markdown summary or ZIP bundle, and **PC › Settings › Advanced › Diagnostic Reports › Generate Stability Diagnostics** writes a bounded report of settings and recent log tails. Review any exported logs and remove sensitive details before attaching them.

## Building

An Apple Silicon Mac running macOS 15 or later with Xcode 16 or later is required. Swift dependencies are resolved by the Swift Package Manager.

```sh
git clone https://github.com/rolling7ho/gmac.git
cd gmac
open Gmac.xcodeproj            # or build from the command line:
scripts/install-local.sh       # Release build, ad-hoc signed, installed to /Applications/Gmac.app
```

The project comprises four targets:

| Part | Responsibility |
|---|---|
| `Gmac/` | SwiftUI application target |
| `GmacKit/` | Swift package containing core logic: Wine, bottles (presented as PCs in the UI), Steam, library, diagnostics, and playtime |
| `GmacCmd/` | Command-line tool embedded in the application and used by Dock shortcuts to start games |
| `GmacThumbnail/` | Quick Look thumbnail extension for `.exe` files |

## Before you open a pull request

Run the local checks that match CI:

```sh
swift test --package-path GmacKit    # unit tests
swiftformat --lint .                  # formatting (CI pins SwiftFormat 0.58.7)
swiftlint --strict                    # style lint (skipped in Xcode when CI=true)
./scripts/british-english.py --check  # en-GB localization coverage
./scripts/scan-secrets.sh             # TruffleHog verified-secret scan
```

If you edit any Markdown file mirrored to the static site (listed in `scripts/build-docs-site.py`), regenerate the HTML mirror and sitemap before committing:

```sh
python3 scripts/build-docs-site.py
```

Every Swift file must begin with the GPL v3 license header reading "This file is part of Gmac, a fork of Whisky." Copy the header from an existing Swift file; the `file_header` SwiftLint rule enforces this at error level.

## Guidelines

- **Every change lands through a pull request.** Direct pushes to `main` are not accepted.
- **Keep pull requests focused.** Limit each pull request to one fix or feature.
- **Strings.** Add new user-facing text to `Gmac/Localizable.xcstrings` in English only. Edit the file as text and modify only the required lines; re-saving it with a JSON formatter reorders the entire catalog and obscures the diff. Run `./scripts/british-english.py` afterwards to regenerate `en-GB`.
- **Xcode project.** `GmacKit/` discovers new Swift files automatically. Files added to `Gmac/`, `GmacCmd/`, or `GmacThumbnail/` also require entries in `Gmac.xcodeproj`.
- **Changelog.** Describe user-facing changes under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md).
- **Game fixes.** A fix that only changes Windows settings or environment variables for one game belongs in `GmacKit/Sources/GmacKit/GameDatabase/Resources/GameDB.json`, with a provenance reference to the origin of the fix.
- **Secrets.** CI scans every push with TruffleHog. Run `scripts/scan-secrets.sh` locally before pushing.

## Releasing an update

Installed copies check `https://rolling7ho.github.io/gmac/appcast.xml`, served from the `gh-pages` branch, through Sparkle. If the release must embed Gmac's DirectX 12 layer (`gmacmetal`), run `scripts/build-gmac-d3d12.sh` first so `build/gmac-d3d12/` is staged. To publish an update, describe the changes under `[Unreleased]` in `CHANGELOG.md`, ensure the working tree is clean, and run:

```sh
scripts/publish-update.sh 4.2.0
```

The script moves the `[Unreleased]` changelog entries into the new version section, increments `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION`, builds and ad-hoc signs the application, creates and signs `Gmac-4.2.0.zip` with the Sparkle EdDSA key, pushes the branch and tag `app-v4.2.0`, creates the GitHub release, and updates `appcast.xml` on `gh-pages`. Signing requires the Sparkle key in the maintainer's login keychain (`gmac` account) or at `~/.gmac-sparkle-private-key` (override with `SPARKLE_KEY_FILE`). Retain an encrypted off-machine backup of the key: installed copies accept updates only when signed with that key. See [docs/ReleaseWorkflow.md](docs/ReleaseWorkflow.md) for credential setup, key backup, notarized disk images (`scripts/release.sh`), and runtime releases.

## License

By contributing, you agree that your work is released under the [GNU GPL v3](LICENSE), the same license as the rest of Gmac.
