// ---------- vials ----------
// A vial is mixed once. Every dose of that peptide logged from its mixedAt (until the next vial is
// mixed or it is marked empty) comes out of it, so imported and edited entries count too.
const VIAL_LOW_DOSES = 3;
const VIAL_OLD_DAYS = 28;

const activeVial = (pid) => state.vials.find((v) => v.peptideId === pid && v.status === 'active');
const fmtAmt = (n) => String(+(+n).toFixed(n < 1 ? 3 : n < 10 ? 2 : 1));

// How much of the vial (in the vial's unit) one entry used, or null if it can't be worked out.
function amountUsed(e, v) {
  if (e.dose != null && e.dose > 0) {
    if (e.doseUnit === v.unit) return e.dose;
    if (e.doseUnit === 'mcg' && v.unit === 'mg') return e.dose / 1000;
    if (e.doseUnit === 'mg' && v.unit === 'mcg') return e.dose * 1000;
  }
  if (e.volume != null && e.volume > 0) {
    const ml = e.volumeUnit === 'units' ? e.volume / 100 : e.volume; // U-100 syringe
    if (v.unit === 'mL') return ml;
    if (v.diluentMl > 0) return (ml / v.diluentMl) * v.amount;
  }
  return null;
}

function vialStatus(v) {
  const end = v.finishedAt || '9999';
  const mine = state.entries.filter((e) => e.peptideId === v.peptideId).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  let used = 0, uncounted = 0;
  for (const e of mine) {
    if (e.takenAt < v.mixedAt || e.takenAt >= end) continue;
    const a = amountUsed(e, v);
    if (a == null) uncounted++; else used += a;
  }
  // A typical dose is the median of the last 5 doses of this peptide that convert to the vial's unit.
  const recent = mine.map((e) => amountUsed(e, v)).filter((a) => a != null).slice(-5).sort((a, b) => a - b);
  const typical = recent.length ? recent[Math.floor(recent.length / 2)] : null;
  const left = Math.max(0, v.amount - used);
  const dosesLeft = typical ? Math.floor(left / typical + 1e-9) : null;
  const ageDays = Math.floor((Date.now() - new Date(v.mixedAt)) / 864e5);
  const empty = left <= 0 || dosesLeft === 0;
  return {
    used, left, typical, dosesLeft, uncounted, ageDays,
    pct: v.amount ? Math.round((left / v.amount) * 100) : 0,
    empty, low: !empty && dosesLeft != null && dosesLeft <= VIAL_LOW_DOSES, old: ageDays > VIAL_OLD_DAYS
  };
}

