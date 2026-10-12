#!/usr/bin/env bash
# Applies the farm-specific changes to the Android project that `npx cap add android` generates.
set -euo pipefail
cd "$(dirname "$0")/.."

PKG_DIR=android/app/src/main/java/tech/holderness/piginspection
MANIFEST=android/app/src/main/AndroidManifest.xml
GRADLE=android/app/build.gradle
BUILD_NO="${GITHUB_RUN_NUMBER:-1}"

mkdir -p "$PKG_DIR"
cp android-custom/MainActivity.java "$PKG_DIR/MainActivity.java"
cp android-custom/FarmPlugin.java "$PKG_DIR/FarmPlugin.java"

# Allow plain HTTP for a NAS on the local network (the normal route is HTTPS) and ask for location.
if ! grep -q usesCleartextTraffic "$MANIFEST"; then
  sed -i 's/<application/<application android:usesCleartextTraffic="true"/' "$MANIFEST"
fi
if ! grep -q ACCESS_FINE_LOCATION "$MANIFEST"; then
  sed -i 's#</manifest>#    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\n    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />\n</manifest>#' "$MANIFEST"
fi

# Version number goes up with every build so phones accept the update.
sed -i -E "s/versionCode [0-9]+/versionCode ${BUILD_NO}/" "$GRADLE"
sed -i -E "s/versionName \"[^\"]*\"/versionName \"2.0.${BUILD_NO}\"/" "$GRADLE"

# Same signing key for every build, so new versions install over old ones without losing data.
# OkHttp handles the WebDAV requests (PROPFIND, MKCOL) that Android's built-in HTTP can't send.
cat >> "$GRADLE" <<'EOF'

android {
    signingConfigs {
        debug {
            storeFile file('../../keystore/debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
}

dependencies {
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
}
EOF

# App icon (if the icon generator has produced one)
if [ -d android-custom/res ]; then
  cp -r android-custom/res/. android/app/src/main/res/
fi

echo "Android customisations applied (build ${BUILD_NO})."
