// ---------- Today: doses and how I feel ----------
// One check-in per day, keyed by local date. Everything saves as you go.
const FACES = [[1, '😣', 'Awful'], [2, '🙁', 'Poor'], [3, '😐', 'OK'], [4, '🙂', 'Good'], [5, '😄', 'Great']];
const FEEL_KEYS = [['sleep', 'Sleep'], ['energy', 'Energy'], ['mood', 'Mood']];
const SIDE_EFFECTS = ['Nausea', 'Headache', 'Tiredness', 'Low appetite', 'Reflux', 'Constipation', 'Diarrhoea', 'Dizziness', 'Poor sleep', 'Site reaction'];
const faceFor = (n) => FACES.find((f) => f[0] === n);

const todayKey = () => dayKey(new Date().toISOString());
const feelDay = () => state.feelDay || todayKey();
const checkinFor = (k) => state.checkins.find((c) => c.id === k);
function shiftDay(k, n) {
  const [Y, M, D] = k.split('-').map(Number);
  return dayKey(new Date(Y, M - 1, D + n, 12).toISOString());
}

function upsertCheckin(rec) {
  const i = state.checkins.findIndex((c) => c.id === rec.id);
  if (i >= 0) state.checkins[i] = rec; else state.checkins.push(rec);
}
// State is updated before the write so quick taps never overwrite each other with stale data.
async function saveCheckin(patch) {
  const k = feelDay();
  const rec = { ...(checkinFor(k) || {}), ...patch, id: k, date: k };
  upsertCheckin(rec);
  upsertCheckin(await DB.put('checkins', rec));
  $('feelSaved').textContent = 'Saved';
  askPersist();
}
let feelTimer = null, feelPending = null;
function saveSoon(patch) {
  feelPending = { ...feelPending, ...patch };
  clearTimeout(feelTimer);
  feelTimer = setTimeout(flushFeel, 600);
}
function flushFeel() {
  clearTimeout(feelTimer);
  if (!feelPending) return;
  const p = feelPending;
  feelPending = null;
  return saveCheckin(p);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) flushFeel(); });

const MAX_AHEAD = 60;   // how far forward you can look at what's due
function renderToday() {
  const k = feelDay();
  const future = k > todayKey();
  $('todayLabel').textContent = dayLabel(k);
  $('dayNext').disabled = k >= shiftDay(todayKey(), MAX_AHEAD);
  $('dayToday').hidden = k === todayKey();
  $('todaySec').classList.toggle('future', future);
  $('feelCard').hidden = future;
  renderChecklist();
  renderNextLine(k);
  if (future) {
    $('otherHead').hidden = true;
    $('todayDoses').innerHTML = $('checkWrap').hidden ? '<p class="subtle-p">Nothing scheduled on this day.</p>' : '';
    return;
  }
  $('otherHead').hidden = false;
  const names = Object.fromEntries(state.peptides.map((p) => [p.id, p.name]));
  const ticked = new Set(($('checklist').due || []).map((d) => d.entry?.id).filter(Boolean));
  const doses = state.entries.filter((e) => dayKey(e.takenAt) === k && !ticked.has(e.id)).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  $('otherHead').textContent = ticked.size || !$('checkWrap').hidden ? 'Also logged' : 'Logged';
  $('todayDoses').innerHTML = doses.length
    ? doses.map((e) => `<button type="button" class="card compact" data-id="${esc(e.id)}">
        <div class="line1"><span>${esc(names[e.peptideId] || e.peptideName)}</span><span class="time">${esc(timeStr(e.takenAt))}</span></div>
        <div class="line2">${esc(entrySummary(e))}</div></button>`).join('')
    : `<p class="subtle-p">${$('checkWrap').hidden ? 'No doses logged on this day.' : 'Nothing else logged on this day.'}</p>`;
  renderFeel();
}
$('todayDoses').addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) editEntry(c.dataset.id); });
// "Next: Retatrutide tomorrow 8:00 am · ..." under today's list
function renderNextLine(k) {
  const el = $('todayNext');
  if (k !== todayKey()) { el.hidden = true; return; }
  const up = [];
  for (let i = 1; i <= 3 && up.length < 4; i++) {
    const day = shiftDay(k, i);
    for (const d of dueOn(day)) if (up.length < 4) up.push({ day, d });
  }
  el.hidden = !up.length;
  el.innerHTML = up.length ? 'Next: ' + up.map(({ day, d }) => {
    const when = day === shiftDay(k, 1) ? 'tomorrow' : dayLabel(day).split(',')[0];
    return `<strong>${capDot(pepName(d.it.peptideId))}${esc(pepName(d.it.peptideId))}</strong> ${esc(when)} ${esc(fmtTime(d.it.time))}`;
  }).join(' · ') : '';
}
function goDay(n) {
  const next = shiftDay(feelDay(), n);
  if (n > 0 && next > shiftDay(todayKey(), MAX_AHEAD)) return;
  flushFeel();
  state.feelDay = next === todayKey() ? null : next;
  const sec = $('todaySec');
  sec.classList.remove('slide-l', 'slide-r');
  void sec.offsetWidth;                // restart the little slide animation
  sec.classList.add(n > 0 ? 'slide-l' : 'slide-r');
  renderToday();
}
$('dayPrev').addEventListener('click', () => goDay(-1));
$('dayNext').addEventListener('click', () => goDay(1));
$('dayToday').addEventListener('click', () => { flushFeel(); state.feelDay = null; renderToday(); });
// Swipe left for the next day, right for the day before. Sliders and text boxes keep their own swipes.
let swipe = null;
$('todaySec').addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1 || e.target.closest('input, textarea, select, .feel-card')) { swipe = null; return; }
  swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
}, { passive: true });
$('todaySec').addEventListener('touchend', (e) => {
  if (!swipe) return;
  const dx = e.changedTouches[0].clientX - swipe.x, dy = e.changedTouches[0].clientY - swipe.y;
  const quick = Date.now() - swipe.t < 700;
  swipe = null;
  if (quick && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) goDay(dx < 0 ? 1 : -1);
}, { passive: true });

