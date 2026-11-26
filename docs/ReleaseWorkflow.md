# Release workflow

This document describes how to publish an application update, how to produce the Wine
Libraries archive, and which credentials the pipeline depends on.

## Artifacts

| Artifact | Tag | Contents | Produced by |
|---|---|---|---|
| Application update | `app-vX.Y.Z` | `Gmac-X.Y.Z.zip`, signed for Sparkle | `scripts/publish-update.sh` |
| Notarized disk image | `app-vX.Y.Z` | `Gmac-X.Y.Z.dmg` | `scripts/release.sh` |
| Wine runtime | `vX.Y.Z` | `Libraries.tar.gz` | assembled manually, then published |
| Static site data | none | version plist, appcast | `scripts/publish-update.sh`, `scripts/update-appcast.py` |

The Sparkle update feed is `appcast.xml` on the `gh-pages` branch, served at
`https://rolling7ho.github.io/gmac/appcast.xml` and referenced by `SUFeedURL` in the
application's `Info.plist`. The committed site content used by the publishing scripts
resides in `dist/pages/`.

## One-time setup

The following steps are required once per maintainer machine.

### Apple Developer ID Application certificate

A Developer ID Application certificate is required for a Gatekeeper-compatible disk image.
Apple Development and Apple Distribution certificates are insufficient.

1. **Xcode → Settings → Accounts** → select the Apple ID → **Manage Certificates…**
2. Select **+** → **Developer ID Application**.
3. The certificate is installed in the login keychain automatically.

### notarytool credentials

Apple's notary service requires an app-specific password.

1. Generate one at <https://appleid.apple.com> under **Sign-In and Security → App-Specific
   Passwords**.
2. Store it as a notarytool keychain profile:

   ```sh
   xcrun notarytool store-credentials AC_PASSWORD \
     --apple-id <apple-id-email> \
     --team-id Z7JS58F8U3 \
     --password <app-specific-password>
   ```

3. The release script reads this profile by name (`AC_PASSWORD`).

### Sparkle EdDSA keys

A key pair signs appcast entries. Sparkle's `generate_keys` tool ships with the Sparkle
Swift package; after building Gmac once, it is located at:

```
~/Library/Developer/Xcode/DerivedData/Gmac-*/SourcePackages/artifacts/sparkle/Sparkle/bin/generate_keys
```

Run it once. The private key is stored in the login keychain. The public key is printed to
standard output and is already committed in `Gmac/Info.plist` under `SUPublicEDKey`.
Regenerating the keys invalidates the public key in every shipped application and requires a
new release.

## Credential continuity

Three secrets gate the release pipeline. Losing the Sparkle key is **unrecoverable** for
existing installations, because `SUPublicEDKey` is embedded in every shipped `Info.plist`;
a regenerated key permanently prevents installed copies from receiving updates. Maintain
current, restore-tested backups of all three.

| Secret | Location | Consequence if lost |
|---|---|---|
| Sparkle EdDSA private key | login keychain ("Private key for signing Sparkle updates") | Existing installations receive no further automatic updates |
| Developer ID Application identity | login keychain | Re-issue from the Apple Developer portal; releases are blocked until complete |
| notarytool app-specific password | appleid.apple.com, cached as keychain profile `AC_PASSWORD` | Regenerate at appleid.apple.com and rerun `store-credentials` |

### Backup procedure

1. Export the Sparkle private key. Keychain will prompt for access:

   ```sh
   SPARKLE_BIN=$(ls -dt ~/Library/Developer/Xcode/DerivedData/Gmac-*/SourcePackages/artifacts/sparkle/Sparkle/bin 2>/dev/null | head -1)
   "$SPARKLE_BIN/generate_keys" -x sparkle_ed25519_private.key
   ```

   If several `Gmac-*` DerivedData directories exist, this selects the most recently
   modified one.

2. Export the Developer ID identity: **Keychain Access → My Certificates**, right-click
   *Developer ID Application: …*, then **Export** as `.p12` with a strong password.

3. Encrypt both files before they leave the machine:

   ```sh
   age -p sparkle_ed25519_private.key > sparkle_ed25519_private.key.age   # or: gpg -c <file>
   age -p developer_id.p12 > developer_id.p12.age
   ```

   Neither `age` nor `gpg` ships with macOS. Install `age` with `brew install age`.

