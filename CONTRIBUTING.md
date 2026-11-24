# Contributing to Vodka

Contributions are welcome: bug reports, fixes and game compatibility notes.

## Reporting a bug

[Open an issue](https://github.com/rolling7ho/Vodka/issues/new/choose) and select the
appropriate template. In the application, **Help › Run Diagnostics…** writes a report
covering settings and recent logs; attaching it usually avoids an exchange of questions.
Remove anything you do not want to share before attaching it.

## Building

An Apple Silicon Mac running macOS 15 or later with Xcode 16 or later is required.
Dependencies are resolved by the Swift Package Manager.

Vodka is part of a monorepo. The application project resides in `apps/vodka`:

```sh
git clone https://github.com/rolling7ho/Vodka.git
cd Vodka/apps/vodka
open Vodka.xcodeproj           # or build from the command line:
scripts/install-local.sh       # Release build, ad-hoc signed, installed to /Applications
```

The project comprises four parts:

| Part | Responsibility |
|---|---|
| `Vodka/` | The SwiftUI application |
| `VodkaKit/` | Swift package containing the logic: Wine, PCs, Steam, the library and playtime |
| `VodkaCmd/` | Command-line tool used by Dock shortcuts to start games |
| `VodkaThumbnail/` | Quick Look thumbnail extension for `.exe` files |

## Before you open a pull request

```sh
swift test --package-path VodkaKit   # unit tests
swiftformat --lint .                 # formatting (CI pins SwiftFormat 0.58.7)
```

SwiftLint runs as part of the Xcode build and any violation fails the build. It is skipped
when `CI=true` is set, so run `swiftlint --strict` explicitly before opening a pull
request. Every Swift file begins with the license header reading "This file is part of
Vodka, a fork of Whisky."; copy it from an existing file.

## Guidelines

- **Every change lands through a pull request.** Direct pushes to `main` are not accepted.
- **Keep pull requests small.** One fix or feature per pull request.
- **Strings.** Add new user-facing text to `Vodka/Localizable.xcstrings` in English only.
  Edit the file as text and modify only the required lines. Re-saving it with a JSON tool
  reorders the entire catalog and makes the diff unreviewable.
- **Xcode project.** VodkaKit discovers new files automatically. Files added to the
  application target also require entries in `Vodka.xcodeproj`.
- **Changelog.** Describe user-facing changes under `[Unreleased]` in
  [CHANGELOG.md](CHANGELOG.md).
- **Game fixes.** A fix that only changes settings belongs in
  `VodkaKit/Sources/VodkaKit/GameDatabase/Resources/GameDB.json`, with a link to the origin
  of the fix.
- **Secrets.** CI scans every push with TruffleHog. Run the same check locally with
  `scripts/scan-secrets.sh`.

## Releasing an update

Installed copies check `https://rolling7ho.github.io/Vodka/appcast.xml`, served from the
`gh-pages` branch, through Sparkle. To publish an update, describe it under `[Unreleased]`
in the changelog, commit the working tree, and run:

```sh
scripts/publish-update.sh 4.0.1
```

The script moves the changelog entries into the new version, increments the marketing and
build versions, builds and ad-hoc signs the application, signs the archive with the Sparkle
key, creates the `app-v4.0.1` GitHub release, and adds the release to the appcast on
`gh-pages`. Signing requires the Sparkle key in the maintainer's login keychain (account
`vodka`) or at `~/.vodka-sparkle-private-key`. Retain a backup of the key: installed copies
accept updates only when signed with that key.

## License

By contributing, you agree that your work is released under the
[GNU GPL v3](LICENSE), the same license as the rest of Vodka.
