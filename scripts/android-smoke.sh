#!/usr/bin/env bash
# Smoke test on a running emulator: install, launch, switch tab, check the Back button.
# Usage: scripts/android-smoke.sh <apk> <outdir>
set -euo pipefail
APK="$1"; OUT="$2"; PKG=io.github.jehbyte.peptidelog
mkdir -p "$OUT"
fail() { echo "SMOKE FAIL: $*"; adb logcat -d > "$OUT/logcat.txt" || true; exit 1; }
shot() { adb exec-out screencap -p > "$OUT/$1.png"; }
focused() { adb shell dumpsys window | grep -E 'mCurrentFocus|mFocusedApp' | grep -q "$PKG"; }
# Tap the centre of the first on-screen element whose text or content-desc is $1.
tap_text() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null
  adb pull /sdcard/ui.xml "$OUT/ui-$1.xml" >/dev/null
  b=$(grep -oE "(text|content-desc)=\"$1\"[^>]*bounds=\"\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]\"" "$OUT/ui-$1.xml" | head -1 | grep -oE '[0-9]+' | tail -4 | tr '\n' ' ')
  [ -n "$b" ] || return 1
  read -r x1 y1 x2 y2 <<<"$b"
  adb shell input tap $(( (x1 + x2) / 2 )) $(( (y1 + y2) / 2 ))
}

adb install -r "$APK"
adb shell dumpsys package "$PKG" | grep -E 'versionCode|versionName'
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 20
shot 1-launch
adb shell pidof "$PKG" >/dev/null || fail "app is not running after launch"
focused || fail "app is not in the foreground after launch"

# WebView content only shows up in the UI dump when an accessibility service is on, so fall back to
# tapping the middle tab by position: the tab bar sits at the bottom of the WebView, ~64 CSS px tall.
tap_middle_tab() {
  b=$(grep -oE 'class="android.webkit.WebView"[^>]*bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' "$OUT/ui-History.xml" | head -1 | grep -oE '[0-9]+' | tail -4 | tr '\n' ' ')
  [ -n "$b" ] || return 1
  read -r x1 y1 x2 y2 <<<"$b"
  dpi=$(adb shell wm density | grep -oE '[0-9]+' | tail -1)
  adb shell input tap $(( (x1 + x2) / 2 )) $(( y2 - 32 * dpi / 160 ))
}
tap_text "History" || tap_middle_tab || fail "could not find the History tab on screen"
sleep 3
shot 2-history

adb shell input keyevent KEYCODE_BACK
sleep 3
shot 3-after-back
focused || fail "Back from History closed the app instead of returning to Log"

adb shell input keyevent KEYCODE_BACK
sleep 3
focused && fail "Back from Log should leave the app"

adb logcat -d > "$OUT/logcat.txt"
if grep -E 'E Capacitor/Console|E/Capacitor/Console|Uncaught' "$OUT/logcat.txt"; then fail "JavaScript errors in logcat"; fi
echo "SMOKE PASS"
