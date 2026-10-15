#!/usr/bin/env bash
# Generates the Android project from the web files. Run from the repo root after `npm ci`/`npm install`.
# Usage: scripts/android-prepare.sh <versionCode>
set -euo pipefail
VC="${1:?versionCode}"
BG='#0f766e'

# Only the app files go into the APK.
rm -rf www android
mkdir -p www
cp index.html styles.css seed.js db.js app.js sw.js manifest.webmanifest www/
cp -r icons www/

npx cap add android
npx cap sync android

# versionCode must go up on every build so Android accepts the APK as an update.
sed -i -E "s/versionCode [0-9]+/versionCode $VC/; s/versionName \"[^\"]*\"/versionName \"1.0.$VC\"/" android/app/build.gradle
grep -E 'versionCode|versionName' android/app/build.gradle

# Launcher icons: legacy square/round icons plus the adaptive-icon foreground (108dp canvas,
# artwork scaled to 80% so the vial stays inside every launcher mask).
RES=android/app/src/main/res
for spec in mdpi:48:108 hdpi:72:162 xhdpi:96:216 xxhdpi:144:324 xxxhdpi:192:432; do
  IFS=: read -r dpi px fg <<<"$spec"
  convert icons/icon-512.png -resize "${px}x${px}" "$RES/mipmap-$dpi/ic_launcher.png"
  convert icons/icon-512.png -resize "${px}x${px}" \( -size "${px}x${px}" xc:none -fill white -draw "circle $((px/2)),$((px/2)) $((px/2)),0" \) -compose DstIn -composite "$RES/mipmap-$dpi/ic_launcher_round.png"
  convert icons/icon-512.png -resize "$((fg*80/100))x$((fg*80/100))" -background "$BG" -gravity center -extent "${fg}x${fg}" "$RES/mipmap-$dpi/ic_launcher_foreground.png"
done
cat > "$RES/values/ic_launcher_background.xml" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">$BG</color>
</resources>
EOF

# Splash screens: replace the Capacitor logo with the app icon on the brand colour.
find "$RES" -name 'splash.png' | while read -r f; do
  read -r w h < <(identify -format '%w %h\n' "$f")
  s=$(( (w < h ? w : h) * 35 / 100 ))
  convert -size "${w}x${h}" "xc:$BG" \( icons/icon-512.png -resize "${s}x${s}" \) -gravity center -composite "$f"
done