function renderFeel() {
  flushFeel(); // a typed-but-unsaved value must reach state before the inputs are redrawn
  const c = checkinFor(feelDay()) || {};
  $('feelFaces').innerHTML = FEEL_KEYS.map(([key, label]) => `
    <div class="face-row" role="group" aria-label="${label}">
      <span class="face-label">${label}</span>
      <div class="faces">${FACES.map(([n, emoji, word]) =>
        `<button type="button" class="face${c[key] === n ? ' on' : ''}" data-key="${key}" data-n="${n}" aria-pressed="${c[key] === n}" aria-label="${label}: ${word}" title="${word}">${emoji}</button>`).join('')}</div>
    </div>`).join('');
  const effects = c.sideEffects || [];
  $('sideChips').innerHTML = SIDE_EFFECTS.map((s) =>
    `<button type="button" class="chip${effects.includes(s) ? ' on' : ''}" data-effect="${esc(s)}" aria-pressed="${effects.includes(s)}">${esc(s)}</button>`).join('');
  $('sideOther').value = c.sideOther || '';
  $('fWeight').value = fmtNum(c.weight);
  $('fWeightUnit').value = c.weight != null && c.weightUnit ? c.weightUnit : state.units.weight;
  $('fWaist').value = fmtNum(c.waist);
  $('fWaistUnit').value = c.waist != null && c.waistUnit ? c.waistUnit : state.units.waist;
  $('feelSaved').textContent = '';
}

$('feelFaces').addEventListener('click', (e) => {
  const b = e.target.closest('.face');
  if (!b) return;
  const key = b.dataset.key, n = +b.dataset.n;
  const cur = checkinFor(feelDay())?.[key];
  saveCheckin({ [key]: cur === n ? null : n }); // tap the chosen face again to clear it
  renderFeel();
  $('feelSaved').textContent = 'Saved';
});
$('sideChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-effect]');
  if (!b) return;
  const cur = checkinFor(feelDay())?.sideEffects || [];
  const s = b.dataset.effect;
  saveCheckin({ sideEffects: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] });
  renderFeel();
  $('feelSaved').textContent = 'Saved';
});
$('sideOther').addEventListener('input', () => saveSoon({ sideOther: $('sideOther').value.trim() }));
$('fWeight').addEventListener('input', () => saveSoon({ weight: num($('fWeight').value), weightUnit: $('fWeightUnit').value }));
$('fWaist').addEventListener('input', () => saveSoon({ waist: num($('fWaist').value), waistUnit: $('fWaistUnit').value }));
['sideOther', 'fWeight', 'fWaist'].forEach((id) => $(id).addEventListener('change', flushFeel));
async function setUnit(kind, unit) {
  state.units = { ...state.units, [kind]: unit };
  await DB.setMeta('units', state.units);
}
$('fWeightUnit').addEventListener('change', () => {
  setUnit('weight', $('fWeightUnit').value);
  if (num($('fWeight').value) != null) saveCheckin({ weight: num($('fWeight').value), weightUnit: $('fWeightUnit').value });
});
$('fWaistUnit').addEventListener('change', () => {
  setUnit('waist', $('fWaistUnit').value);
  if (num($('fWaist').value) != null) saveCheckin({ waist: num($('fWaist').value), waistUnit: $('fWaistUnit').value });
});
