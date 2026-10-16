// ---------- History: List / Calendar / Progress ----------
const HIST_MODES = ['list', 'calendar', 'progress'];
state.histMode = 'list';
state.calMonth = null; // 'YYYY-MM'; null = this month
state.calDay = null;
state.progRange = 90;

function setHistMode(mode) {
  state.histMode = mode;
  document.querySelectorAll('#histModes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  HIST_MODES.forEach((m) => { $(`hist-${m}`).hidden = m !== mode; });
  renderHistory();
}
$('histModes').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setHistMode(b.dataset.mode); });

const isReta = (pid) => /reta/i.test(state.peptides.find((p) => p.id === pid)?.name || '');
const KG_PER_LB = 0.45359237, CM_PER_IN = 2.54;
const weightIn = (c, unit) => (c.weight == null ? null : (c.weightUnit || 'kg') === unit ? c.weight : unit === 'kg' ? c.weight * KG_PER_LB : c.weight / KG_PER_LB);
const waistIn = (c, unit) => (c.waist == null ? null : (c.waistUnit || 'cm') === unit ? c.waist : unit === 'cm' ? c.waist * CM_PER_IN : c.waist / CM_PER_IN);
const keyDate = (k) => { const [Y, M, D] = k.split('-').map(Number); return new Date(Y, M - 1, D); };
const shortDate = (k) => keyDate(k).toLocaleDateString([], { day: 'numeric', month: 'short' });

