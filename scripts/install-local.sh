#!/bin/bash
# Builds Gmac, signs it ad hoc and installs it to /Applications.
#
# Signed ad hoc, without the hardened runtime: its library validation only loads
# libraries signed by the app's team, and ad-hoc code has none, so Sparkle would
# never load. Nested code is re-signed so the bundle's signature verifies.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DERIVED="${DERIVED:-$ROOT/.build}"
DEST="${DEST:-/Applications/Gmac.app}"

LOG="$(mktemp -t gmac-build.XXXXXX)"
ENTITLEMENTS=""
cleanup() {
    [ -n "$ENTITLEMENTS" ] && rm -f "$ENTITLEMENTS"
}
trap cleanup EXIT
if ! xcodebuild -project "$ROOT/Gmac.xcodeproj" -scheme Gmac -configuration Release \
    -derivedDataPath "$DERIVED" CODE_SIGN_IDENTITY="-" CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM="" \
    build > "$LOG" 2>&1; then
    grep -E ' error:' "$LOG" | sort -u >&2
    echo "Build failed; full log: $LOG" >&2
    exit 1
fi
rm -f "$LOG"

APP="$DERIVED/Build/Products/Release/Gmac.app"
[ -d "$APP" ] || { echo "build failed" >&2; exit 1; }

# Gmac's DirectX 12 layer, staged by scripts/build-gmac-d3d12.sh. Without it
# the games that would use it run on D3DMetal.
D3D12="${GMAC_D3D12:-$ROOT/build/gmac-d3d12}"
if [ -f "$D3D12/unix/gmacmetal.so" ]; then
    rm -rf "$APP/Contents/Resources/GmacD3D12"
    ditto "$D3D12" "$APP/Contents/Resources/GmacD3D12"
    codesign --force --sign - "$APP/Contents/Resources/GmacD3D12/unix/gmacmetal.so"
else
    echo "warning: no $D3D12; building without Gmac's DirectX 12 layer" >&2
fi

ENTITLEMENTS="$(mktemp -t gmac-entitlements.XXXXXX)"
codesign -d --entitlements - --xml "$APP" > "$ENTITLEMENTS"

find "$APP/Contents/Frameworks" -maxdepth 1 -name '*.framework' -print0 |
    xargs -0 -I{} codesign --force --deep --sign - {}
find "$APP/Contents/PlugIns" -maxdepth 1 -name '*.appex' -print0 |
    xargs -0 -I{} codesign --force --sign - --preserve-metadata=entitlements {}
codesign --force --sign - --entitlements "$ENTITLEMENTS" "$APP"

# scripts/publish-update.sh only wants the signed build.
if [ "${INSTALL:-1}" = 0 ]; then
    echo "$APP"
    exit 0
fi

# Not a normal quit: that asks, then stops Steam and every game.
pkill -x Gmac 2>/dev/null && sleep 1 || true
rm -rf "$DEST"
ditto "$APP" "$DEST"
codesign --verify --deep --strict "$DEST" && echo "Installed $DEST"
