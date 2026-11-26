# Release workflow

This document describes how to publish an application update via Sparkle, build a notarized disk image, assemble a Wine runtime archive, and maintain the credentials required by the release pipeline.

## Artifacts

| Artifact | Tag | Contents | Produced by |
|---|---|---|---|
| Application update | `app-vX.Y.Z` | `Gmac-X.Y.Z.zip`, signed for Sparkle | `scripts/publish-update.sh` |
| Notarized disk image | `app-vX.Y.Z` | `Gmac-X.Y.Z.dmg`, Developer ID signed and stapled | `scripts/release.sh` |
| Gaming Wine runtime | `vX.Y.Z-gaming.N` | `Libraries.tar.gz` | `runtime/local-build.rb` and `gh release create` |
| Legacy runtime assembly | `vX.Y.Z` | `Libraries.tar.gz` | `scripts/assemble-runtime.sh` |
| Documentation site and feeds | none (`gh-pages`) | `dist/pages/`, `appcast.xml`, `WhiskyWineVersion.plist` | `.github/workflows/Pages.yml` and `scripts/publish-update.sh` |

The Sparkle update feed is `appcast.xml` on the `gh-pages` branch, served at `https://rolling7ho.github.io/gmac/appcast.xml` and referenced by `SUFeedURL` in [`Gmac/Info.plist`](../Gmac/Info.plist). The documentation mirror under `dist/pages/docs/` and `dist/pages/sitemap.xml` is built by [`scripts/build-docs-site.py`](../scripts/build-docs-site.py) and synced automatically to `gh-pages` by [`.github/workflows/Pages.yml`](../.github/workflows/Pages.yml) on pushes to `main`.

## One-time setup

Perform the following setup once per maintainer machine.

### Apple Developer ID Application certificate

A Developer ID Application certificate is required to distribute a Gatekeeper-compatible disk image. Apple Development and Apple Distribution certificates are insufficient.

1. Open **Xcode › Settings › Accounts**, select the Apple ID, and click **Manage Certificates…**.
2. Click **+** and choose **Developer ID Application**.
3. Xcode installs the certificate in the login keychain automatically.

### notarytool credentials

Apple's notary service requires an app-specific password.

1. Generate an app-specific password at <https://appleid.apple.com> under **Sign-In and Security › App-Specific Passwords**.
2. Store it as a `notarytool` keychain profile named `AC_PASSWORD`:

   ```sh
   xcrun notarytool store-credentials AC_PASSWORD \
     --apple-id <apple-id-email> \
     --team-id Z7JS58F8U3 \
     --password <app-specific-password>
   ```

3. `scripts/release.sh` reads this profile by name (`AC_PASSWORD`, or override via `NOTARY_PROFILE`).

### Sparkle EdDSA keys

An Ed25519 key pair signs appcast enclosures. Sparkle's `generate_keys` tool ships inside the Sparkle Swift package artifact after building Gmac once. Depending on whether you built with `scripts/install-local.sh` (`.build/`) or Xcode (`DerivedData`), the tools reside in one of:

```sh
.build/SourcePackages/artifacts/sparkle/Sparkle/bin/
~/Library/Developer/Xcode/DerivedData/Gmac-*/SourcePackages/artifacts/sparkle/Sparkle/bin/
```

Run `generate_keys --account gmac` once on the initial machine. The private key is stored in the login keychain under account `gmac`, and the public key is printed to standard output and committed in `Gmac/Info.plist` under `SUPublicEDKey`. Regenerating keys invalidates `SUPublicEDKey` in every shipped application.

## Credential continuity

Three secrets gate the release pipeline. Losing the Sparkle private key is unrecoverable for existing installations because `SUPublicEDKey` is embedded in every shipped `Info.plist`. Maintain current, restore-tested backups of all three.

| Secret | Location | Consequence if lost |
|---|---|---|
| Sparkle EdDSA private key | Login keychain (`gmac` account) or `~/.gmac-sparkle-private-key` | Existing installations cannot verify future automatic updates |
| Developer ID Application identity | Login keychain | Re-issue from Apple Developer portal; notarized DMG releases are blocked until restored |
| `notarytool` app-specific password | `appleid.apple.com`, cached as keychain profile `AC_PASSWORD` | Regenerate at `appleid.apple.com` and rerun `store-credentials` |

### Backup procedure

1. Locate the Sparkle binaries and export the private key (Keychain will prompt for access):

   ```sh
   SPARKLE_BIN=".build/SourcePackages/artifacts/sparkle/Sparkle/bin"
   if [ ! -d "$SPARKLE_BIN" ]; then
     SPARKLE_BIN=$(ls -dt ~/Library/Developer/Xcode/DerivedData/Gmac-*/SourcePackages/artifacts/sparkle/Sparkle/bin 2>/dev/null | head -1)
   fi
   "$SPARKLE_BIN/generate_keys" --account gmac -x sparkle_ed25519_private.key
   ```

