#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$REPO_ROOT/build"
APP_BUNDLE="$BUILD_DIR/Gmac.app"
INSTALL_APP=0

for arg in "$@"; do
    case "$arg" in
        --install)
            INSTALL_APP=1
            ;;
        *)
            echo "Unknown argument: $arg" >&2
            echo "Usage: $0 [--install]" >&2
            exit 1
            ;;
    esac
done

echo "==> Building GmacBridge (SwiftPM release)..."
swift build -c release --package-path "$REPO_ROOT/GmacKit" --product gmac-bridge

echo "==> Building Gmac GPUI binary (Cargo release)..."
cargo build --release --manifest-path "$REPO_ROOT/gmac-gpui/Cargo.toml"

BRIDGE_BIN="$REPO_ROOT/GmacKit/.build/release/gmac-bridge"
GMAC_BIN="$REPO_ROOT/gmac-gpui/target/release/gmac"
GMACKIT_BUNDLE="$REPO_ROOT/GmacKit/.build/release/GmacKit_GmacKit.bundle"
ICON_PNG="$REPO_ROOT/images/gmac-icon.png"

if [[ ! -x "$BRIDGE_BIN" ]]; then
    echo "error: missing bridge binary at $BRIDGE_BIN" >&2
    exit 1
fi
if [[ ! -x "$GMAC_BIN" ]]; then
    echo "error: missing GPUI binary at $GMAC_BIN" >&2
    exit 1
fi

echo "==> Assembling $APP_BUNDLE..."
rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS" "$APP_BUNDLE/Contents/Helpers" "$APP_BUNDLE/Contents/Resources"

cp -f "$GMAC_BIN" "$APP_BUNDLE/Contents/MacOS/Gmac"
chmod 755 "$APP_BUNDLE/Contents/MacOS/Gmac"

cp -f "$BRIDGE_BIN" "$APP_BUNDLE/Contents/Helpers/gmac-bridge"
chmod 755 "$APP_BUNDLE/Contents/Helpers/gmac-bridge"

if [[ -d "$GMACKIT_BUNDLE" ]]; then
    cp -R "$GMACKIT_BUNDLE" "$APP_BUNDLE/Contents/Helpers/"
fi

if [[ -d "$BUILD_DIR/gmac-d3d12" ]]; then
    mkdir -p "$APP_BUNDLE/Contents/Resources/GmacD3D12"
    cp -R "$BUILD_DIR/gmac-d3d12/." "$APP_BUNDLE/Contents/Resources/GmacD3D12/"
fi

if [[ -f "$ICON_PNG" ]]; then
    ICONSET_DIR="$(mktemp -d "${TMPDIR:-/tmp}/gmac-iconset.XXXXXX.iconset")"
    sips -z 16 16     "$ICON_PNG" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
    sips -z 32 32     "$ICON_PNG" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
    sips -z 32 32     "$ICON_PNG" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
    sips -z 64 64     "$ICON_PNG" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
    sips -z 128 128   "$ICON_PNG" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
    sips -z 256 256   "$ICON_PNG" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
    sips -z 256 256   "$ICON_PNG" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
    sips -z 512 512   "$ICON_PNG" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
    sips -z 512 512   "$ICON_PNG" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null
    cp -f "$ICON_PNG" "$ICONSET_DIR/icon_512x512@2x.png"
    iconutil -c icns "$ICONSET_DIR" -o "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
    rm -rf "$ICONSET_DIR"
fi

cat > "$APP_BUNDLE/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>en</string>
	<key>CFBundleExecutable</key>
	<string>Gmac</string>
	<key>CFBundleIconFile</key>
	<string>AppIcon</string>
	<key>CFBundleIdentifier</key>
	<string>com.rolling7ho.Gmac</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>Gmac</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleShortVersionString</key>
	<string>0.2.0</string>
	<key>CFBundleVersion</key>
	<string>1</string>
	<key>LSMinimumSystemVersion</key>
	<string>14.0</string>
	<key>NSHighResolutionCapable</key>
	<true/>
	<key>NSPrincipalClass</key>
	<string>NSApplication</string>
	<key>NSDesktopFolderUsageDescription</key>
	<string>Gmac needs access to Desktop to create shortcuts for Windows programs.</string>
	<key>NSDocumentsFolderUsageDescription</key>
	<string>Gmac needs access to this folder to manage Wine bottles and install Windows dependencies.</string>
	<key>NSNetworkVolumesUsageDescription</key>
	<string>Gmac needs access to network volumes when bottles are stored on network drives.</string>
	<key>NSRemovableVolumesUsageDescription</key>
	<string>Gmac needs access to removable volumes when bottles are stored on external drives.</string>
	<key>CFBundleURLTypes</key>
	<array>
		<dict>
			<key>CFBundleURLName</key>
			<string>com.rolling7ho.Gmac</string>
			<key>CFBundleURLSchemes</key>
			<array>
				<string>gmac</string>
			</array>
		</dict>
	</array>
	<key>CFBundleDocumentTypes</key>
	<array>
		<dict>
			<key>CFBundleTypeName</key>
			<string>Microsoft Executable</string>
			<key>CFBundleTypeRole</key>
			<string>Editor</string>
			<key>LSHandlerRank</key>
			<string>Owner</string>
			<key>LSItemContentTypes</key>
			<array>
				<string>com.microsoft.windows-executable</string>
			</array>
		</dict>
		<dict>
			<key>CFBundleTypeName</key>
			<string>Microsoft MSI Installer</string>
			<key>CFBundleTypeRole</key>
			<string>Editor</string>
			<key>LSHandlerRank</key>
			<string>Owner</string>
			<key>LSItemContentTypes</key>
			<array>
				<string>com.microsoft.msi-installer</string>
			</array>
		</dict>
	</array>
</dict>
</plist>
PLIST

echo "==> Ad-hoc signing $APP_BUNDLE..."
codesign --force --sign - "$APP_BUNDLE/Contents/Helpers/gmac-bridge"
codesign --force --deep --sign - "$APP_BUNDLE"
codesign --verify --deep --strict "$APP_BUNDLE"

if [[ "$INSTALL_APP" -eq 1 ]]; then
    echo "==> Installing to /Applications/Gmac.app..."
    rm -rf "/Applications/Gmac.app"
    ditto "$APP_BUNDLE" "/Applications/Gmac.app"
fi

echo "==> Done: $APP_BUNDLE"
