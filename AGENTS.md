# AGENTS.md

Operating manual for AI coding agents and new contributors working in this repository.
`README.md` provides orientation for human readers; this file defines the rules and
procedures. Where an explicit user instruction conflicts with this file, the user
instruction takes precedence.

## Project

**Gmac** is a native macOS application that runs Windows games and PC launchers on Apple Silicon
(a fork of Whisky via frankea's community fork). Toolchain: Swift 6, SwiftUI, macOS 15 or
later, Xcode 16 or later.

Related repositories in the ecosystem live in separate Git repositories (typically cloned as
siblings under a common parent directory):

- `rolling7ho/winecx`: patched Wine/CrossOver source tree (`d3dmetal-errno` branch).
- `rolling7ho/dxmt`: patched DXMT source tree (`teardown` branch) for `gmacmetal`.
- `rolling7ho/openv`: open-source single-player ScriptHookV replacement for GTA V Enhanced.

## Repository map

| Path | Role | Notes |
|---|---|---|
| `Gmac/` | SwiftUI application target | New files require entries in `Gmac.xcodeproj`. |
| `GmacKit/` | Swift package containing the logic: Wine, bottles, Steam, library, playtime | SwiftPM discovers new files automatically. Tests reside here. |
| `GmacCmd/` | Command-line interface used by Dock shortcuts to launch games | |
| `GmacThumbnail/` | Quick Look thumbnail extension for `.exe` files | |
| `GmacUITests/` | XCUITest suite for the application | Fixture-dependent tests skip when no bottle exists. |
| `scripts/` | Build, release, localization and secret-scan helpers | |
| `docs/` | Dependency, release and troubleshooting documentation | Runtime pins must match `docs/DEPENDENCIES.md`. |
| `runtime/` | Local Wine runtime build driver and notes | Local lanes (`runtime-*`, `pkg-*`, `deps/`) remain untracked. |
| `.build/` | DerivedData and SwiftPM output | Never commit. `GmacKit/.build` is ignored separately. |

## Environment

- Apple Silicon Mac, macOS 15 or later, Xcode 16 or later (`swift --version` should report
  Swift 6).
- `swiftlint`, which runs automatically as an Xcode build phase; violations fail the
  build.
- `swiftformat` **0.58.7**, the version CI downloads. Homebrew's `swiftformat` is usually
  newer than that pin; verify `swiftformat --version` and install the 0.58.7 release if
  `--lint` reports differences that CI does not.
- `trufflehog` for `scripts/scan-secrets.sh` (`brew install trufflehog`).

## Commands

Run commands from the repository root.

### Build, test, install

```sh
# Build the application (Debug, unsigned, with the codesign flags CI uses)
xcodebuild -project Gmac.xcodeproj -scheme Gmac -configuration Debug build \
  -derivedDataPath .build/debug \
  CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO

# Build every scheme, as CI does
for scheme in Gmac GmacCmd GmacThumbnail; do
  xcodebuild -project Gmac.xcodeproj -scheme "$scheme" -configuration Debug build \
    CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO
done

# Release build, ad-hoc signed, installed to /Applications
scripts/install-local.sh

# Unit tests (GmacKit); fast, run for any logic change
swift test --package-path GmacKit

# A single suite or test
swift test --package-path GmacKit --filter CommandKeyMappingTests

# UI tests (slow; run only when UI behaviour changed)
xcodebuild -project Gmac.xcodeproj -scheme Gmac -configuration Debug \
  -destination 'platform=macOS' -only-testing:GmacUITests test \
  CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO
```

### Style, strings, secrets

```sh
swiftformat --lint .                     # check; fix with: swiftformat .
swiftlint --strict                      # configuration: .swiftlint.yml
./scripts/british-english.py --check    # en-GB must cover every en key
./scripts/scan-secrets.sh               # same check as CI (TruffleHog)
```

### Direct3D 12 layer

```sh
scripts/build-gmac-d3d12.sh [dxmt-checkout-path]
```

Defaults to `GMAC_DXMT_DIR` or `../dxmt` with its `toolchains/` directory present. Stages
DLLs into `build/gmac-d3d12/`.

## Architecture and boundaries

- **Layering.** UI and application lifecycle code belongs in `Gmac/`; Wine, bottle, Steam,
  library and playtime logic belongs in `GmacKit`. Testable logic belongs in `GmacKit`,
  not in views.
- **Game fixes are data.** A fix that only changes Windows settings for one game belongs
  in `GmacKit/Sources/GmacKit/GameDatabase/Resources/GameDB.json`, with a reference to
  the origin of the fix. Games must not be special-cased in Swift.
- **Runtime is downloaded, not vendored.** The application fetches `Libraries.tar.gz`
  according to `GmacKit/Sources/GmacKit/Utils/DistributionConfig.swift`. Runtime
  binaries must never be added to the repository. Runtime pins live in
  `.github/workflows/RuntimeTrack.yml` and must remain in sync with `docs/DEPENDENCIES.md`.
- **Localization.** New user-facing strings are added to `Gmac/Localizable.xcstrings`
  **in English only**, edited as text with only the required lines touched. Re-saving the
  file with a JSON tool reorders the catalog. Run `scripts/british-english.py` afterwards to
  regenerate en-GB.
- **Xcode project.** Files added to the application target (`Gmac/`) require
  `Gmac.xcodeproj` entries, while `GmacKit` discovers files automatically. Adding those
  entries for a new source file is expected and is the only `project.pbxproj` edit
  permitted (see hard rule 2).
- **Generated site.** `dist/pages/` holds the published site. The page and stylesheet are
  edited as source; the appcast is written by `scripts/publish-update.sh` and the
  documentation pages under `dist/pages/docs/` by `scripts/build-docs-site.py`. Publish by
  copying the directory to the `gh-pages` branch. Do not edit `appcast.xml` by hand.

## Code conventions

- Every Swift file begins with the GPL header ("This file is part of Gmac, a fork of
  Whisky."). `file_header` is an error-level SwiftLint rule; copy the header from an
  existing file.
- SwiftFormat configuration: 4-space indent, maximum width 120, `--guardelse next-line`,
  alphabetical import grouping, no semicolons. `redundantSelf` is disabled, so explicit
  `self` is preserved; do not remove it by hand. Run the formatter rather than matching
  style manually.
- SwiftLint enables `force_unwrapping`; do not add `!` unwraps in new code.
- Prefer existing patterns (bottle abstractions, the `Bottle` and `Wine` types,
  swift-testing suites for new tests) over new abstractions or dependencies. Ask before
  adding a package.
- GmacKit tests are mixed: XCTest and swift-testing (`@Test`, `struct ...Tests`)
  coexist. New tests use swift-testing, and existing XCTest files are not ported as
  incidental churn. `GmacUITests` uses XCTest throughout.
- Changelog: describe user-facing changes under `[Unreleased]` in `CHANGELOG.md`.
- Commit messages are imperative and scoped, for example `gmac: fix Steam launch
  resolver` or `docs: update the README`.

## Writing and communication

One register applies to all text produced in this repository or in conversation with the
maintainer, unless an explicit instruction states otherwise. Do not require the user to ask
for it.

**Scope.** The policy covers:

- documentation, README files, plans, ADRs and design notes;
- pull request titles, descriptions, review comments and issue replies;
- commit messages and code comments;
- every response to the maintainer, including short status updates, questions and
  summaries of work.

**Register.**

- Use complete sentences and state the fact or the action directly.
- Do not use contractions, em-dash asides, exclamation marks or decorative emoji.
- Do not use marketing superlatives, and do not assert claims the repository cannot
  substantiate. Quantify only values that were measured.
- Use the imperative mood for instructions, the present tense for descriptions, and "must"
  or "do not" for requirements.
- Use one term per concept and do not alternate synonyms for the same object.
- Prefer the concrete path, command or symbol to a paraphrase of it.

**Exceptions.** An explicit user instruction to write briefly or informally overrides this
section for that response only.

## Testing guidance

- Logic change: `swift test --package-path GmacKit`, with `--filter` for the affected
  suite.
- Application or UI change: build the affected scheme; run `GmacUITests` only when the
  interaction itself changed.
- Strings or localization: `scripts/british-english.py --check`.
- Formatting and lint: `swiftformat --lint .` and `swiftlint --strict`.
- CI-only checks (coverage upload, Codecov, gh-pages) may be skipped locally.
- Never weaken, skip or delete a test to obtain a passing run. Fix the cause and report
  anything that could not be run.

## Git workflow

- **Every change goes through a pull request by default.** This applies to all work,
  including code, documentation, configuration and one-line fixes. Do not wait for the
  user to request a pull request or to point out that one is needed: branch, push the
  branch, open the pull request and report its URL as part of completing the task.
- **Never push to `main` directly.** Do not `git push` to `main`, do not push a branch
  that is then fast-forwarded into `main` by hand, and do not merge a pull request without
  explicit user approval. The standard procedure:

  ```sh
  git switch -c gmac/short-description
  # edit, then run the checks in the verification table
  git add <explicit paths>
  git commit -m "gmac: fix Steam launch resolver"
  git push -u origin gmac/short-description
  gh pr create --fill --base main
  ```

  Run the checks yourself rather than treating a green merge button as evidence.
- **Delete the branch after every pull request.** Once the pull request merges, remove
  the remote branch with `git push origin --delete <branch>` and the local branch with
  `git branch -d <branch>`, then run `git fetch --prune` to drop stale remote-tracking
  references. A pull request that is closed without merging is cleaned up the same way.
- Stage explicit paths rather than `git add -A` when untracked runtime lanes or local build
  artifacts are present.

## Hard rules

1. Do not commit runtime build outputs (`runtime/runtime-*`, `runtime/pkg-*`,
   `runtime/deps`, `.build/`, `*.tar.gz`, logs, or machine-specific artifacts).
2. Do not edit generated files by hand: `dist/pages/docs/`, the formatting of
   `Gmac/Localizable.xcstrings`, or `*.xcodeproj` internals. The one permitted
   `Gmac.xcodeproj` edit is adding the file references and build-phase entries that a new
   application-target source file requires.
3. Do not introduce secrets, API keys, certificates or provisioning profiles. The Sparkle
   signing key resides in the maintainer's keychain (`gmac` account) and must never be
   placed in the repository.
4. Do not run destructive commands (`git reset --hard`, `git clean -xdf`) unless the user
   explicitly requests that exact action.
5. Do not add a dependency or a new top-level directory without asking.
6. Do not push to `main`, and do not consider a change complete until it is on a branch
   with an open pull request. Only the merge into `main` waits for the user to ask.
7. Write in the formal technical register defined under **Writing and communication**. The
   policy applies to every document, plan, ADR, pull request comment and reply to the
   maintainer, and requires no reminder from the user.

## Verification before finishing

| You changed | Run at least |
|---|---|
| GmacKit logic | `swift test --package-path GmacKit --filter <suite>` |
| Application or UI | build the `Gmac` scheme; `GmacUITests` if interaction changed |
| User-facing strings | `./scripts/british-english.py --check` |
| Swift style | `swiftformat --lint . && swiftlint --strict` |
| Documentation only | check links and paths; builds may be skipped |

Report exactly which checks ran, their result, and any check that could not be run.
Compiling is not equivalent to testing behaviour.

## Known pitfalls

- SwiftLint is skipped silently in Xcode when `CI=true` is set, so a local build can pass
  while CI fails. Run `swiftlint --strict` explicitly.
- en-GB must be complete. A single missing string causes macOS to display the raw key to
  British users. Regenerate it after modifying `Gmac/Localizable.xcstrings`.
- The application bundle must ship `winetricks`, `verbs.txt` and `cabextract`. CI asserts
  on the built artifact because the copy phase can omit them without failing.

## Read next

- `README.md`: installation, features, and layout.
- `CONTRIBUTING.md`: build, pull request, and release detail.
- `docs/`: dependencies, release workflow, Steam compatibility, and troubleshooting.