2. Export the Developer ID identity: open **Keychain Access › My Certificates**, right-click *Developer ID Application: …*, and export it as `developer_id.p12` with a strong passphrase.
3. Encrypt both files before copying them off the machine:

   ```sh
   age -p sparkle_ed25519_private.key > sparkle_ed25519_private.key.age
   age -p developer_id.p12 > developer_id.p12.age
   ```

   `age` does not ship with macOS; install it with `brew install age` (or use `gpg -c`).
4. Store the encrypted files and the app-specific password in two separate off-machine locations (such as a password-manager secure note and an offline drive), then delete the plaintext exports.
5. Record the Developer ID certificate expiry date and schedule reminders 60 and 14 days in advance:

   ```sh
   security find-certificate -a -c "Developer ID Application" -p | openssl x509 -noout -enddate
   ```

   If multiple certificates coexist during renewal, inspect each `-----BEGIN CERTIFICATE-----` block individually and update reminders after renewal.

### Restore test

Verify the exported Sparkle key against an existing published `Gmac-X.Y.Z.zip` update archive without modifying the keychain:

```sh
"$SPARKLE_BIN/sign_update" -f sparkle_ed25519_private.key -p Gmac-X.Y.Z.zip
```

Confirm that both `sparkle:edSignature` and the file byte length match the corresponding `<enclosure>` entry in `appcast.xml`. Ed25519 signatures are deterministic, so any mismatch indicates either the wrong key or a non-canonical archive.

### Recovery on a new machine

1. Build Gmac once (`scripts/install-local.sh` with `INSTALL=0`) so the Sparkle tools are downloaded into `.build/SourcePackages/artifacts/sparkle/Sparkle/bin/`.
2. Decrypt the backup with `age -d sparkle_ed25519_private.key.age > ~/.gmac-sparkle-private-key` (or import it into the login keychain with `"$SPARKLE_BIN/generate_keys" --account gmac -f sparkle_ed25519_private.key` and delete the temporary plaintext file). Note that `scripts/publish-update.sh` prefers `$SPARKLE_KEY_FILE` / `~/.gmac-sparkle-private-key` if present, avoiding keychain prompt hangs.
3. Open `developer_id.p12` to install the Developer ID identity in the login keychain.
4. Recreate the `AC_PASSWORD` keychain profile with `xcrun notarytool store-credentials`.

## Application update

[`scripts/publish-update.sh`](../scripts/publish-update.sh) publishes a Sparkle update. It requires a clean working tree, `gh` authenticated with push access, and the Sparkle signing key (`~/.gmac-sparkle-private-key`, `$SPARKLE_KEY_FILE`, or the `gmac` keychain account).

If the release must embed Gmac's DirectX 12 layer (`GmacD3D12` / `gmacmetal`), run [`scripts/build-gmac-d3d12.sh`](../scripts/build-gmac-d3d12.sh) before running `publish-update.sh` so `build/gmac-d3d12/` is present. Otherwise, `scripts/install-local.sh` emits a warning and builds without `GmacD3D12`.

The script performs these steps:

1. Moves entries from `[Unreleased]` in `CHANGELOG.md` into `[X.Y.Z]` and saves them as release notes.
2. Updates `MARKETING_VERSION` to `X.Y.Z`, increments `CURRENT_PROJECT_VERSION` by one in `Gmac.xcodeproj/project.pbxproj`, and commits the bump on the current branch.
3. Calls `INSTALL=0 scripts/install-local.sh` to build and ad-hoc sign `Gmac.app`, packages it as `Gmac-X.Y.Z.zip` with `ditto`, and signs the zip archive with `sign_update`.
4. Tags `app-vX.Y.Z`, pushes the current branch and tag to `origin`, and creates the GitHub release containing `Gmac-X.Y.Z.zip`.
5. Checks out `origin/gh-pages` into a temporary worktree, updates `appcast.xml` via [`scripts/update-appcast.py`](../scripts/update-appcast.py), commits, and pushes to `gh-pages`.

```sh
scripts/publish-update.sh 4.2.0
```

Do not edit `appcast.xml` on `gh-pages` or `dist/pages/appcast.xml` by hand.

### Notarized disk image

[`scripts/release.sh`](../scripts/release.sh) builds a Developer ID signed, notarized, and stapled disk image for direct distribution:

1. Archives the `Gmac` scheme in Release configuration using automatic provisioning.
2. Exports and re-signs `Gmac.app` with Developer ID Application per [`scripts/exportOptions.plist`](../scripts/exportOptions.plist).
3. Verifies the bundle signature with `codesign --verify --deep --strict`.
4. Creates a UDZO disk image (`build/release/Gmac-X.Y.Z.dmg`) and signs it with Developer ID Application.
5. Submits the disk image to Apple's notary service via `xcrun notarytool submit --wait`, staples the ticket with `xcrun stapler staple`, and validates with `spctl --assess`.

```sh
scripts/release.sh 4.2.0
```

