// ---------- schedules ----------
// {id, name, rule: 'daily'|'every'|'rotate', every (days), blockDays (rotate: days on each before
//  switching), startDate 'YYYY-MM-DD', active, items: [{peptideId, dose, doseUnit, volume, volumeUnit, time 'HH:MM'}]}
// daily: every item every day. every: every item every N days from startDate.
// rotate: one item at a time, switching every blockDays (blockDays 1 = alternate days).
const dayDiff = (a, b) => Math.round((keyDate(b) - keyDate(a)) / 864e5);
const fmtTime = (hm) => { const [h, m] = hm.split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
const pepName = (id) => state.peptides.find((p) => p.id === id)?.name || 'Unknown peptide';
function itemText(it) {
  const parts = [];
  if (it.dose != null) parts.push(`${fmtNum(it.dose)} ${it.doseUnit}`);
  if (it.volume != null) parts.push(`${fmtNum(it.volume)} ${it.volumeUnit}`);
  return parts.join(' · ');
}

// A schedule item with the draw filled in from the peptide's mix when only the dose was given.
function withDraw(it) {
  if (it.volume != null || it.dose == null) return it;
  const mix = mixFor(it.peptideId);
  const d = mix && drawFor(it.dose, it.doseUnit, mix);
  return d ? { ...it, volume: +fmtUnits(d.units), volumeUnit: 'units' } : it;
}

function itemsOn(s, k) {
  if (!s.active || !s.items.length) return [];
  const ds = dayDiff(s.startDate, k);
  if (ds < 0) return [];
  let due;
  if (s.rule === 'every') due = ds % Math.max(1, s.every || 1) === 0 ? s.items.map((it, i) => [it, i]) : [];
  else if (s.rule === 'rotate') { const i = Math.floor(ds / Math.max(1, s.blockDays || 1)) % s.items.length; due = [[s.items[i], i]]; }
  else due = s.items.map((it, i) => [it, i]);
  // a peptide in an off week of its cycle isn't due
  return due.filter(([it]) => {
    const p = state.peptides.find((x) => x.id === it.peptideId);
    const c = p && cycleAt(p, k);
    return !c || c.on;
  });
}
// Scheduled doses for a day, each matched to a logged entry of that peptide on that day if there is one.
function dueOn(k) {
  const used = new Set();
  const dayEntries = state.entries.filter((e) => dayKey(e.takenAt) === k);
  const due = [];
  for (const s of state.schedules) for (const [it, i] of itemsOn(s, k)) due.push({ s, it, i });
  due.sort((a, b) => a.it.time.localeCompare(b.it.time) || pepName(a.it.peptideId).localeCompare(pepName(b.it.peptideId)));
  for (const d of due) {
    const mine = dayEntries.filter((e) => e.peptideId === d.it.peptideId && !used.has(e.id));
    d.entry = mine.find((e) => e.scheduleId === d.s.id) || mine[0] || null;
    if (d.entry) used.add(d.entry.id);
  }
  return due;
}
function nextDue(s, from = todayKey(), item = null) {
  for (let k = from, n = 0; n < 400; k = shiftDay(k, 1), n++) {
    const on = itemsOn(s, k);
    if (on.length && (item == null || on.some(([, i]) => i === item))) return k;
  }
  return null;
}

// ---------- Today checklist ----------
function renderChecklist() {
  const k = feelDay();
  const due = dueOn(k);
  $('checkWrap').hidden = !due.length;
  $('checklist').innerHTML = due.map((d, n) => {
    const name = pepName(d.it.peptideId);
    const what = itemText(withDraw(d.it));
    const done = !!d.entry;
    const empty = state.peptides.find((p) => p.id === d.it.peptideId)?.kind === 'oral' ? 'Tap to tick off' : 'Tap to enter the dose';
    const when = done ? `taken ${timeStr(d.entry.takenAt)}` : fmtTime(d.it.time);
    const label = `${name}${what ? ` ${what}` : ''}, ${done ? `taken at ${timeStr(d.entry.takenAt)}. Tap to edit` : `due ${fmtTime(d.it.time)}. Tap to log it`}`;
    return `<button type="button" class="check-row${done ? ' done' : ''}" data-n="${n}" aria-label="${esc(label)}">
      <span class="box" aria-hidden="true">${done ? '✓' : ''}</span>
      <span class="ck-main"><strong>${esc(name)}</strong>${what ? `<span>${esc(what)}</span>` : `<span>${empty}</span>`}</span>
      <span class="ck-time">${esc(when)}</span>
    </button>`;
  }).join('');
  $('checklist').due = due;
}
$('checklist').addEventListener('click', async (e) => {
  const b = e.target.closest('.check-row');
  if (!b) return;
  const d = $('checklist').due[+b.dataset.n];
  if (d.entry) { editEntry(d.entry.id); return; }
  const pep = state.peptides.find((p) => p.id === d.it.peptideId);
  if (!pep) { toast('That peptide no longer exists. Edit the schedule.'); return; }
  const k = feelDay();
  const [h, m] = d.it.time.split(':').map(Number);
  const when = k === todayKey() ? new Date() : new Date(keyDate(k).setHours(h, m, 0, 0));
  const oral = pep.kind === 'oral';
  if (d.it.dose == null && d.it.volume == null && !oral) {
    // no usual dose yet: open the form with what we know
    resetForm(false);
    renderPeptideSelect(pep.id);
    onPeptideChosen();
    $('fWhen').value = toLocalInput(when);
    $('logForm').scrollIntoView();
    $('fDose').focus();
    return;
  }
  const it = withDraw(d.it);
  const rec = await DB.put('entries', {
    peptideId: pep.id, peptideName: pep.name,
    dose: it.dose ?? null, doseUnit: it.doseUnit || 'mcg',
    volume: it.volume ?? null, volumeUnit: it.volumeUnit || 'units',
    takenAt: when.toISOString(), site: oral ? 'Oral' : '', notes: '', status: 'taken', vialId: null, scheduleId: d.s.id
  });
  state.entries.push(rec);
  askPersist();
  afterDoseChange();
  toast(`Logged ${pep.name}`, { label: 'Undo', fn: async () => {
    await DB.del('entries', rec.id);
    state.entries = state.entries.filter((x) => x.id !== rec.id);
    afterDoseChange();
    toast('Removed');
  } });
});
function afterDoseChange() {
  renderToday();
  renderAlerts();
  renderVialHint();
  syncReminders();
}

// ---------- schedule list (Peptides tab) ----------
function ruleText(s) {
  const times = [...new Set(s.items.map((it) => it.time))].sort().map(fmtTime).join(' and ');
  if (s.rule === 'every') {
    const nx = nextDue(s);
    return `Every ${s.every} days at ${times}${nx ? ` · next ${nx === todayKey() ? 'today' : shortDate(nx)}` : ''}`;
  }
  if (s.rule === 'rotate') {
    const today = itemsOn(s, todayKey())[0];
    if (s.blockDays === 1) return `Alternating days at ${times}${today ? ` · today: ${pepName(today[0].peptideId)}` : ''}`;
    const ds = Math.max(0, dayDiff(s.startDate, todayKey()));
    const switchOn = shiftDay(todayKey(), s.blockDays - (ds % s.blockDays));
    const next = s.items[(Math.floor(ds / s.blockDays) + 1) % s.items.length];
    return `${s.blockDays} days each at ${times}${today ? ` · now ${pepName(today[0].peptideId)}, ${pepName(next.peptideId)} from ${shortDate(switchOn)}` : ''}`;
  }
  return `Every day at ${times}`;
}
function renderSchedules() {
  $('schList').innerHTML = state.schedules.slice().sort((a, b) => (a.items[0]?.time || '').localeCompare(b.items[0]?.time || '')).map((s) => `
    <button class="card${s.active ? '' : ' archived'}" data-id="${esc(s.id)}">
      <div class="line1"><span>${esc(s.name)}</span>${s.active ? '' : '<span class="time">paused</span>'}</div>
      <div class="line2">${esc(ruleText(s))}</div>
      <div class="note">${esc(s.items.map((it) => `${pepName(it.peptideId)}${itemText(it) ? ` ${itemText(it)}` : ''}`).join(s.rule === 'rotate' ? ' ↔ ' : ', '))}</div>
    </button>`).join('') || '<p class="subtle-p">No schedules yet.</p>';
  $('remindersOn').checked = !!state.reminders;
  $('remindersNote').textContent = NATIVE
    ? (state.reminders ? 'Your phone will notify you when a scheduled dose is due, for the next 3 weeks. Opening the app tops this up.' : 'Turn on to get a phone notification when a scheduled dose is due.')
    : 'Phone notifications work in the Android app. Here, use Add to Google Calendar inside a schedule.';
}
$('schList').addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) openSchedule(state.schedules.find((s) => s.id === c.dataset.id)); });
$('addSchBtn').addEventListener('click', () => openSchedule(null));

