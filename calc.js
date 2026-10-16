// ---------- Calc tab: how many units to draw ----------
state.calcSyringe = 100; // units the syringe holds (U-100: 0.3 mL = 30, 0.5 mL = 50, 1 mL = 100)

function renderCalcPeptides(selectId) {
  const cur = selectId ?? $('cPep').value;
  const list = activePeptides();
  $('cPep').innerHTML = `<option value="">My own numbers</option>` + list.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  $('cPep').value = list.some((p) => p.id === cur) ? cur : '';
}
// Fill the vial fields from the chosen peptide's mix, and the dose from its usual dose.
function loadCalcPeptide() {
  const pid = $('cPep').value;
  if (!pid) { renderCalc(); return; }
  const p = state.peptides.find((x) => x.id === pid);
  const v = activeVial(pid);
  $('cAmount').value = fmtNum(v?.amount ?? p.vialAmount);
  $('cUnit').value = (v?.unit ?? p.vialUnit) === 'mcg' ? 'mcg' : 'mg';
  $('cWater').value = fmtNum((v?.diluentMl > 0 ? v.diluentMl : null) ?? p.bacWaterMl);
  const last = lastEntryFor(pid);
  const sched = state.schedules.flatMap((s) => s.items).find((it) => it.peptideId === pid && it.dose != null);
  const usual = last?.dose != null ? last : sched;
  if (usual?.dose != null) { $('cDose').value = fmtNum(usual.dose); $('cDoseUnit').value = usual.doseUnit === 'mg' ? 'mg' : 'mcg'; }
  renderCalc();
}
function calcNow() {
  const mix = { amount: num($('cAmount').value), unit: $('cUnit').value, ml: num($('cWater').value) };
  const dose = num($('cDose').value), doseUnit = $('cDoseUnit').value;
  if (!(mix.amount > 0) || !(mix.ml > 0) || !(dose > 0)) return { mix, dose, doseUnit };
  const draw = drawFor(dose, doseUnit, mix);
  const doseInVialUnit = convertDose(dose, doseUnit, mix.unit);
  return { mix, dose, doseUnit, draw, doses: Math.floor(mix.amount / doseInVialUnit + 1e-9) };
}
function syringeSVG(units, cap) {
  const W = 300, H = 64, L = 16, R = 40, bw = W - L - R, top = 14, bh = 22;
  const x = (u) => L + (Math.min(u, cap) / cap) * bw;
  const step = cap <= 50 ? 1 : 2, labelEvery = cap <= 30 ? 5 : 10;
  let ticks = '';
  for (let u = 0; u <= cap; u += step) {
    const big = u % labelEvery === 0;
    ticks += `<line x1="${x(u)}" x2="${x(u)}" y1="${top}" y2="${top + (big ? 10 : 6)}" class="tick"/>`;
    if (big) ticks += `<text x="${x(u)}" y="${top + bh + 14}" text-anchor="middle" class="axis">${u}</text>`;
  }
  const fill = units > 0 ? `<rect x="${L}" y="${top}" width="${x(units) - L}" height="${bh}" class="liquid"/>` : '';
  return `<svg viewBox="0 0 ${W} ${H + 6}" role="img" aria-label="Syringe filled to ${fmtUnits(Math.min(units, cap))} of ${cap} units">
    <rect x="${L}" y="${top}" width="${bw}" height="${bh}" rx="4" class="barrel"/>${fill}${ticks}
    <rect x="${x(units) - 1.5}" y="${top - 4}" width="3" height="${bh + 8}" rx="1.5" class="plunger"/>
    <line x1="${L + bw}" x2="${W - 6}" y1="${top + bh / 2}" y2="${top + bh / 2}" class="needle"/>
  </svg>`;
}
function renderCalc() {
  document.querySelectorAll('#cSyringe button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.cap === state.calcSyringe)));
  const r = calcNow();
  const ok = !!r.draw;
  $('cUnits').textContent = ok ? fmtUnits(r.draw.units) : '–';
  $('cMl').textContent = ok ? `${fmtAmt(r.draw.ml)} mL` : '';
  $('cStrength').textContent = r.mix.amount > 0 && r.mix.ml > 0 ? `Strength: ${strengthText(r.mix)}` : 'Enter the amount in the vial and the bac water added.';
  $('cDoses').textContent = ok ? `About ${r.doses} dose${r.doses === 1 ? '' : 's'} of ${fmtNum(r.dose)} ${r.doseUnit} in the vial` : '';
  const warn = [];
  if (r.dose > 0 && r.mix.amount > 0 && r.mix.ml > 0 && !ok) warn.push('Those units don’t convert: pick mg or mcg for both the vial and the dose.');
  if (ok && r.draw.units > state.calcSyringe) warn.push(`That’s more than a ${state.calcSyringe}-unit syringe holds. Use a bigger syringe or split it.`);
  if (ok && r.draw.units < 2) warn.push('Under 2 units is hard to measure accurately. Adding more bac water makes each unit weaker and easier to measure.');
  $('cWarn').textContent = warn.join(' ');
  $('cWarn').hidden = !warn.length;
  $('cSyr').innerHTML = ok ? syringeSVG(r.draw.units, state.calcSyringe) : '';
  $('cLog').disabled = !$('cPep').value || !(r.dose > 0);
  $('cSave').disabled = !$('cPep').value || !(r.mix.amount > 0) || !(r.mix.ml > 0);
}
$('cPep').addEventListener('change', loadCalcPeptide);
['cAmount', 'cWater', 'cDose'].forEach((id) => $(id).addEventListener('input', renderCalc));
['cUnit', 'cDoseUnit'].forEach((id) => $(id).addEventListener('change', renderCalc));
$('cSyringe').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { state.calcSyringe = +b.dataset.cap; renderCalc(); } });

