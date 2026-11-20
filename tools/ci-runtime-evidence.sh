#!/usr/bin/env bash
# Build the signed release APK, install it on the emulator, and prove the
# shipped app renders its real UI: launch, screenshot, and require the violet
# primary button (#5f3dc4 - the only solid-violet element on the page,
# button.primary in web/index.html) on screen. Also prove from the built APK
# bytes that the manifest requests no permissions. The production app carries
# no test hooks or automation extras. Invoked as one line from the emulator
# CI step: android-emulator-runner runs each script line in its own shell, so
# all state must live inside this file.
set -euo pipefail
cd "$GITHUB_WORKSPACE"
echo "$SIGNING_KEYSTORE_B64" | base64 -d > "$RUNNER_TEMP/keystore.jks"
export SIGNING_KEYSTORE_PATH="$RUNNER_TEMP/keystore.jks"
gradle -p android :app:assembleRelease
unset SIGNING_KEYSTORE_PATH
APK=$(ls android/app/build/outputs/apk/release/*.apk | head -1)
echo "release APK: $APK"
# Shipped bytes must request zero permissions.
if aapt dump permissions "$APK" | grep -q 'uses-permission'; then
  echo "ERROR: release APK requests permissions:"
  aapt dump permissions "$APK"
  exit 1
fi
echo "permission check: no permissions requested"
adb install -r "$APK"
adb shell am start -n com.vanipy.sambung/.MainActivity
sleep 8  # let the bundled page finish loading
pip install pillow==12.3.0 --quiet
adb exec-out screencap -p > "$RUNNER_TEMP/sambung-runtime-1.png"
sleep 2
adb exec-out screencap -p > "$RUNNER_TEMP/sambung-runtime-2.png"
python3 - "$RUNNER_TEMP/sambung-runtime-1.png" <<'PY'
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
w, h = im.size
px = im.load()
hits = 0
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        if abs(r - 95) <= 2 and abs(g - 61) <= 2 and abs(b - 196) <= 2:
            hits += 1
if hits < 50:
    sys.exit("ERROR: violet primary button (#5f3dc4) not found on screen (%d px); the page did not render as expected" % hits)
print("runtime evidence: violet primary button present (%d px)" % hits)
PY
adb uninstall com.vanipy.sambung