// ---------- schedule editor ----------
let schEditing = null, schDeleteArmed = false;
function itemRow(it = {}) {
  const opts = activePeptides().map((p) => `<option value="${esc(p.id)}"${p.id === it.peptideId ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
  const unitOpts = (list, cur) => list.map((u) => `<option${u === cur ? ' selected' : ''}>${u}</option>`).join('');
  return `<div class="sch-item">
    <div class="row">
      <label class="field grow"><span>Peptide</span><select class="i-pep" required><option value="">Choose…</option>${opts}</select></label>
      <label class="field unit"><span>Time</span><input class="i-time" type="time" value="${esc(it.time || '08:00')}" required></label>
    </div>
    <div class="row">
      <label class="field grow"><span>Dose</span><input class="i-dose" type="number" inputmode="decimal" step="any" min="0" value="${esc(fmtNum(it.dose))}"></label>
      <label class="field unit"><span>&nbsp;</span><select class="i-dunit" aria-label="Dose unit">${unitOpts(['mcg', 'mg', 'IU'], it.doseUnit || 'mg')}</select></label>
    </div>
    <div class="row">
      <label class="field grow"><span>Draw (optional)</span><input class="i-vol" type="number" inputmode="decimal" step="any" min="0" value="${esc(fmtNum(it.volume))}"></label>
      <label class="field unit"><span>&nbsp;</span><select class="i-vunit" aria-label="Draw unit">${unitOpts(['units', 'mL'], it.volumeUnit || 'units')}</select></label>
    </div>
    <button type="button" class="btn ghost small i-del">Remove</button>
  </div>`;
}
function openSchedule(s) {
  schEditing = s;
  schDeleteArmed = false;
  $('schTitle').textContent = s ? 'Edit schedule' : 'New schedule';
  $('schName').value = s?.name || '';
  $('schRule').value = s?.rule || 'daily';
  $('schEvery').value = s?.every || 2;
  $('schBlock').value = s?.blockDays || 28;
  $('schStart').value = s?.startDate || todayKey();
  $('schActive').checked = s ? s.active !== false : true;
  $('schItems').innerHTML = (s?.items.length ? s.items : [{}]).map(itemRow).join('');
  $('schDelete').hidden = !s;
  $('schDelete').textContent = 'Delete schedule';
  syncRuleFields();
  renderCalButtons();
  $('schDialog').returnValue = '';
  $('schDialog').showModal();
}
function syncRuleFields() {
  const r = $('schRule').value;
  $('schEveryWrap').hidden = r !== 'every';
  $('schBlockWrap').hidden = r !== 'rotate';
  $('schRuleHint').textContent = r === 'rotate' ? 'Takes one peptide at a time, in the order below, switching after the number of days you set. Use 1 for alternate days.' : '';
}
$('schRule').addEventListener('change', syncRuleFields);
$('schAddItem').addEventListener('click', () => {
  const times = $('schItems').querySelectorAll('.i-time');
  $('schItems').insertAdjacentHTML('beforeend', itemRow({ time: times[times.length - 1]?.value }));
});
$('schItems').addEventListener('click', (e) => {
  if (!e.target.closest('.i-del')) return;
  if ($('schItems').children.length > 1) e.target.closest('.sch-item').remove();
});
function readSchedule() {
  const items = [...$('schItems').querySelectorAll('.sch-item')].map((row) => ({
    peptideId: row.querySelector('.i-pep').value,
    time: row.querySelector('.i-time').value || '08:00',
    dose: num(row.querySelector('.i-dose').value), doseUnit: row.querySelector('.i-dunit').value,
    volume: num(row.querySelector('.i-vol').value), volumeUnit: row.querySelector('.i-vunit').value
  })).filter((it) => it.peptideId);
  return {
    ...(schEditing || {}),
    name: $('schName').value.trim() || 'Schedule',
    rule: $('schRule').value,
    every: Math.max(1, Math.round(num($('schEvery').value) || 1)),
    blockDays: Math.max(1, Math.round(num($('schBlock').value) || 1)),
    startDate: $('schStart').value || todayKey(),
    active: $('schActive').checked,
    items
  };
}
$('schDialog').addEventListener('close', async () => {
  if ($('schDialog').returnValue !== 'save') return;
  const s = readSchedule();
  if (!s.items.length) { toast('Add at least one peptide'); return; }
  const rec = await DB.put('schedules', s);
  const i = state.schedules.findIndex((x) => x.id === rec.id);
  if (i >= 0) state.schedules[i] = rec; else state.schedules.push(rec);
  toast(schEditing ? 'Schedule updated' : 'Schedule added');
  renderSchedules();
  renderToday();
  syncReminders();
});
$('schDelete').addEventListener('click', async () => {
  if (!schEditing) return;
  if (!schDeleteArmed) { schDeleteArmed = true; $('schDelete').textContent = 'Tap again to delete'; return; }
  await DB.del('schedules', schEditing.id);
  state.schedules = state.schedules.filter((s) => s.id !== schEditing.id);
  $('schDialog').close('cancel');
  toast('Schedule deleted');
  renderSchedules();
  renderToday();
  syncReminders();
});

// ---------- Google Calendar ----------
function gcalUrl({ title, details, startKey, time, rrule }) {
  const p2 = (n) => String(n).padStart(2, '0');
  const [h, m] = time.split(':').map(Number);
  const start = new Date(keyDate(startKey).setHours(h, m, 0, 0));
  const end = new Date(start.getTime() + 15 * 60000);
  const stamp = (d) => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}T${p2(d.getHours())}${p2(d.getMinutes())}00`;
  const q = new URLSearchParams({
    action: 'TEMPLATE', text: title, details, dates: `${stamp(start)}/${stamp(end)}`,
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone || '', recur: `RRULE:${rrule}`
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}
// One reminder per time of day (daily / every N), per peptide (alternate days), or one daily
// "check the app" reminder for longer rotations that a calendar repeat rule can't describe.
function calLinks(s) {
  const out = [];
  const det = (its) => `Peptide Log: ${its.map((it) => `${pepName(it.peptideId)}${itemText(it) ? ` ${itemText(it)}` : ''}`).join(', ')}. Tick it off in the app's Today list.`;
  if (s.rule === 'rotate' && s.blockDays === 1) {
    s.items.forEach((it, i) => {
      const k = nextDue(s, todayKey(), i);
      if (k) out.push({ label: `${pepName(it.peptideId)} reminder`, url: gcalUrl({ title: `${pepName(it.peptideId)} dose`, details: det([it]), startKey: k, time: it.time, rrule: `FREQ=DAILY;INTERVAL=${s.items.length}` }) });
    });
    return out;
  }
  const byTime = {};
  for (const it of s.items) (byTime[it.time] ||= []).push(it);
  for (const [time, its] of Object.entries(byTime)) {
    const k = s.rule === 'every' ? nextDue(s) : todayKey();
    if (!k) continue;
    const rotate = s.rule === 'rotate';
    out.push({
      label: Object.keys(byTime).length > 1 ? `${fmtTime(time)} reminder` : 'Add to Google Calendar',
      url: gcalUrl({
        title: rotate ? `${s.name} dose` : `${its.map((it) => pepName(it.peptideId)).join(' + ')} dose`,
        details: rotate ? `Peptide Log: ${s.name} (${s.items.map((it) => pepName(it.peptideId)).join(' then ')}, ${s.blockDays} days each). The app's Today list shows which one is due.` : det(its),
        startKey: k, time, rrule: s.rule === 'every' ? `FREQ=DAILY;INTERVAL=${s.every}` : 'FREQ=DAILY'
      })
    });
  }
  return out;
}
function renderCalButtons() {
  const links = schEditing ? calLinks(schEditing) : [];
  $('schCal').hidden = !links.length;
  $('schCalBtns').innerHTML = links.map((l, i) => `<button type="button" class="btn ghost small" data-i="${i}">${esc(l.label)}</button>`).join('');
  $('schCalBtns').links = links;
}
$('schCalBtns').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) openExternal($('schCalBtns').links[+b.dataset.i].url); });