### Appcast entry format

For reference, `scripts/update-appcast.py` inserts items with the following structure:

```xml
<item>
    <title>Gmac X.Y.Z</title>
    <pubDate>RFC 822 date</pubDate>
    <sparkle:version>BUILD_NUMBER</sparkle:version>
    <sparkle:shortVersionString>X.Y.Z</sparkle:shortVersionString>
    <sparkle:minimumSystemVersion>15.0</sparkle:minimumSystemVersion>
    <description><![CDATA[<p>Release notes…</p>]]></description>
    <enclosure
        url="https://github.com/rolling7ho/gmac/releases/download/app-vX.Y.Z/Gmac-X.Y.Z.zip"
        sparkle:edSignature="…"
        length="…"
        type="application/octet-stream" />
</item>
```

## Wine runtime release

### Gaming runtime (`vX.Y.Z-gaming.N`)

The active Gmac runtime is built from `rolling7ho/winecx` using [`runtime/local-build.rb`](../runtime/local-build.rb) (see [`runtime/README.md`](../runtime/README.md)).

1. Run the build driver from `runtime/` (set `WINECX_COMMIT` and `RUNTIME_VERSION_OVERRIDE` as needed) and verify the output archive passes all gates (relocatable tree, window creation, Media Foundation decoders, and library loading).
2. Name the release asset exactly `Libraries.tar.gz` and compute its digest:

   ```sh
   shasum -a 256 Libraries.tar.gz
   ```

3. Publish the GitHub release under tag `vX.Y.Z-gaming.N`:

   ```sh
   gh release create vX.Y.Z-gaming.N --repo rolling7ho/gmac --title "Engine X.Y.Z (gaming)" Libraries.tar.gz
   ```

4. Update `DistributionConfig.gamingRuntime` (`version`, `tag`, `sha256`) in [`GmacKit/Sources/GmacKit/Utils/DistributionConfig.swift`](../GmacKit/Sources/GmacKit/Utils/DistributionConfig.swift) and record the version, commit hash, and SHA-256 in [`docs/DEPENDENCIES.md`](DEPENDENCIES.md).
5. Open a pull request targeting `main` and publish an application update so installations receive the new `DistributionConfig.gamingRuntime` pin.

### Legacy upstream-assembled runtime (`vX.Y.Z`)

For assembling an archive from prebuilt upstream binaries (`Gcenx/macOS_Wine_builds`, `DXVK-macOS`, `DXMT`), [`scripts/assemble-runtime.sh`](../scripts/assemble-runtime.sh) downloads and verifies the base runtime, strips the builtin marker from the DXMT D3D11 trio, pairs `winemetal`, updates the inner `WhiskyWineVersion.plist`, and repacks `Libraries.tar.gz`. When updating that channel, update `dist/pages/WhiskyWineVersion.plist`, `.github/workflows/RuntimeTrack.yml`, and [`docs/DEPENDENCIES.md`](DEPENDENCIES.md).

## URLs the application depends on

- `https://rolling7ho.github.io/gmac/appcast.xml`: Sparkle application update feed (`SUFeedURL` in `Gmac/Info.plist`).
- `https://frankea.github.io/Whisky/WhiskyWineVersion.plist`: legacy channel version plist checked before falling back to `DistributionConfig.gamingRuntime`.
- `https://github.com/rolling7ho/gmac/releases/download/v<gamingRuntime.tag>/Libraries.tar.gz`: active gaming Wine runtime archive (`DistributionConfig.gamingRuntimeURL`).
- `https://github.com/rolling7ho/gmac/releases/download/app-vX.Y.Z/Gmac-X.Y.Z.zip`: application update archive referenced by `appcast.xml`.
- `https://cdn.akamai.steamstatic.com/client/installer/SteamSetup.exe`: official Windows Steam installer downloaded on demand by `SteamInstaller`.

## Pitfalls

- **Do not override `CODE_SIGN_IDENTITY` at archive time in `scripts/release.sh`.** The project uses automatic Apple Development signing during archive and re-signs with Developer ID on export.
- **Stage `build/gmac-d3d12/` before running `scripts/publish-update.sh`.** `scripts/install-local.sh` embeds `GmacD3D12` only when `build/gmac-d3d12/unix/gmacmetal.so` exists; omitting this step silently produces a release without the `gmacmetal` backend.
- **Do not bundle the `GmacKit` folder as a resource.** Doing so copies `GmacKit/.build` (including DocC plugin binaries lacking the hardened runtime) into `Gmac.app`, causing Apple notarization to reject the archive. Keep the `PBXFileReference` and `PBXGroup` entries in `Gmac.xcodeproj` without restoring any `PBXResourcesBuildPhase` entry.
- **Drain pipes before `waitUntilExit()` in `Tar`.** Verbose `tar` output on a multi-hundred-megabyte archive overflows the OS pipe buffer and deadlocks if `waitUntilExit()` runs before draining stdout/stderr.