// ---------- calendar ----------
function renderCalendar() {
  const today = todayKey();
  const month = state.calMonth || today.slice(0, 7);
  const [Y, M] = month.split('-').map(Number);
  $('calTitle').textContent = new Date(Y, M - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
  $('calNext').disabled = month >= today.slice(0, 7);

  const counts = {};
  for (const e of state.entries) { const k = dayKey(e.takenAt); if (k.startsWith(month)) counts[k] = (counts[k] || 0) + 1; }
  const lead = (new Date(Y, M - 1, 1).getDay() + 6) % 7; // weeks start on Monday
  const days = new Date(Y, M, 0).getDate();
  const weekdays = [...Array(7)].map((_, i) => new Date(2024, 0, 1 + i).toLocaleDateString([], { weekday: 'narrow' }));
  let html = weekdays.map((w) => `<div class="cal-wd" aria-hidden="true">${esc(w)}</div>`).join('') + '<div></div>'.repeat(lead);
  for (let d = 1; d <= days; d++) {
    const k = `${month}-${String(d).padStart(2, '0')}`;
    const n = counts[k] || 0;
    const face = faceFor(checkinFor(k)?.mood);
    const label = `${keyDate(k).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}: ${n} dose${n === 1 ? '' : 's'}${face ? `, mood ${face[2]}` : ''}`;
    html += `<button type="button" class="cal-day${k === today ? ' today' : ''}${k === state.calDay ? ' sel' : ''}${k > today ? ' future' : ''}" data-day="${k}" aria-label="${esc(label)}" aria-pressed="${k === state.calDay}">
      <span class="cal-num">${d}</span>
      <span class="cal-mood" aria-hidden="true">${face ? face[1] : ''}</span>
      ${n ? `<span class="cal-count" aria-hidden="true">${n}</span>` : ''}
    </button>`;
  }
  $('calGrid').innerHTML = html;
  renderCalDetail();
}
function renderCalDetail() {
  const k = state.calDay;
  if (!k) { $('calDetail').innerHTML = `<p class="subtle-p">Tap a day to see the details.</p>`; return; }
  const names = Object.fromEntries(state.peptides.map((p) => [p.id, p.name]));
  const doses = state.entries.filter((e) => dayKey(e.takenAt) === k).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const c = checkinFor(k);
  const feel = c ? FEEL_KEYS.filter(([key]) => c[key]).map(([key, label]) => `${label} ${faceFor(c[key])[1]} ${faceFor(c[key])[2]}`) : [];
  const effects = c ? [...(c.sideEffects || []), c.sideOther].filter(Boolean) : [];
  const body = [
    feel.length ? `<p>${esc(feel.join(' · '))}</p>` : '',
    effects.length ? `<p><strong>Side effects:</strong> ${esc(effects.join(', '))}</p>` : '',
    c?.weight != null ? `<p><strong>Weight:</strong> ${esc(fmtNum(c.weight))} ${esc(c.weightUnit || 'kg')}</p>` : '',
    c?.waist != null ? `<p><strong>Waist:</strong> ${esc(fmtNum(c.waist))} ${esc(c.waistUnit || 'cm')}</p>` : ''
  ].join('');
  $('calDetail').innerHTML = `
    <div class="day-h">${esc(dayLabel(k))}</div>
    ${doses.map((e) => `<button type="button" class="card compact" data-id="${esc(e.id)}">
      <div class="line1"><span>${esc(names[e.peptideId] || e.peptideName)}</span><span class="time">${esc(timeStr(e.takenAt))}</span></div>
      <div class="line2">${esc(entrySummary(e))}</div></button>`).join('') || '<p class="subtle-p">No doses on this day.</p>'}
    <div class="cal-feel">${body || '<p class="subtle-p">Nothing recorded under How I feel.</p>'}</div>
    ${k <= todayKey() ? `<button type="button" class="btn ghost small" id="calEditFeel">${c ? 'Edit' : 'Add'} how I felt</button>` : ''}`;
}
$('calGrid').addEventListener('click', (e) => {
  const b = e.target.closest('.cal-day');
  if (!b || b.classList.contains('future')) return;
  state.calDay = state.calDay === b.dataset.day ? null : b.dataset.day;
  renderCalendar();
});
$('calDetail').addEventListener('click', (e) => {
  const c = e.target.closest('.card');
  if (c) { editEntry(c.dataset.id); return; }
  if (e.target.closest('#calEditFeel')) {
    state.feelDay = state.calDay === todayKey() ? null : state.calDay;
    show('log');
    renderToday();
    $('todaySec').scrollIntoView();
  }
});
function moveMonth(n) {
  const [Y, M] = (state.calMonth || todayKey().slice(0, 7)).split('-').map(Number);
  const d = new Date(Y, M - 1 + n, 1);
  state.calMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  state.calDay = null;
  renderCalendar();
}
$('calPrev').addEventListener('click', () => moveMonth(-1));
$('calNext').addEventListener('click', () => moveMonth(1));

// ---------- progress ----------
function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

// A line chart with an optional row of day marks under the plot. Tap or drag to read a day.
// opts: { label, days: [{k, values: {key: n|null}, mark: bool}], series: [{key, label, color}],
//         yTicks, yFmt, markLabel, markColor, tip(day) -> {title, rows: [{label, value, color, mark}]} }
function lineChart(box, opts) {
  const W = Math.max(280, box.clientWidth || 320), H = 190, L = 40, R = 12, T = 10, B = opts.markLabel ? 44 : 26;
  const pw = W - L - R, ph = H - T - B;
  const days = opts.days;
  const t0 = keyDate(days[0].k).getTime(), t1 = keyDate(days[days.length - 1].k).getTime();
  const x = (k) => L + (t1 === t0 ? pw / 2 : ((keyDate(k).getTime() - t0) / (t1 - t0)) * pw);
  const yMin = opts.yTicks[0], yMax = opts.yTicks[opts.yTicks.length - 1];
  const y = (v) => T + ph - ((v - yMin) / (yMax - yMin)) * ph;

  let svg = '';
  for (const t of opts.yTicks) {
    svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/>`;
    svg += `<text class="axis" x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${esc(opts.yFmt(t))}</text>`;
  }
  const xl = [days[0], days[Math.floor((days.length - 1) / 2)], days[days.length - 1]].filter((d, i, a) => a.indexOf(d) === i);
  xl.forEach((d, i) => {
    const anchor = xl.length === 1 ? 'middle' : i === 0 ? 'start' : i === xl.length - 1 ? 'end' : 'middle';
    svg += `<text class="axis" x="${x(d.k)}" y="${H - 6}" text-anchor="${anchor}">${esc(shortDate(d.k))}</text>`;
  });
  if (opts.markLabel) {
    const my = T + ph + 10;
    for (const d of days) if (d.mark) svg += `<rect x="${x(d.k) - 1.5}" y="${my}" width="3" height="10" rx="1.5" fill="${opts.markColor}"/>`;
  }
  for (const s of opts.series) {
    const pts = days.filter((d) => d.values[s.key] != null);
    if (!pts.length) continue;
    // one continuous line through the days that have a value; dots when there are few points
    svg += `<path d="${pts.map((d, i) => `${i ? 'L' : 'M'}${x(d.k).toFixed(1)},${y(d.values[s.key]).toFixed(1)}`).join('')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const dots = pts.length <= 40 ? pts : [pts[pts.length - 1]];
    for (const d of dots) svg += `<circle cx="${x(d.k)}" cy="${y(d.values[s.key])}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`;
  }
  svg += `<line class="cross" id="${box.id}-cross" x1="0" x2="0" y1="${T}" y2="${T + ph + (opts.markLabel ? 20 : 0)}" visibility="hidden"/>`;
  svg += `<g id="${box.id}-hl"></g>`;

  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(opts.label)}">${svg}</svg><div class="tip" hidden></div>`;
  box.tabIndex = 0;
  const svgEl = box.querySelector('svg'), tip = box.querySelector('.tip');
  const cand = days.filter((d) => d.mark || opts.series.some((s) => d.values[s.key] != null));
  let idx = -1;
  function showAt(i) {
    if (!cand.length) return;
    idx = Math.max(0, Math.min(cand.length - 1, i));
    const d = cand[idx], cx = x(d.k);
    const cross = box.querySelector(`#${box.id}-cross`);
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    box.querySelector(`#${box.id}-hl`).innerHTML = opts.series.filter((s) => d.values[s.key] != null)
      .map((s) => `<circle cx="${cx}" cy="${y(d.values[s.key])}" r="5" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`).join('');
    const info = opts.tip(d);
    tip.replaceChildren();
    const h = document.createElement('div'); h.className = 'tip-h'; h.textContent = info.title; tip.append(h);
    for (const r of info.rows) {
      const row = document.createElement('div'); row.className = 'tip-row';
      const key = document.createElement('span'); key.className = r.mark ? 'key-mark' : 'key-line'; key.style.background = r.color;
      const v = document.createElement('strong'); v.textContent = r.value;
      const l = document.createElement('span'); l.textContent = r.label;
      row.append(key, v, l); tip.append(row);
    }
    tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.max(0, Math.min(W - tw, cx - tw / 2))}px`;
  }
  const nearest = (px) => {
    let best = 0, bd = Infinity;
    cand.forEach((d, i) => { const dd = Math.abs(x(d.k) - px); if (dd < bd) { bd = dd; best = i; } });
    return best;
  };
  const toX = (ev) => ((ev.clientX - svgEl.getBoundingClientRect().left) / svgEl.getBoundingClientRect().width) * W;
  svgEl.addEventListener('pointerdown', (ev) => showAt(nearest(toX(ev))));
  svgEl.addEventListener('pointermove', (ev) => { if (ev.pointerType === 'mouse' || ev.buttons) showAt(nearest(toX(ev))); });
  box.onkeydown = (ev) => {
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { ev.preventDefault(); showAt(idx < 0 ? cand.length - 1 : idx + (ev.key === 'ArrowRight' ? 1 : -1)); }
    if (ev.key === 'Escape') { tip.hidden = true; box.querySelector(`#${box.id}-cross`).setAttribute('visibility', 'hidden'); }
  };
  box.showAt = showAt;
}

