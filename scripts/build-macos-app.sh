#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PROJECT_DIR="${SCRIPT_DIR:h}"
APP_NAME="Depthline.app"
RELEASE_DIR="$PROJECT_DIR/release"
FINAL_APP="$RELEASE_DIR/$APP_NAME"
FINAL_ZIP="$RELEASE_DIR/Depthline-mac-arm64.zip"
STAGING_DIR="$(mktemp -d)"
STAGING_APP="$STAGING_DIR/$APP_NAME"
NODE_BIN="$(node -p 'process.execPath')"

cleanup() {
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

cd "$PROJECT_DIR"
npm run build

mkdir -p "$STAGING_APP/Contents/MacOS" "$STAGING_APP/Contents/Resources"
/usr/bin/clang \
  -fobjc-arc \
  -fmodules-cache-path="$STAGING_DIR/module-cache" \
  -framework Cocoa \
  "$PROJECT_DIR/macos/DepthlineLauncher.m" \
  -o "$STAGING_APP/Contents/MacOS/Depthline"

cp "$PROJECT_DIR/macos/Info.plist" "$STAGING_APP/Contents/Info.plist"
cp "$NODE_BIN" "$STAGING_APP/Contents/Resources/node"
cp -R "$PROJECT_DIR/dist" "$STAGING_APP/Contents/Resources/dist"
chmod +x "$STAGING_APP/Contents/MacOS/Depthline" "$STAGING_APP/Contents/Resources/node"
/usr/bin/codesign --force --deep --sign - "$STAGING_APP"

mkdir -p "$RELEASE_DIR"
rm -rf "$FINAL_APP"
rm -f "$FINAL_ZIP"
mv "$STAGING_APP" "$FINAL_APP"
/usr/bin/ditto -c -k --keepParent "$FINAL_APP" "$FINAL_ZIP"

echo "Built: $FINAL_APP"
echo "Archive: $FINAL_ZIP"