const daysText = (d) => (d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`);
function vialLine(v, s) {
  const parts = [`${fmtAmt(s.left)} ${v.unit} left of ${fmtAmt(v.amount)}`];
  if (s.dosesLeft != null) parts.push(`about ${s.dosesLeft} dose${s.dosesLeft === 1 ? '' : 's'}`);
  parts.push(`mixed ${daysText(s.ageDays)}`);
  return parts.join(' · ');
}
function meterHTML(s) {
  const cls = s.empty ? ' empty' : s.low ? ' low' : '';
  return `<div class="meter${cls}" role="img" aria-label="${s.pct}% left"><span style="width:${s.pct}%"></span></div>`;
}

// ---------- warnings at the top of the Log screen ----------
function vialAlerts() {
  const out = [];
  for (const v of state.vials) {
    if (v.status !== 'active') continue;
    const p = state.peptides.find((x) => x.id === v.peptideId);
    if (!p || p.archived) continue;
    const s = vialStatus(v);
    if (s.empty) out.push({ p, level: 'critical', label: 'Probably empty', text: `${fmtAmt(s.left)} ${v.unit} left, less than one dose` });
    else if (s.low) out.push({ p, level: 'warning', label: 'Running low', text: `about ${s.dosesLeft} dose${s.dosesLeft === 1 ? '' : 's'} left (${fmtAmt(s.left)} ${v.unit})` });
    if (s.old) out.push({ p, level: 'warning', label: 'Mixed over 4 weeks ago', text: `mixed ${s.ageDays} days ago` });
  }
  return out.sort((a, b) => (a.level === b.level ? byName(a.p, b.p) : a.level === 'critical' ? -1 : 1));
}
function renderAlerts() {
  const list = state.editingId ? [] : vialAlerts();
  $('alerts').hidden = !list.length;
  $('alerts').innerHTML = list.map((a) => `
    <div class="alert ${a.level}">
      <span class="alert-icon" aria-hidden="true">${a.level === 'critical' ? '×' : '!'}</span>
      <div class="alert-text"><strong>${esc(a.p.name)}</strong> · ${esc(a.label)}<br><span>${esc(a.text)}</span></div>
      <button type="button" class="btn ghost small" data-mix="${esc(a.p.id)}">Mix new vial</button>
    </div>`).join('');
}
$('alerts').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mix]');
  if (b) openVialDialog(state.peptides.find((p) => p.id === b.dataset.mix));
});

// Under the peptide picker: what's left in the current vial.
function renderVialHint() {
  const pid = $('fPeptide').value;
  const v = pid && activeVial(pid);
  $('vialHint').hidden = !v;
  if (!v) return;
  const s = vialStatus(v);
  $('vialHint').innerHTML = `<span>Vial: ${esc(vialLine(v, s))}</span>${meterHTML(s)}`;
}

// ---------- mix a new vial ----------
let vialFor = null, emptyArmed = false;
function openVialDialog(p, done) {
  vialFor = { p, done };
  const cur = activeVial(p.id);
  $('vialTitle').textContent = `Mix a new vial: ${p.name}`;
  $('vialCurrent').textContent = cur ? `Current vial: ${vialLine(cur, vialStatus(cur))}. Mixing a new one finishes it.` : '';
  $('vialCurrent').hidden = !cur;
  $('vAmount').value = fmtNum(cur?.amount ?? p.vialAmount);
  $('vUnit').value = cur?.unit || p.vialUnit || 'mg';
  $('vWater').value = fmtNum(cur?.diluentMl);
  $('vMixed').value = toLocalInput(new Date());
  $('vTake').checked = (p.vialCount ?? 0) > 0;
  $('vTakeWrap').hidden = !((p.vialCount ?? 0) > 0);
  $('vTakeText').textContent = `Take 1 from vials on hand (${p.vialCount ?? 0} left)`;
  $('vEmptyBtn').hidden = !cur;
  $('vEmptyBtn').textContent = 'Mark current vial empty';
  emptyArmed = false;
  $('vialDialog').returnValue = '';
  $('vialDialog').showModal();
}
async function finishVial(v, at) {
  const rec = await DB.put('vials', { ...v, status: 'finished', finishedAt: at });
  state.vials = state.vials.map((x) => (x.id === rec.id ? rec : x));
}
function afterVialChange() {
  renderAlerts();
  renderVialHint();
  if ($('view-peptides').classList.contains('active')) renderPeptides();
  vialFor?.done?.();
}
$('vEmptyBtn').addEventListener('click', async () => {
  const cur = vialFor && activeVial(vialFor.p.id);
  if (!cur) return;
  // Two taps, like Delete, so a stray tap can't end a vial.
  if (!emptyArmed) { emptyArmed = true; $('vEmptyBtn').textContent = 'Tap again to mark empty'; return; }
  await finishVial(cur, new Date().toISOString());
  $('vialDialog').close('cancel');
  toast(`${vialFor.p.name} vial marked empty`);
  afterVialChange();
});
$('vialDialog').addEventListener('close', async () => {
  if ($('vialDialog').returnValue !== 'save' || !vialFor) return;
  const { p } = vialFor;
  const amount = num($('vAmount').value);
  const mixed = new Date($('vMixed').value);
  if (!(amount > 0) || isNaN(mixed)) { toast('Enter the amount in the vial and when it was mixed'); return; }
  const mixedAt = mixed.toISOString();
  const cur = activeVial(p.id);
  if (cur) await finishVial(cur, mixedAt > cur.mixedAt ? mixedAt : new Date().toISOString());
  const v = await DB.put('vials', { peptideId: p.id, amount, unit: $('vUnit').value, diluentMl: num($('vWater').value), mixedAt, status: 'active', finishedAt: null });
  state.vials.push(v);
  if ($('vTake').checked && (p.vialCount ?? 0) > 0) {
    const rec = await DB.put('peptides', { ...p, vialCount: p.vialCount - 1 });
    state.peptides = state.peptides.map((x) => (x.id === rec.id ? rec : x));
  }
  toast(`New ${p.name} vial started`);
  afterVialChange();
});
