// ---------- backup, restore and spreadsheet export ----------
// A backup is one JSON file with every record. Restoring merges it in: records with the same id are
// replaced by the backup's version, everything else on the phone is kept.
const BACKUP_STORES = ['peptides', 'supplies', 'entries', 'vials', 'checkins', 'schedules'];
const BACKUP_DAYS = 14; // remind on the Log screen when the last backup is older than this
const Files = NATIVE ? window.Capacitor.registerPlugin('Filesystem') : null;
const Sharer = NATIVE ? window.Capacitor.registerPlugin('Share') : null;

// Web: download the file. APK: write it to the app's cache and open Android's share sheet
// (Save to Drive, Files, email...). Resolves false if the person backs out of the share sheet.
async function saveFile(name, text, mime) {
  if (Files && Sharer) {
    const r = await Files.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
    try { await Sharer.share({ title: name, files: [r.uri], dialogTitle: `Save or send ${name}` }); }
    catch { return false; }
    return true;
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

async function backupNow() {
  const data = Object.fromEntries(await Promise.all(BACKUP_STORES.map(async (s) => [s, await DB.all(s)])));
  const body = JSON.stringify({ format: 'peptide-log-backup', version: 1, app: APP_VERSION, exportedAt: new Date().toISOString(), meta: { units: state.units }, data });
  const ok = await saveFile(`peptide-log-backup-${todayKey()}.json`, body, 'application/json');
  if (!ok) { toast('Backup not saved'); return; }
  state.lastBackup = new Date().toISOString();
  await DB.setMeta('lastBackup', state.lastBackup);
  renderBackupInfo();
  renderAlerts();
  toast(`Backup saved: ${state.entries.length} doses`);
}

// Spreadsheet export (CSV opens in Excel, Google Sheets and Numbers).
function csv(rows) {
  const cell = (v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // stop spreadsheets treating notes as formulas
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}
async function exportDoses() {
  const names = Object.fromEntries(state.peptides.map((p) => [p.id, p.name]));
  const rows = state.entries.slice().sort((a, b) => a.takenAt.localeCompare(b.takenAt)).map((e) => {
    const d = new Date(e.takenAt);
    return [dayKey(e.takenAt), toLocalInput(d).slice(11), names[e.peptideId] || e.peptideName, e.dose, e.dose != null ? e.doseUnit : '', e.volume, e.volume != null ? e.volumeUnit : '', e.site, e.notes];
  });
  await saveFile(`peptide-log-doses-${todayKey()}.csv`, csv([['Date', 'Time', 'Peptide', 'Dose', 'Dose unit', 'Volume', 'Volume unit', 'Site', 'Notes'], ...rows]), 'text/csv');
}
async function exportFeel() {
  const rows = state.checkins.slice().sort((a, b) => a.id.localeCompare(b.id)).map((c) =>
    [c.id, c.sleep, c.energy, c.mood, [...(c.sideEffects || []), c.sideOther].filter(Boolean).join('; '), c.weight, c.weight != null ? c.weightUnit || 'kg' : '', c.waist, c.waist != null ? c.waistUnit || 'cm' : '']);
  await saveFile(`peptide-log-how-i-feel-${todayKey()}.csv`, csv([['Date', 'Sleep (1-5)', 'Energy (1-5)', 'Mood (1-5)', 'Side effects', 'Weight', 'Weight unit', 'Waist', 'Waist unit'], ...rows]), 'text/csv');
}
const guard = (fn) => async () => { try { await fn(); } catch (err) { toast(`Couldn’t save the file: ${err?.message || err}`); } };
$('backupBtn').addEventListener('click', guard(backupNow));
$('exportDosesBtn').addEventListener('click', guard(exportDoses));
$('exportFeelBtn').addEventListener('click', guard(exportFeel));
$('restoreBtn').addEventListener('click', () => $('importFile').click());

function renderBackupInfo() {
  $('backupInfo').textContent = state.lastBackup ? `Last backup: ${ago(state.lastBackup)}.` : 'No backup saved yet.';
}
function backupAlerts() {
  if (!state.entries.length) return [];
  const days = state.lastBackup ? (Date.now() - new Date(state.lastBackup)) / 864e5 : Infinity;
  if (days < BACKUP_DAYS) return [];
  return [{ level: 'info', title: 'Back up your log', label: state.lastBackup ? `last backup ${ago(state.lastBackup)}` : 'never backed up',
    text: `${state.entries.length} doses are only on this phone`, action: 'backup', btn: 'Back up now' }];
}

// ---------- restore ----------
let pendingRestore = null;
function openRestore(data) {
  const d = data.data || {};
  const counts = BACKUP_STORES.map((s) => [s, Array.isArray(d[s]) ? d[s].filter((r) => r && r.id).length : 0]);
  pendingRestore = data;
  $('setDialog').close();
  $('restoreBody').innerHTML = `
    <p>Backup from <strong>${esc(data.exportedAt ? new Date(data.exportedAt).toLocaleString() : 'an unknown date')}</strong>:</p>
    <p>${counts.filter(([, n]) => n).map(([s, n]) => `${n} ${s === 'checkins' ? 'how-I-feel days' : s}`).join(' · ') || 'nothing in it'}</p>
    <p class="subtle-p">Restoring adds everything in the backup to this phone. Records that are in both are set back to the backup’s version. Nothing else is deleted.</p>`;
  $('restoreConfirm').hidden = !counts.some(([, n]) => n);
  $('restoreDialog').returnValue = '';
  $('restoreDialog').showModal();
}
$('restoreDialog').addEventListener('close', async () => {
  if ($('restoreDialog').returnValue !== 'restore' || !pendingRestore) return;
  const data = pendingRestore;
  pendingRestore = null;
  for (const s of BACKUP_STORES) {
    const recs = Array.isArray(data.data?.[s]) ? data.data[s].filter((r) => r && typeof r.id === 'string') : [];
    if (recs.length) await DB.putMany(s, recs);
  }
  if (data.meta?.units) await DB.setMeta('units', data.meta.units);
  await load();
  resetForm(false);
  syncReminders();
  toast(`Restored ${data.data?.entries?.length || 0} doses`);
});
