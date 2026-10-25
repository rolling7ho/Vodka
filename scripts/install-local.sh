#!/bin/bash
# Builds Vodka, signs it ad hoc and installs it to /Applications.
#
# Signed ad hoc, without the hardened runtime: its library validation only loads
# libraries signed by the app's team, and ad-hoc code has none, so Sparkle would
# never load. Nested code is re-signed so the bundle's signature verifies.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DERIVED="${DERIVED:-$ROOT/../build}"
DEST="${DEST:-/Applications/Vodka.app}"

LOG="$(mktemp -t vodka-build).log"
if ! xcodebuild -project "$ROOT/Vodka.xcodeproj" -scheme Vodka -configuration Release \
    -derivedDataPath "$DERIVED" CODE_SIGN_IDENTITY="-" CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM="" \
    build > "$LOG" 2>&1; then
    grep -E ' error:' "$LOG" | sort -u >&2
    echo "Build failed; full log: $LOG" >&2
    exit 1
fi

APP="$DERIVED/Build/Products/Release/Vodka.app"
[ -d "$APP" ] || { echo "build failed" >&2; exit 1; }

ENTITLEMENTS="$(mktemp -t vodka-entitlements).plist"
codesign -d --entitlements - --xml "$APP" > "$ENTITLEMENTS"

find "$APP/Contents/Frameworks" -maxdepth 1 -name '*.framework' -print0 |
    xargs -0 -I{} codesign --force --deep --sign - {}
find "$APP/Contents/PlugIns" -maxdepth 1 -name '*.appex' -print0 |
    xargs -0 -I{} codesign --force --sign - --preserve-metadata=entitlements {}
codesign --force --sign - --entitlements "$ENTITLEMENTS" "$APP"
rm -f "$ENTITLEMENTS"

osascript -e 'quit app id "com.rolling7ho.Vodka"' 2>/dev/null || true
rm -rf "$DEST"
ditto "$APP" "$DEST"
codesign --verify --deep --strict "$DEST" && echo "Installed $DEST"