4. Store the encrypted files, together with the app-specific password, in **two**
   off-machine locations, for example a password-manager secure note and one offline
   medium. Delete the plaintext exports afterwards.

5. Record the certificate expiry date and set reminders at 60 and 14 days before it:

   ```sh
   security find-certificate -c "Developer ID Application" -p | openssl x509 -noout -enddate
   ```

   This prints the first matching certificate only. During a renewal window, when old and
   new certificates coexist in the keychain, inspect every match with
   `security find-certificate -a -c "Developer ID Application" -p`, where each
   `-----BEGIN` block is one certificate. Rerun this step after renewal so that the
   reminder tracks the new expiry date.

### Restore test

A backup that has never been restored from is unverified. `sign_update` can sign directly
from a key file, so the test does not modify the keychain:

```sh
"$SPARKLE_BIN/sign_update" --ed-key-file sparkle_ed25519_private.key build/release/Gmac-X.Y.Z.dmg
```

The printed `sparkle:edSignature` **and** the printed `length` must both match that
release's entry in `appcast.xml`. Ed25519 signatures are deterministic, so a mismatch in
either value indicates a wrong key or a non-canonical artifact: either the exported key is
incorrect, or the file signed is not the exact published artifact. If in doubt, download
the release asset from the appcast enclosure URL and sign that.

### Recovery on a new machine

