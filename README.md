# Peptide Log (step 1: core log)

Offline peptide dose log for Android. Data stays on the phone in IndexedDB (`db.js` documents the data model). Ships two ways: an Android APK, and an installable web app (PWA) for Chrome.

Files: `index.html`, `styles.css`, `seed.js` (starting peptides and bac water), `db.js`, `app.js` (log, history list, peptides, settings, import), `vials.js` (vial tracker and Log-screen warnings), `feel.js` (Today and How I feel), `history-views.js` (History calendar and progress charts), `sw.js` (offline cache, web only), `manifest.webmanifest`, `icons/`. New script files must also be added to `sw.js` and `scripts/android-prepare.sh`. Android packaging: `package.json`, `capacitor.config.json`, `scripts/`, `.github/workflows/android.yml`.

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

## Vials and How I feel (v1.2)
- **Vials:** Peptides > a peptide > Mix a new vial (amount, optional bac water, date mixed). Every dose of that peptide from the mix date on comes out of it. A dose counts by its mcg/mg amount, or by volume when the bac water amount is known. "About N doses" uses the median of the last 5 doses. The Log screen warns at 3 doses or fewer, under one dose ("probably empty"), or 28+ days since mixing.
- **How I feel:** one check-in per day (`checkins` store) under Today on the Log screen; ‹ › moves between days. Saves on every tap and 0.6 s after typing.
- **History:** List, Calendar (doses per day and mood) and Progress (weight with Reta days marked, sleep/energy/mood, table view). "Reta" is any peptide whose name contains "reta".

## Later steps
3 schedules + reminders (`schedules` store, `entries.scheduleId`, `entries.status`), 4 CSV + backup export.
