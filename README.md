# Peptide Log (step 1: core log)

Offline installable web app (PWA) for Android Chrome. Data stays on the phone in IndexedDB (`db.js` documents the data model).

Files: `index.html`, `styles.css`, `seed.js` (starting peptides and bac water), `db.js`, `app.js`, `sw.js` (offline cache), `manifest.webmanifest`, `icons/`.

## Hosting
Needs HTTPS to install. Planned host: GitHub Pages. Put these files at the root of a GitHub repo, then Settings > Pages > Deploy from branch `main` / root. The app lives at `https://<user>.github.io/<repo>/`.

When changing any file, bump `VERSION` in `sw.js` so installed phones pick up the update.

## Local test
`python3 -m http.server 8765` in this folder, open http://localhost:8765/.

## Later steps
2 vials + reconstitution math (`vials` store, `entries.vialId`), 3 schedules + reminders (`schedules` store, `entries.scheduleId`, `entries.status`), 4 CSV + backup export.