// Opens a web page outside the app: the APK hands it to the phone's browser/apps.
function openExternal(url) {
  if (NATIVE) location.href = url;
  else window.open(url, '_blank', 'noopener');
}

// ---------- phone notifications (APK) ----------
const Notify = NATIVE ? window.Capacitor.registerPlugin('LocalNotifications') : null;
const REMIND_DAYS = 21;
let syncing = Promise.resolve();
function syncReminders() {
  syncing = syncing.then(doSync, doSync);
  return syncing;
}
async function doSync() {
  if (!Notify) return;
  try {
    const pending = (await Notify.getPending()).notifications || [];
    if (pending.length) await Notify.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
    if (!state.reminders) return;
    const now = Date.now(), base = keyDate('2026-01-01').getTime();
    const list = [];
    for (let k = todayKey(), n = 0; n < REMIND_DAYS; k = shiftDay(k, 1), n++) {
      const groups = {};
      for (const d of dueOn(k)) if (!d.entry) (groups[d.it.time] ||= []).push(d.it);
      for (const [time, its] of Object.entries(groups)) {
        const [h, m] = time.split(':').map(Number);
        const at = new Date(keyDate(k).setHours(h, m, 0, 0));
        if (at.getTime() <= now) continue;
        list.push({
          id: Math.round((keyDate(k).getTime() - base) / 864e5) * 10000 + h * 100 + m,
          title: `Dose due: ${its.map((it) => pepName(it.peptideId)).join(', ')}`,
          body: `${its.map((it) => `${pepName(it.peptideId)}${itemText(it) ? ` ${itemText(it)}` : ''}`).join(' · ')}. Open the app to tick it off.`,
          schedule: { at, allowWhileIdle: true },
          smallIcon: 'ic_stat_dose'
        });
      }
    }
    if (list.length) await Notify.schedule({ notifications: list });
  } catch (err) { console.error('reminders', err?.message || err); }
}
$('remindersOn').addEventListener('change', async () => {
  let on = $('remindersOn').checked;
  if (on && Notify) {
    try {
      let p = await Notify.checkPermissions();
      if (p.display !== 'granted') p = await Notify.requestPermissions();
      if (p.display !== 'granted') { on = false; toast('Notifications are off for this app in Android settings'); }
    } catch { on = false; }
  }
  if (on && !Notify) { on = false; toast('Phone notifications work in the Android app'); }
  state.reminders = on;
  await DB.setMeta('reminders', on);
  renderSchedules();
  await syncReminders();
  if (on) toast('Reminders on');
});
CapApp?.addListener('resume', () => { renderToday(); renderAlerts(); syncReminders(); });