$('cLog').addEventListener('click', () => {
  const r = calcNow();
  const pid = $('cPep').value;
  resetForm(false);
  renderPeptideSelect(pid);
  onPeptideChosen();
  $('fDose').value = fmtNum(r.dose);
  $('fDoseUnit').value = r.doseUnit;
  if (r.draw) { $('fVolume').value = fmtUnits(r.draw.units); $('fVolumeUnit').value = 'units'; state.volManual = true; }
  renderVolHint();
  show('log');
  $('logForm').scrollIntoView();
});
$('cSave').addEventListener('click', async () => {
  const pid = $('cPep').value;
  const p = state.peptides.find((x) => x.id === pid);
  if (!p) return;
  const amount = num($('cAmount').value), unit = $('cUnit').value, ml = num($('cWater').value);
  const rec = await DB.put('peptides', { ...p, vialAmount: amount, vialUnit: unit, bacWaterMl: ml });
  state.peptides = state.peptides.map((x) => (x.id === rec.id ? rec : x));
  const v = activeVial(pid);
  if (v) {
    const vr = await DB.put('vials', { ...v, amount, unit, diluentMl: ml });
    state.vials = state.vials.map((x) => (x.id === vr.id ? vr : x));
  }
  toast(`Saved ${p.name}: ${fmtAmt(amount)} ${unit} + ${fmtAmt(ml)} mL`);
  renderAlerts();
});
function openCalc(pid) {
  renderCalcPeptides(pid || '');
  show('calc');
  if (pid) loadCalcPeptide(); else renderCalc();
}

// ---------- Log form: units fill in from the dose ----------
// Once you type a volume yourself, the app leaves it alone until the form is cleared.
state.volManual = false;
function autoUnits() {
  const pid = $('fPeptide').value;
  const mix = pid && mixFor(pid);
  const dose = num($('fDose').value);
  $('autoHint').hidden = true;
  if (state.volManual || !mix || !(dose > 0)) return;
  const d = drawFor(dose, $('fDoseUnit').value, mix);
  if (!d) return;
  $('fVolume').value = fmtUnits(d.units);
  $('fVolumeUnit').value = 'units';
  $('autoHint').textContent = `Units worked out from ${fmtAmt(mix.amount)} ${mix.unit} in ${fmtAmt(mix.ml)} mL`;
  $('autoHint').hidden = false;
  renderVolHint();
}
$('fDose').addEventListener('input', autoUnits);
$('fDoseUnit').addEventListener('change', autoUnits);
$('fPeptide').addEventListener('change', autoUnits);
$('fVolume').addEventListener('input', () => { state.volManual = $('fVolume').value !== ''; $('autoHint').hidden = true; });
