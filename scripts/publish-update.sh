#!/bin/bash
# Publishes a Gmac update that installed copies pick up through Sparkle.
#
# Usage: scripts/publish-update.sh <version>        e.g. scripts/publish-update.sh 4.0.1
#
# 1. Turns CHANGELOG.md's [Unreleased] section into <version> and uses it as the notes.
# 2. Bumps MARKETING_VERSION to <version> and CURRENT_PROJECT_VERSION by one, and commits.
# 3. Builds and signs ad hoc (scripts/install-local.sh), zips the app and signs the zip
#    with the Sparkle key in the login keychain (account "gmac", made by generate_keys).
# 4. Pushes the branch and tag app-v<version>, and creates the GitHub release with the zip.
# 5. Adds the update to appcast.xml on the gh-pages branch, which GitHub Pages serves at
#    https://rolling7ho.github.io/gmac/appcast.xml (Info.plist's SUFeedURL).
#
# Needs: a clean working tree, gh signed in with push access, and the Sparkle key
# (~/.gmac-sparkle-private-key, or the login keychain's "gmac" account).
# Back the key up (generate_keys --account gmac -x <file>): without it, installed
# copies can never accept another update.

set -euo pipefail

VERSION="${1:?usage: scripts/publish-update.sh <version>}"
[[ "$VERSION" =~ ^[0-9]+(\.[0-9]+)+$ ]] || { echo "Version must be numeric dot-separated (for example 4.0.1)." >&2; exit 1; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DERIVED="${DERIVED:-$ROOT/.build}"
REPO="rolling7ho/gmac"
TAG="app-v$VERSION"
PBXPROJ="$ROOT/Gmac.xcodeproj/project.pbxproj"
cd "$ROOT"

NOTES=""
OUT=""
PAGES=""
cleanup() {
    if [ -n "$PAGES" ] && [ -d "$PAGES" ]; then
        git worktree remove --force "$PAGES" 2>/dev/null || true
    fi
    [ -n "$NOTES" ] && rm -f "$NOTES"
    [ -n "$OUT" ] && rm -rf "$OUT"
}
trap cleanup EXIT

[ -z "$(git status --porcelain)" ] || { echo "Commit or stash your changes first." >&2; exit 1; }
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null && { echo "$TAG already exists." >&2; exit 1; }
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

BUILD=$(( $(grep -m1 -o 'CURRENT_PROJECT_VERSION = [0-9]*' "$PBXPROJ" | grep -o '[0-9]*$') + 1 ))
NOTES="$(mktemp -t gmac-notes.XXXXXX)"
python3 "$ROOT/scripts/update-appcast.py" changelog "$ROOT/CHANGELOG.md" "$VERSION" "$NOTES"
sed -i '' -E "s/MARKETING_VERSION = [0-9.]+;/MARKETING_VERSION = $VERSION;/; s/CURRENT_PROJECT_VERSION = [0-9]+;/CURRENT_PROJECT_VERSION = $BUILD;/" "$PBXPROJ"
git commit -q -am "Gmac $VERSION"
echo "==> Gmac $VERSION (build $BUILD)"

APP="$(INSTALL=0 DERIVED="$DERIVED" "$ROOT/scripts/install-local.sh" | tail -1)"
[ "$(defaults read "$APP/Contents/Info.plist" CFBundleVersion)" = "$BUILD" ] ||
    { echo "Built app is not build $BUILD." >&2; exit 1; }

OUT="$(mktemp -d -t gmac-release)"
ZIP="$OUT/Gmac-$VERSION.zip"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"
SIGN_UPDATE="$DERIVED/SourcePackages/artifacts/sparkle/Sparkle/bin/sign_update"
# The key file, when there is one: reading the keychain from a sign_update other
# than the one that made the key waits on an access prompt that is easy to miss.
KEY_FILE="${SPARKLE_KEY_FILE:-$HOME/.gmac-sparkle-private-key}"
if [ -f "$KEY_FILE" ]; then
    SIGNATURE="$("$SIGN_UPDATE" -f "$KEY_FILE" -p "$ZIP")"
else
    SIGNATURE="$("$SIGN_UPDATE" --account gmac -p "$ZIP")"
fi
LENGTH="$(stat -f %z "$ZIP")"

git tag "$TAG"
git push -q origin "$BRANCH" "$TAG"
gh release create "$TAG" "$ZIP" --repo "$REPO" --target "$BRANCH" \
    --title "Gmac $VERSION" --notes-file "$NOTES"

PAGES="$OUT/pages"
git fetch -q origin gh-pages
git worktree add -q "$PAGES" origin/gh-pages
python3 "$ROOT/scripts/update-appcast.py" appcast "$PAGES/appcast.xml" "$VERSION" "$BUILD" \
    "https://github.com/$REPO/releases/download/$TAG/Gmac-$VERSION.zip" "$SIGNATURE" "$LENGTH" "$NOTES"
git -C "$PAGES" add appcast.xml
git -C "$PAGES" commit -q -m "Gmac $VERSION"
git -C "$PAGES" push -q origin HEAD:gh-pages
git worktree remove "$PAGES"

echo "==> Published Gmac $VERSION: https://github.com/$REPO/releases/tag/$TAG"
echo "    Pages takes a minute or two to serve the new appcast."