// ---------- one-time setup from Jeh's messages ----------
function findPeptide(name) {
  const n = normName(name);
  const live = state.peptides.filter((p) => !p.archived);
  const exact = live.find((p) => normName(p.name) === n);
  if (exact) return exact;
  const starts = live.filter((p) => normName(p.name).startsWith(n));
  return starts.find((p) => activeVial(p.id)) || starts.sort(byName)[0] || null;
}
async function seedSetup() {
  // 'mixRule' replaces the earlier 'mixSeeded' (3 peptides only): it sets every peptide and every
  // vial already mixed to the stated bac water.
  if (!(await DB.getMeta('mixRule'))) {
    const mlFor = (name) => {
      const hit = Object.entries(window.SEED_MIX || {}).find(([n]) => normName(name).startsWith(normName(n)));
      return hit ? hit[1] : window.SEED_MIX_DEFAULT;
    };
    for (const p of state.peptides) {
      const ml = mlFor(p.name);
      if (p.bacWaterMl !== ml) {
        const rec = await DB.put('peptides', { ...p, bacWaterMl: ml });
        state.peptides = state.peptides.map((x) => (x.id === rec.id ? rec : x));
      }
      for (const v of state.vials.filter((x) => x.peptideId === p.id && x.diluentMl !== ml)) {
        const rec = await DB.put('vials', { ...v, diluentMl: ml });
        state.vials = state.vials.map((x) => (x.id === rec.id ? rec : x));
      }
    }
    await DB.setMeta('mixRule', new Date().toISOString());
  }
  if (!(await DB.getMeta('schedulesSeeded'))) {
    if (!state.schedules.length) {
      for (const s of window.SEED_SCHEDULES || []) {
        const items = s.items.map((it) => {
          const p = findPeptide(it.peptide);
          if (!p) return null;
          const last = it.dose == null && it.volume == null ? lastEntryFor(p.id) : null;
          return {
            peptideId: p.id, time: it.time,
            dose: it.dose ?? last?.dose ?? null, doseUnit: it.doseUnit || last?.doseUnit || 'mg',
            volume: it.volume ?? last?.volume ?? null, volumeUnit: it.volumeUnit || last?.volumeUnit || 'units'
          };
        }).filter(Boolean);
        if (items.length) state.schedules.push(await DB.put('schedules', { name: s.name, rule: s.rule, every: s.every || 1, blockDays: s.blockDays || 1, startDate: s.startDate, active: true, items }));
      }
    }
    await DB.setMeta('schedulesSeeded', new Date().toISOString());
  }
  if (!(await DB.getMeta('oralSeeded'))) {
    for (const o of window.SEED_ORAL || []) {
      let p = state.peptides.find((x) => normName(x.name) === normName(o.name));
      if (!p) {
        p = await DB.put('peptides', { name: o.name, kind: 'oral', vialAmount: null, vialUnit: 'mg', vialCount: null, bacWaterMl: null, notes: o.notes, archived: false });
        state.peptides.push(p);
      }
      if (state.schedules.some((s) => s.items.some((it) => it.peptideId === p.id))) continue;
      state.schedules.push(await DB.put('schedules', {
        name: o.schedule, rule: 'daily', every: 1, blockDays: 1, startDate: todayKey(), active: true,
        items: [{ peptideId: p.id, time: o.time, dose: null, doseUnit: 'mg', volume: null, volumeUnit: 'units' }]
      }));
    }
    await DB.setMeta('oralSeeded', new Date().toISOString());
  }
  // Selank was seeded with no dose; fill it in once on existing installs, unless one was set since.
  if (!(await DB.getMeta('selankDose'))) {
    const p = findPeptide('Selank');
    for (const s of p ? state.schedules : []) {
      if (!s.items.some((it) => it.peptideId === p.id && it.dose == null && it.volume == null)) continue;
      const items = s.items.map((it) => (it.peptideId === p.id && it.dose == null && it.volume == null ? { ...it, ...window.SEED_SELANK } : it));
      const rec = await DB.put('schedules', { ...s, items });
      state.schedules = state.schedules.map((x) => (x.id === rec.id ? rec : x));
    }
    await DB.setMeta('selankDose', new Date().toISOString());
  }
}
