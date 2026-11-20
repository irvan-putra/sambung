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
# Shipped bytes must request zero permissions. aapt lives in the SDK
# build-tools, not on PATH; a missing aapt must fail the check, never pass it.
AAPT=$(ls "$ANDROID_HOME"/build-tools/*/aapt 2>/dev/null | sort -V | tail -1)
if [ -z "$AAPT" ]; then
  echo "ERROR: aapt not found under $ANDROID_HOME/build-tools"
  exit 1
fi
if "$AAPT" dump permissions "$APK" | grep -q 'uses-permission'; then
  echo "ERROR: release APK requests permissions:"
  "$AAPT" dump permissions "$APK"
  exit 1
fi
echo "permission check: no permissions requested"
adb install -r "$APK"
adb shell am start -n com.vanipy.sambung/.MainActivity
sleep 8  # let the bundled page finish loading
pip install pillow==12.3.0 --quiet
# The violet primary button sits below the fold on small emulator screens,
# so scroll the page and screenshot along the way; any hit proves the render.
SHOTS=("$RUNNER_TEMP/sambung-runtime-1.png" "$RUNNER_TEMP/sambung-runtime-2.png" "$RUNNER_TEMP/sambung-runtime-3.png")
adb exec-out screencap -p > "${SHOTS[0]}"
for i in 1 2; do
  adb shell input swipe 160 520 160 160 300
  sleep 1
  adb exec-out screencap -p > "${SHOTS[$i]}"
done
python3 - "${SHOTS[@]}" <<'PY'
import sys
from PIL import Image
best = 0
for path in sys.argv[1:]:
    im = Image.open(path).convert('RGB')
    w, h = im.size
    px = im.load()
    hits = 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if abs(r - 95) <= 2 and abs(g - 61) <= 2 and abs(b - 196) <= 2:
                hits += 1
    best = max(best, hits)
    if hits >= 50:
        print("runtime evidence: violet primary button present (%d px)" % hits)
        sys.exit(0)
sys.exit("ERROR: violet primary button (#5f3dc4) not found on screen (best %d px); the page did not render as expected" % best)
PY
adb uninstall com.vanipy.sambung
