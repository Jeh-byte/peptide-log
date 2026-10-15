const APP_VERSION = '1.0.0';
const SITES = ['Abdomen L', 'Abdomen R', 'Thigh L', 'Thigh R', 'Arm L', 'Arm R', 'Glute L', 'Glute R', 'Nasal', 'Oral', 'Topical', 'Other'];
const ADD_NEW = '__add__';
// Set when running inside the Android APK (Capacitor), not in Chrome.
const NATIVE = !!window.Capacitor?.isNativePlatform?.();
const CapApp = NATIVE ? window.Capacitor.Plugins?.App || window.Capacitor.registerPlugin?.('App') : null;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => (v === '' || v == null || isNaN(+v) ? null : +v);
const fmtNum = (n) => (n == null ? '' : String(+(+n).toFixed(4)));

const state = { peptides: [], supplies: [], entries: [], editingId: null, site: '' };

// ---------- helpers ----------
function toLocalInput(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function timeStr(iso) { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function dayKey(iso) { const d = new Date(iso); return toLocalInput(d).slice(0, 10); }
function dayLabel(key) {
  const today = dayKey(new Date().toISOString());
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (key === today) return 'Today';
  if (key === dayKey(y.toISOString())) return 'Yesterday';
  const [Y, M, D] = key.split('-').map(Number);
  return new Date(Y, M - 1, D).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function ago(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}
function vialText(p) {
  if (p.vialAmount == null) return p.vialCount != null ? `${p.vialCount} vial${p.vialCount === 1 ? '' : 's'}` : '';
  return `${fmtNum(p.vialAmount)} ${p.vialUnit} × ${p.vialCount ?? 0} vial${p.vialCount === 1 ? '' : 's'}`;
}
function entrySummary(e) {
  const parts = [];
  if (e.dose != null) parts.push(`${fmtNum(e.dose)} ${e.doseUnit}`);
  if (e.volume != null) parts.push(`${fmtNum(e.volume)} ${e.volumeUnit}`);
  if (e.site) parts.push(e.site);
  return parts.join(' · ');
}
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
const activePeptides = () => state.peptides.filter((p) => !p.archived).sort(byName);
const lastEntryFor = (pid) => state.entries.filter((e) => e.peptideId === pid).sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0];

async function load() {
  [state.peptides, state.supplies, state.entries] = await Promise.all([DB.all('peptides'), DB.all('supplies'), DB.all('entries')]);
}

// ---------- tabs ----------
const TITLES = { log: 'Log a dose', history: 'History', peptides: 'Peptides' };
function show(view) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  document.querySelectorAll('.tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
    if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $('title').textContent = view === 'log' && state.editingId ? 'Edit dose' : TITLES[view];
  if (view === 'history') renderHistory();
  if (view === 'peptides') renderPeptides();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));

// ---------- log form ----------
function renderPeptideSelect(selectId) {
  const sel = $('fPeptide');
  const current = selectId ?? sel.value;
  const list = activePeptides();
  // keep an archived peptide visible when editing an old entry that uses it
  const editing = state.editingId && state.peptides.find((p) => p.id === current && p.archived);
  if (editing) list.push(editing);
  sel.innerHTML =
    `<option value="" disabled>Choose a peptide</option>` +
    list.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}${p.vialAmount != null ? ` (${fmtNum(p.vialAmount)} ${esc(p.vialUnit)})` : ''}</option>`).join('') +
    `<option value="${ADD_NEW}">+ Add new peptide…</option>`;
  sel.value = list.some((p) => p.id === current) ? current : '';
}

function renderSites() {
  const last = lastEntryFor($('fPeptide').value);
  $('siteChips').innerHTML = SITES.map((s) =>
    `<button type="button" class="chip${state.site === s ? ' on' : ''}" data-site="${esc(s)}" aria-pressed="${state.site === s}">${esc(s)}${last && last.site === s ? '<span class="last" aria-hidden="true">last</span><span class="sr-only">, used last time</span>' : ''}</button>`
  ).join('');
  $('fSiteOther').hidden = state.site !== 'Other';
}
$('siteChips').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  state.site = state.site === b.dataset.site ? '' : b.dataset.site;
  renderSites();
});

function renderLastHint() {
  const hint = $('lastHint');
  const last = state.editingId ? null : lastEntryFor($('fPeptide').value);
  if (!last) { hint.hidden = true; return; }
  hint.hidden = false;
  hint.innerHTML = `<span>Last: ${esc(entrySummary(last) || 'logged')} · ${esc(ago(last.takenAt))}</span><button type="button" class="btn ghost small" id="useLast">Use same dose</button>`;
  $('useLast').onclick = () => {
    $('fDose').value = fmtNum(last.dose);
    $('fDoseUnit').value = last.doseUnit || 'mcg';
    $('fVolume').value = fmtNum(last.volume);
    $('fVolumeUnit').value = last.volumeUnit || 'mL';
    renderVolHint();
  };
}

// U-100 insulin syringe: 1 mL = 100 units
function renderVolHint() {
  const v = num($('fVolume').value);
  const u = $('fVolumeUnit').value;
  $('volHint').textContent = v == null ? '' : u === 'mL' ? `= ${fmtNum(v * 100)} units on a U-100 insulin syringe` : `= ${fmtNum(v / 100)} mL`;
}
['input', 'change'].forEach((ev) => { $('fVolume').addEventListener(ev, renderVolHint); $('fVolumeUnit').addEventListener(ev, renderVolHint); });

$('fPeptide').addEventListener('change', () => {
  if ($('fPeptide').value === ADD_NEW) {
    $('fPeptide').value = '';
    openPeptideDialog(null, (p) => { renderPeptideSelect(p.id); onPeptideChosen(); });
    return;
  }
  onPeptideChosen();
});
function onPeptideChosen() { renderLastHint(); renderSites(); }

$('nowBtn').addEventListener('click', () => { $('fWhen').value = toLocalInput(new Date()); });

function resetForm(keepPeptide = true) {
  const pid = keepPeptide ? $('fPeptide').value : '';
  state.editingId = null;
  state.site = '';
  $('logForm').reset();
  renderPeptideSelect(pid);
  $('fWhen').value = toLocalInput(new Date());
  $('editBanner').hidden = true;
  $('cancelEditBtn').hidden = true;
  $('deleteBtn').hidden = true;
  $('saveBtn').textContent = 'Save dose';
  $('fSiteOther').value = '';
  renderVolHint();
  onPeptideChosen();
  if (document.querySelector('#view-log.active')) $('title').textContent = TITLES.log;
}

function editEntry(id) {
  const e = state.entries.find((x) => x.id === id);
  if (!e) return;
  state.editingId = id;
  renderPeptideSelect(e.peptideId);
  $('fDose').value = fmtNum(e.dose);
  $('fDoseUnit').value = e.doseUnit || 'mcg';
  $('fVolume').value = fmtNum(e.volume);
  $('fVolumeUnit').value = e.volumeUnit || 'mL';
  $('fWhen').value = toLocalInput(new Date(e.takenAt));
  $('fNotes').value = e.notes || '';
  if (e.site && !SITES.includes(e.site)) { state.site = 'Other'; $('fSiteOther').value = e.site; }
  else { state.site = e.site || ''; $('fSiteOther').value = ''; }
  $('editBanner').hidden = false;
  $('cancelEditBtn').hidden = false;
  $('deleteBtn').hidden = false;
  $('saveBtn').textContent = 'Update entry';
  renderVolHint();
  onPeptideChosen();
  show('log');
}

$('logForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const pid = $('fPeptide').value;
  const pep = state.peptides.find((p) => p.id === pid);
  if (!pep) { toast('Choose a peptide first'); $('fPeptide').focus(); return; }
  const dose = num($('fDose').value);
  const volume = num($('fVolume').value);
  if (dose == null && volume == null) { toast('Enter a dose or a volume'); $('fDose').focus(); return; }
  const when = new Date($('fWhen').value);
  if (isNaN(when)) { toast('Check the date and time'); return; }
  const site = state.site === 'Other' ? ($('fSiteOther').value.trim() || 'Other') : state.site;

  const prev = state.editingId ? state.entries.find((x) => x.id === state.editingId) : {};
  const rec = await DB.put('entries', {
    ...prev,
    peptideId: pep.id,
    peptideName: pep.name,
    dose, doseUnit: $('fDoseUnit').value,
    volume, volumeUnit: $('fVolumeUnit').value,
    takenAt: when.toISOString(),
    site,
    notes: $('fNotes').value.trim(),
    status: prev.status || 'taken',
    vialId: prev.vialId ?? null,
    scheduleId: prev.scheduleId ?? null
  });
  const i = state.entries.findIndex((x) => x.id === rec.id);
  if (i >= 0) state.entries[i] = rec; else state.entries.push(rec);
  const wasEditing = !!state.editingId;
  toast(wasEditing ? 'Entry updated' : `Saved ${pep.name}`);
  askPersist();
  resetForm(true);
  if (wasEditing) show('history');
});

$('cancelEditBtn').addEventListener('click', () => { resetForm(false); show('history'); });
// Two taps to delete, so a stray tap can't remove an entry.
let deleteArmed = null;
$('deleteBtn').addEventListener('click', async () => {
  if (!state.editingId) return;
  if (deleteArmed !== state.editingId) {
    deleteArmed = state.editingId;
    $('deleteBtn').textContent = 'Tap again to delete';
    setTimeout(() => { deleteArmed = null; $('deleteBtn').textContent = 'Delete'; }, 4000);
    return;
  }
  deleteArmed = null;
  $('deleteBtn').textContent = 'Delete';
  await DB.del('entries', state.editingId);
  state.entries = state.entries.filter((x) => x.id !== state.editingId);
  toast('Entry deleted');
  resetForm(false);
  show('history');
});

// Ask Chrome to keep our data even when the phone is low on space.
async function askPersist() {
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch {}
}

// ---------- history ----------
function renderHistoryFilter() {
  const sel = $('histFilter');
  const cur = sel.value;
  const used = new Set(state.entries.map((e) => e.peptideId));
  const list = state.peptides.filter((p) => used.has(p.id)).sort(byName);
  sel.innerHTML = `<option value="">All peptides</option>` + list.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  sel.value = list.some((p) => p.id === cur) ? cur : '';
}
function renderHistory() {
  renderHistoryFilter();
  const f = $('histFilter').value;
  const q = $('histSearch').value.trim().toLowerCase();
  const names = Object.fromEntries(state.peptides.map((p) => [p.id, p.name]));
  const list = state.entries
    .filter((e) => !f || e.peptideId === f)
    .filter((e) => !q || [e.notes, e.site, names[e.peptideId] || e.peptideName].join(' ').toLowerCase().includes(q))
    .sort((a, b) => b.takenAt.localeCompare(a.takenAt) || (b.createdAt || '').localeCompare(a.createdAt || ''));

  const weekAgo = Date.now() - 7 * 864e5;
  const thisWeek = list.filter((e) => new Date(e.takenAt) >= weekAgo).length;
  $('histStats').textContent = state.entries.length ? `${list.length} entr${list.length === 1 ? 'y' : 'ies'} · ${thisWeek} in the last 7 days` : '';

  if (!list.length) {
    $('histList').innerHTML = `<div class="empty">${state.entries.length ? 'No entries match.' : 'No doses logged yet.<br>Log one from the Log tab.'}</div>`;
    return;
  }
  let html = '', day = '';
  for (const e of list) {
    const k = dayKey(e.takenAt);
    if (k !== day) { day = k; html += `<div class="day-h">${esc(dayLabel(k))}</div>`; }
    html += `<button class="card" data-id="${esc(e.id)}">
      <div class="line1"><span>${esc(names[e.peptideId] || e.peptideName)}</span><span class="time">${esc(timeStr(e.takenAt))}</span></div>
      <div class="line2">${esc(entrySummary(e))}</div>
      ${e.notes ? `<div class="note">${esc(e.notes)}</div>` : ''}
    </button>`;
  }
  $('histList').innerHTML = html;
}
$('histList').addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) editEntry(c.dataset.id); });
$('histFilter').addEventListener('change', renderHistory);
$('histSearch').addEventListener('input', renderHistory);

// ---------- peptides ----------
function renderPeptides() {
  const showArch = $('showArchived').checked;
  const list = state.peptides.filter((p) => showArch || !p.archived).sort(byName);
  $('pepList').innerHTML = list.map((p) => {
    const count = state.entries.filter((e) => e.peptideId === p.id).length;
    const last = lastEntryFor(p.id);
    const meta = [vialText(p), count ? `${count} dose${count === 1 ? '' : 's'} logged` : 'no doses yet', last ? `last ${ago(last.takenAt)}` : ''].filter(Boolean).join(' · ');
    return `<button class="card${p.archived ? ' archived' : ''}" data-id="${esc(p.id)}">
      <div class="line1"><span>${esc(p.name)}</span>${p.archived ? '<span class="time">archived</span>' : ''}</div>
      <div class="line2">${esc(meta)}</div>
      ${p.notes ? `<div class="note">${esc(p.notes)}</div>` : ''}
    </button>`;
  }).join('') || `<div class="empty">No peptides yet.</div>`;

  $('supplyList').innerHTML = state.supplies.sort(byName).map((s) =>
    `<button class="card" data-id="${esc(s.id)}"><div class="line1"><span>${esc(s.name)}</span></div>
     <div class="line2">${esc(`${fmtNum(s.amount)} ${s.unit} × ${s.count} vial${s.count === 1 ? '' : 's'}`)}</div></button>`
  ).join('');
}
$('pepList').addEventListener('click', (e) => {
  const c = e.target.closest('.card');
  if (c) openPeptideDialog(state.peptides.find((p) => p.id === c.dataset.id), () => renderPeptides());
});
$('addPeptideBtn').addEventListener('click', () => openPeptideDialog(null, () => renderPeptides()));
$('showArchived').addEventListener('change', renderPeptides);

let pepDone = null, pepEditing = null;
function openPeptideDialog(p, done) {
  pepEditing = p;
  pepDone = done;
  $('pepDialogTitle').textContent = p ? 'Edit peptide' : 'Add peptide';
  $('pName').value = p?.name || '';
  $('pAmount').value = fmtNum(p?.vialAmount);
  $('pUnit').value = p?.vialUnit || 'mg';
  $('pCount').value = p ? (p.vialCount ?? '') : 1;
  $('pNotes').value = p?.notes || '';
  $('pArchived').checked = !!p?.archived;
  $('pArchivedWrap').hidden = !p;
  $('pepDialog').returnValue = '';
  $('pepDialog').showModal();
}
$('pepDialog').addEventListener('close', async () => {
  if ($('pepDialog').returnValue !== 'save') return;
  const name = $('pName').value.trim();
  if (!name) return;
  const rec = await DB.put('peptides', {
    ...(pepEditing || { archived: false }),
    name,
    vialAmount: num($('pAmount').value),
    vialUnit: $('pUnit').value,
    vialCount: num($('pCount').value),
    notes: $('pNotes').value.trim(),
    archived: pepEditing ? $('pArchived').checked : false
  });
  const i = state.peptides.findIndex((x) => x.id === rec.id);
  if (i >= 0) state.peptides[i] = rec; else state.peptides.push(rec);
  // keep old history entries showing the current name
  toast(pepEditing ? 'Peptide updated' : `Added ${rec.name}`);
  renderPeptideSelect();
  pepDone?.(rec);
});
$('pepDialog').addEventListener('cancel', () => { $('pepDialog').returnValue = 'cancel'; });

let supEditing = null;
$('supplyList').addEventListener('click', (e) => {
  const c = e.target.closest('.card');
  if (!c) return;
  supEditing = state.supplies.find((s) => s.id === c.dataset.id);
  $('sName').value = supEditing.name;
  $('sAmount').value = fmtNum(supEditing.amount);
  $('sUnit').value = supEditing.unit;
  $('sCount').value = supEditing.count ?? '';
  $('supDialog').returnValue = '';
  $('supDialog').showModal();
});
$('supDialog').addEventListener('close', async () => {
  if ($('supDialog').returnValue !== 'save' || !supEditing) return;
  const rec = await DB.put('supplies', { ...supEditing, name: $('sName').value.trim() || supEditing.name, amount: num($('sAmount').value), unit: $('sUnit').value, count: num($('sCount').value) });
  state.supplies = state.supplies.map((s) => (s.id === rec.id ? rec : s));
  renderPeptides();
});

// ---------- settings ----------
$('settingsBtn').addEventListener('click', async () => {
  let persisted = 'unknown', usage = '', version = APP_VERSION;
  try {
    if (NATIVE) persisted = 'App private storage';
    else if (navigator.storage?.persisted) persisted = (await navigator.storage.persisted()) ? 'Protected' : 'Not yet protected (Chrome decides; installing the app helps)';
    if (navigator.storage?.estimate) { const e = await navigator.storage.estimate(); usage = `${(e.usage / 1024).toFixed(0)} KB used`; }
    if (CapApp) version = `${(await CapApp.getInfo()).version} (Android)`;
  } catch {}
  const installed = matchMedia('(display-mode: standalone)').matches;
  $('setBody').innerHTML = `
    <p>All your data is stored only on this phone, inside this app. Nothing is uploaded.</p>
    <p><strong>${state.entries.length}</strong> doses logged · <strong>${state.peptides.length}</strong> peptides</p>
    <p>Storage: ${esc(persisted)}${usage ? ` · ${esc(usage)}` : ''}</p>
    ${NATIVE ? '' : `<p>${installed ? 'Running as an installed app.' : 'Tip: install from Chrome’s menu (⋮ → Add to Home screen / Install app) so it opens like a normal app and works offline.'}</p>`}
    <p class="subtle">${NATIVE ? 'Installing a newer version keeps your log. Uninstalling the app or clearing its storage deletes it.' : 'Clearing Chrome’s site data or uninstalling the app deletes your log.'} Export and backup is coming in a later update.</p>
    <p style="color:var(--muted);font-size:13px">Version ${esc(version)}</p>`;
  $('setDialog').showModal();
});

// ---------- start ----------
(async function init() {
  try {
    await DB.seedIfEmpty();
    await load();
  } catch (err) {
    document.querySelector('main').innerHTML = `<div class="empty">Could not open storage on this device.<br>${esc(err?.message || err)}</div>`;
    return;
  }
  resetForm(false);
  // The APK already has every file on the phone; a cache would only serve stale files after an update.
  if (!NATIVE && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();

// Android back button (APK only): close a dialog, leave edit mode, return to the Log tab, then leave the app.
CapApp?.addListener('backButton', () => {
  const open = document.querySelector('dialog[open]');
  if (open) { open.close('cancel'); return; }
  if (state.editingId) { $('cancelEditBtn').click(); return; }
  if (!$('view-log').classList.contains('active')) { show('log'); return; }
  CapApp.exitApp();
});
