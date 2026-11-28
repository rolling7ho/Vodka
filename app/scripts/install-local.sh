#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_DIR/.." && pwd)"
DEST_APP="${GMAC_INSTALL_PATH:-/Applications/Gmac.app}"
TMP_APP="$(mktemp -d /tmp/gmac-package.XXXXXX)/Gmac.app"

cleanup() {
  rm -rf "$(dirname "$TMP_APP")"
}
trap cleanup EXIT

echo "Building release GmacBridge..."
swift build -c release --package-path "$REPO_ROOT/GmacKit" --product gmac-bridge

echo "Building Electron bundle..."
cd "$APP_DIR"
npm run typecheck
npm run build

if [ ! -d "$APP_DIR/node_modules/electron/dist/Electron.app" ]; then
  echo "Electron.app not found under node_modules/electron/dist/" >&2
  exit 1
fi

echo "Assembling Gmac.app..."
cp -R "$APP_DIR/node_modules/electron/dist/Electron.app" "$TMP_APP"
rm -f "$TMP_APP/Contents/Resources/default_app.asar"

mkdir -p "$TMP_APP/Contents/Resources/app"
cp -R "$APP_DIR/out" "$TMP_APP/Contents/Resources/app/out"
cp "$APP_DIR/package.json" "$TMP_APP/Contents/Resources/app/package.json"
cp -R "$APP_DIR/resources" "$TMP_APP/Contents/Resources/app/resources"

cp "$APP_DIR/resources/icon.icns" "$TMP_APP/Contents/Resources/icon.icns"
cp "$APP_DIR/resources/icon.png" "$TMP_APP/Contents/Resources/icon.png"
rm -f "$TMP_APP/Contents/Resources/electron.icns"

BRIDGE_BIN="$(find "$REPO_ROOT/GmacKit/.build" -path "*release*/gmac-bridge" -type f -perm +111 | head -n 1)"
if [ -z "$BRIDGE_BIN" ]; then
  BRIDGE_BIN="$REPO_ROOT/GmacKit/.build/release/gmac-bridge"
fi
cp "$BRIDGE_BIN" "$TMP_APP/Contents/Resources/gmac-bridge"
chmod +x "$TMP_APP/Contents/Resources/gmac-bridge"

mv "$TMP_APP/Contents/MacOS/Electron" "$TMP_APP/Contents/MacOS/Gmac"

PLIST="$TMP_APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable Gmac" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleName Gmac" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Gmac" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.rolling7ho.Gmac" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleIconFile icon.icns" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString 0.1.0" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion 1" "$PLIST"

echo "Ad-hoc signing $TMP_APP..."
codesign --force --deep --sign - "$TMP_APP"

echo "Installing to $DEST_APP..."
rm -rf "$DEST_APP"
cp -R "$TMP_APP" "$DEST_APP"

echo "Installed $DEST_APP successfully."
