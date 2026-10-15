# Peptide Log (step 1: core log)

Offline peptide dose log for Android. Data stays on the phone in IndexedDB (`db.js` documents the data model). Ships two ways: an Android APK, and an installable web app (PWA) for Chrome.

Files: `index.html`, `styles.css`, `seed.js` (starting peptides and bac water), `db.js`, `app.js`, `sw.js` (offline cache, web only), `manifest.webmanifest`, `icons/`. Android packaging: `package.json`, `capacitor.config.json`, `scripts/`, `.github/workflows/android.yml`.

## Install on Android (APK)
On the phone, open **https://github.com/Jeh-byte/peptide-log/releases/latest/download/peptide-log.apk**. Chrome downloads it; tap the download, allow "Install unknown apps" for Chrome when asked, then tap Install.

To update, install the newer APK over the top. Your log is kept. Uninstalling the app deletes the log.

## How the APK is built
Every push to `main` runs `.github/workflows/android.yml`:
1. `scripts/android-prepare.sh` wraps the web files with Capacitor and sets the version (`1.0.<run number>`), launcher icon and splash screen.
2. Gradle builds the APK, which is signed with the release key.
3. `scripts/android-smoke.sh` installs it on an Android emulator, opens it, switches tab and checks the Back button. Screenshots are kept as the `smoke-test` artifact on the run.
4. If that passes, it is published as a GitHub release.

The signing key lives outside the repo (`C:\Users\jacqu\peptide-log-signing\`) and in two repository secrets, `ANDROID_KEYSTORE_B64` (the `.p12` file, base64) and `ANDROID_KEYSTORE_PASSWORD`. **Keep a backup of that folder.** Android only accepts an update signed with the same key, so losing it means users must uninstall (and lose their log) to install a new build.

## Web version
Needs HTTPS to install. Host on GitHub Pages: Settings > Pages > Deploy from branch `main` / root. The app lives at `https://jeh-byte.github.io/peptide-log/`.

When changing any app file, bump `VERSION` in `sw.js` so installed web apps pick up the update.

## Local test
`python3 -m http.server 8765` in this folder, open http://localhost:8765/.

## Import file (v1.1)
Settings > Choose import file. JSON: `{"format":"peptide-log-import","version":1,"entries":[{"peptide","dose","doseUnit","volume","volumeUnit","takenAt" (local, e.g. 2026-09-01T08:00),"site","notes"}]}`. Peptide names match loosely (case/punctuation ignored); unknown ones are created. Same peptide + minute + dose is skipped as a duplicate. A preview is shown before anything is saved.

## Later steps
2 vials + reconstitution math (`vials` store, `entries.vialId`), 3 schedules + reminders (`schedules` store, `entries.scheduleId`, `entries.status`), 4 CSV + backup export.