1. Build Gmac once so that the Sparkle tools exist in DerivedData (see
   [Sparkle EdDSA keys](#sparkle-eddsa-keys)); `generate_keys` ships inside the Sparkle
   Swift package and is not on `PATH`. Declare `SPARKLE_BIN` in the fresh shell:

   ```sh
   SPARKLE_BIN=$(ls -dt ~/Library/Developer/Xcode/DerivedData/Gmac-*/SourcePackages/artifacts/sparkle/Sparkle/bin 2>/dev/null | head -1)
   ```

2. Decrypt the backup
   (`age -d sparkle_ed25519_private.key.age > sparkle_ed25519_private.key`, entering the
   backup passphrase), then import the Sparkle key:
   `"$SPARKLE_BIN/generate_keys" -f sparkle_ed25519_private.key`. If an item named
   *Private key for signing Sparkle updates* already exists in the login keychain, the
   import fails until that item is removed through Keychain Access. Delete the decrypted
   key once the import succeeds.
3. Open the `.p12` to install the Developer ID identity in the login keychain.
4. Recreate the notary profile with `xcrun notarytool store-credentials AC_PASSWORD …` (see
   One-time setup).

## Application update

`scripts/publish-update.sh <version>` performs the complete update procedure. It requires a
clean working tree, `gh` authenticated with push access, and the Sparkle key. The script:

1. Moves the changelog entries from `[Unreleased]` into a `[X.Y.Z]` section and uses them
   as the release notes.
2. Bumps `MARKETING_VERSION` to the new version and increments `CURRENT_PROJECT_VERSION`.
3. Builds and ad-hoc signs the application, archives it as
   `Gmac-X.Y.Z.zip`, and signs the archive with the Sparkle key.
4. Tags `app-vX.Y.Z`, pushes the branch and tag, and creates the GitHub release with the
   archive.
5. Adds the release to `appcast.xml` on `gh-pages`, which GitHub Pages serves.

```sh
scripts/publish-update.sh 4.0.1
```

The appcast is updated by the script. Do not edit `appcast.xml` on `gh-pages` or
`dist/pages/appcast.xml` by hand.

### Notarized disk image

`scripts/release.sh X.Y.Z` produces a Gatekeeper-compatible disk image for direct
distribution. The script:

1. Archives the application, using Apple Development signing during the archive; automatic
   provisioning handles certificate resolution.
2. Re-signs on export with the Developer ID Application certificate, per
   `scripts/exportOptions.plist`.
3. Verifies the signature with `codesign --verify --deep --strict`.
4. Builds a UDZO disk image with `hdiutil` and signs it with the Developer ID Application
   certificate.
5. Submits the image to Apple's notary service and waits for the verdict, typically 5 to 15
   minutes.
6. Staples the notarization ticket and verifies the result with `spctl --assess`.

The artifact is written to `build/release/Gmac-X.Y.Z.dmg`.

### Appcast entry format

For reference, an appcast item produced by `scripts/update-appcast.py` has the following
shape. The archive name, tag and URL match the output of `publish-update.sh`:

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

## Wine Libraries release

The runtime (`Libraries.tar.gz`) is **assembled from upstream binaries, not built from
source**. [`DEPENDENCIES.md`](DEPENDENCIES.md) lists the components, their pinned versions
and their origins. When the runtime must change:

1. **Assemble `Libraries.tar.gz`** from the pinned upstream binaries. The archive unpacks to
   the `Libraries/` tree the application expects, in which `Libraries/Wine/bin/` is the Wine
   binary directory per `GmacWineInstaller.binFolder`. To reproduce a build:
   - Download the pinned **Wine** build (Gcenx `macOS_Wine_builds`) and unpack it as
     `Libraries/Wine/`.
   - Add the pinned **DXVK-macOS** DLLs and the **DXMT** prebuilt release in the Gcenx
     layout.
   - Place **D3DMetal** as extracted from Apple's Game Porting Toolkit. Redistribution is
     governed by Apple's GPTK license; confirm the terms before publishing.
   - Record the exact versions used in `docs/DEPENDENCIES.md` and update the matching
     `*_PINNED` tags in `.github/workflows/RuntimeTrack.yml` so that drift detection remains
     accurate.
   - Create the archive with `tar -czf Libraries.tar.gz Libraries/`, observing the `Tar`
     pipe-drain constraint described under Pitfalls.
2. Tag with the bare version `vX.Y.Z`, without the `app-` prefix.
3. Publish it: `gh release create vX.Y.Z --title "Wine Libraries vX.Y.Z" Libraries.tar.gz`.
4. Compute the SHA-256 of the **exact published asset**. The application verifies the
   download against this value and fails closed on a mismatch, so an incorrect value blocks
   every fresh installation:

   ```sh
   shasum -a 256 Libraries.tar.gz
   ```

5. Update `dist/pages/WhiskyWineVersion.plist` with the version, the bundled DXVK version
   and the digest from the previous step. Record the same digest in
   [`DEPENDENCIES.md`](DEPENDENCIES.md):

   ```xml
   <dict>
       <key>version</key>
       <dict>
           <key>major</key><integer>X</integer>
           <key>minor</key><integer>Y</integer>
           <key>patch</key><integer>Z</integer>
       </dict>
       <key>dxvkVersion</key>
       <string>1.10.3</string>
       <key>sha256</key>
       <string>…64-hex-digest…</string>
   </dict>
   ```

6. Commit and push the change on a branch and open a pull request. Once merged, existing
   installations prompt for the update on their next version check.

## URLs the application depends on

- `https://rolling7ho.github.io/gmac/appcast.xml`: Sparkle update feed (`SUFeedURL`).
- `https://github.com/rolling7ho/gmac/releases/download/v<tag>/Libraries.tar.gz`: Wine
  runtime archive for the pinned `gamingRuntime` tag in `DistributionConfig.swift`.
- `https://github.com/rolling7ho/gmac/releases/download/app-vX.Y.Z/Gmac-X.Y.Z.zip`:
  application update archive.

## Pitfalls

- **Do not override `CODE_SIGN_IDENTITY` at archive time.** The project is configured for
  Apple Development with automatic signing, and overriding it conflicts with provisioning.
  The release script lets `xcodebuild archive` use the project default and re-signs on
  export.
- **Do not bundle the GmacKit folder as a resource.** Doing so packages the package's
  `.build` directory, including DocC plugin executables, into the application, and Apple's
  notary rejects the archive because those executables lack the hardened runtime. The
  `PBXResourcesBuildPhase` entry for `GmacKit` was removed from the project for this
  reason and must not be restored. The `PBXFileReference` and `PBXGroup` entries must
  remain, or Xcode's Swift package integration crashes on CI.
- **Pipe deadlocks in `Tar`.** `process.waitUntilExit()` must be called after the pipe is
  drained, not before. The verbose tar listing for a multi-hundred-megabyte archive
  overflows the operating system's pipe buffer.