function statTile(label, unit, vals) {
  if (!vals.length) return `<div class="tile"><div class="tile-l">${esc(label)}</div><div class="tile-v">–</div><div class="tile-d">Not logged in this period</div></div>`;
  const first = vals[0], last = vals[vals.length - 1];
  const diff = last.v - first.v;
  const d = vals.length > 1 ? `${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${fmtAmt(Math.abs(diff))} ${unit} since ${shortDate(first.k)}` : `on ${shortDate(last.k)}`;
  return `<div class="tile"><div class="tile-l">${esc(label)}</div><div class="tile-v">${esc(fmtAmt(last.v))} ${esc(unit)}</div><div class="tile-d">${esc(d)}</div></div>`;
}

function renderProgress() {
  document.querySelectorAll('#progRange button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.days === state.progRange)));
  const wu = state.units.weight, cu = state.units.waist;
  const today = todayKey();
  const retaDays = {};
  for (const e of state.entries) if (isReta(e.peptideId)) (retaDays[dayKey(e.takenAt)] ||= []).push(e);
  const ck = Object.fromEntries(state.checkins.map((c) => [c.id, c]));
  let start;
  if (state.progRange) start = shiftDay(today, -(state.progRange - 1));
  else {
    const keys = [...Object.keys(retaDays), ...state.checkins.filter((c) => c.weight != null || c.sleep || c.energy || c.mood).map((c) => c.id)].sort();
    start = keys[0] && keys[0] < today ? keys[0] : shiftDay(today, -29);
  }
  const days = [];
  for (let k = start; k <= today; k = shiftDay(k, 1)) days.push(k);

  const weights = days.map((k) => ({ k, v: ck[k] ? weightIn(ck[k], wu) : null })).filter((d) => d.v != null);
  const waists = days.map((k) => ({ k, v: ck[k] ? waistIn(ck[k], cu) : null })).filter((d) => d.v != null);
  $('progTiles').innerHTML = statTile('Weight', wu, weights) + statTile('Waist', cu, waists);

  // weight chart
  const retaText = (k) => (retaDays[k] || []).map((e) => entrySummary(e).split(' · ')[0] || 'dose').join(', ');
  if (!weights.length) {
    $('weightChart').innerHTML = `<p class="empty-chart">No weight logged in this period. Add it under How I feel on the Log tab.</p>`;
  } else {
    const vs = weights.map((d) => d.v);
    const lo = Math.min(...vs), hi = Math.max(...vs), pad = Math.max(0.5, (hi - lo) * 0.15);
    lineChart($('weightChart'), {
      label: `Weight in ${wu} over ${days.length} days, with Reta dose days marked underneath`,
      days: days.map((k) => ({ k, values: { w: ck[k] ? weightIn(ck[k], wu) : null }, mark: !!retaDays[k] })),
      series: [{ key: 'w', label: `Weight (${wu})`, color: 'var(--s1)' }],
      yTicks: niceTicks(lo - pad, hi + pad), yFmt: (t) => fmtNum(t),
      markLabel: 'Reta dose', markColor: 'var(--s2)',
      tip: (d) => ({ title: dayLabel(d.k), rows: [
        ...(d.values.w != null ? [{ label: `weight (${wu})`, value: fmtAmt(d.values.w), color: 'var(--s1)' }] : []),
        ...(d.mark ? [{ label: 'Reta', value: retaText(d.k), color: 'var(--s2)', mark: true }] : [])
      ] })
    });
  }
  // how-I-feel chart
  const FEEL_COLORS = { sleep: 'var(--s1)', energy: 'var(--s2)', mood: 'var(--s3)' };
  const anyFeel = days.some((k) => ck[k] && (ck[k].sleep || ck[k].energy || ck[k].mood));
  if (!anyFeel) {
    $('feelChart').innerHTML = `<p class="empty-chart">Nothing logged under How I feel in this period.</p>`;
  } else {
    lineChart($('feelChart'), {
      label: `Sleep, energy and mood from 1 (awful) to 5 (great) over ${days.length} days`,
      days: days.map((k) => ({ k, values: Object.fromEntries(FEEL_KEYS.map(([key]) => [key, ck[k]?.[key] || null])) })),
      series: FEEL_KEYS.map(([key, label]) => ({ key, label, color: FEEL_COLORS[key] })),
      yTicks: [1, 2, 3, 4, 5], yFmt: (t) => faceFor(t)[1],
      tip: (d) => ({ title: dayLabel(d.k), rows: FEEL_KEYS.filter(([key]) => d.values[key]).map(([key, label]) =>
        ({ label: `${label.toLowerCase()} · ${faceFor(d.values[key])[2]}`, value: String(d.values[key]), color: FEEL_COLORS[key] })) })
    });
  }

  // the same numbers as a table, newest first
  const rows = days.slice().reverse().filter((k) => ck[k] || retaDays[k]).map((k) => {
    const c = ck[k] || {};
    const cell = (v) => `<td>${v == null || v === '' ? '' : esc(v)}</td>`;
    return `<tr><th scope="row">${esc(shortDate(k))}</th>${cell(c.weight != null ? fmtAmt(weightIn(c, wu)) : null)}${cell(c.waist != null ? fmtAmt(waistIn(c, cu)) : null)}${cell(retaDays[k] ? retaText(k) : null)}${cell(c.sleep)}${cell(c.energy)}${cell(c.mood)}</tr>`;
  });
  $('progTable').innerHTML = rows.length
    ? `<table><thead><tr><th scope="col">Day</th><th scope="col">Weight (${esc(wu)})</th><th scope="col">Waist (${esc(cu)})</th><th scope="col">Reta</th><th scope="col">Sleep</th><th scope="col">Energy</th><th scope="col">Mood</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
    : '<p class="subtle-p">Nothing logged in this period.</p>';
}
$('progRange').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { state.progRange = +b.dataset.days; renderProgress(); } });
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (state.histMode === 'progress' && $('view-history').classList.contains('active')) renderProgress(); }, 150);
});
