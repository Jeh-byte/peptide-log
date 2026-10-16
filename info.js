// ---------- Info tab: My peptides, Library, Guides ----------
state.infoMode = 'mine';
state.libCat = '';

// Library entry for one of my peptides: the longest alias its name starts with.
function libFor(name) {
  const n = normName(name);
  let best = null, len = 0;
  for (const e of window.LIBRARY) for (const a of e.aliases) if (n.startsWith(a) && a.length > len) { best = e; len = a.length; }
  return best;
}
const statusBadge = (e) => `<span class="badge s-${e.status}">${esc(window.LIB_STATUS[e.status])}</span>`;

function setInfoMode(mode) {
  state.infoMode = mode;
  document.querySelectorAll('#infoModes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  ['mine', 'library', 'guides'].forEach((m) => { $(`info-${m}`).hidden = m !== mode; });
  renderInfo();
}
$('infoModes').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setInfoMode(b.dataset.mode); });
function renderInfo() {
  if (state.infoMode === 'library') renderLibrary();
  else if (state.infoMode === 'guides') renderGuides();
  else renderMine();
}

// ---------- My peptides ----------
function protocolLines(p) {
  const lines = [];
  for (const s of state.schedules) {
    if (!s.active) continue;
    for (const it of s.items) {
      if (it.peptideId !== p.id) continue;
      const how = s.rule === 'every' ? `every ${s.every} days` : s.rule === 'rotate' ? (s.blockDays === 1 ? 'alternate days' : `${s.blockDays} days on, taking turns (${s.name})`) : 'every day';
      lines.push(`${itemText(it) || 'Dose not set'} · ${how} at ${fmtTime(it.time)}`);
    }
  }
  const mix = mixFor(p.id);
  if (mix) lines.push(`Mix: ${strengthText(mix)}`);
  const cyc = cycleText(p);
  if (p.cycleOnWeeks) lines.push(`Cycle: ${fmtNum(p.cycleOnWeeks)} weeks on${p.cycleOffWeeks ? ` / ${fmtNum(p.cycleOffWeeks)} off` : ''}${cyc ? ` · ${cyc}` : ''}`);
  return lines;
}
function renderMine() {
  const list = activePeptides();
  $('info-mine').innerHTML = list.map((p) => {
    const lib = libFor(p.name);
    const n = state.entries.filter((e) => e.peptideId === p.id).length;
    const last = lastEntryFor(p.id);
    const proto = protocolLines(p);
    return `<details class="info-card">
      <summary><span class="info-name">${esc(p.name)}</span>${lib ? statusBadge(lib) : ''}<span class="info-sub">${n ? `${n} dose${n === 1 ? '' : 's'} logged · last ${esc(ago(last.takenAt))}` : 'No doses logged yet'}</span></summary>
      ${lib ? `<p>${esc(lib.about)}</p>` : '<p class="subtle-p">Not in the library yet.</p>'}
      <h4>My protocol</h4>
      ${proto.length || p.protocol ? `<ul>${proto.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>${p.protocol ? `<p class="pre">${esc(p.protocol)}</p>` : ''}` : '<p class="subtle-p">Nothing set yet. Add a schedule, the bac water you mix with, a cycle, or notes with Edit.</p>'}
      <h4>My notes</h4>
      <p class="pre">${p.notes ? esc(p.notes) : '<span class="subtle-p">No notes yet.</span>'}</p>
      ${lib ? `<h4>Background</h4>
        <p><strong>Status:</strong> ${esc(lib.statusText)}</p>
        <p><strong>How it’s usually taken:</strong> ${esc(lib.taken)}</p>
        <p><strong>What to watch for:</strong> ${esc(lib.watch)}</p>` : ''}
      <div class="actions">
        <button type="button" class="btn ghost small" data-edit="${esc(p.id)}">Edit</button>
        <button type="button" class="btn ghost small" data-calc="${esc(p.id)}">Calculator</button>
      </div>
    </details>`;
  }).join('') || '<p class="subtle-p">No peptides yet. Add some from the Library.</p>';
}
$('info-mine').addEventListener('click', (e) => {
  const ed = e.target.closest('[data-edit]');
  if (ed) openPeptideDialog(state.peptides.find((p) => p.id === ed.dataset.edit), () => renderMine());
  const c = e.target.closest('[data-calc]');
  if (c) openCalc(c.dataset.calc);
});

// ---------- Library ----------
function renderLibrary() {
  const q = normName($('libSearch').value);
  $('libCats').innerHTML = ['', ...window.LIB_CATEGORIES].map((c) =>
    `<button type="button" class="chip${state.libCat === c ? ' on' : ''}" data-cat="${esc(c)}" aria-pressed="${state.libCat === c}">${esc(c || 'All')}</button>`).join('');
  const mine = new Set(state.peptides.filter((p) => !p.archived).map((p) => libFor(p.name)?.name).filter(Boolean));
  const list = window.LIBRARY.filter((e) => (!state.libCat || e.cat === state.libCat) && (!q || normName(e.name).includes(q) || e.aliases.some((a) => a.includes(q))));
  let html = '', cat = '';
  for (const e of list.slice().sort((a, b) => window.LIB_CATEGORIES.indexOf(a.cat) - window.LIB_CATEGORIES.indexOf(b.cat) || a.name.localeCompare(b.name))) {
    if (e.cat !== cat) { cat = e.cat; html += `<div class="day-h">${esc(cat)}</div>`; }
    html += `<details class="info-card">
      <summary><span class="info-name">${esc(e.name)}</span>${statusBadge(e)}</summary>
      <p>${esc(e.about)}</p>
      <p><strong>Status:</strong> ${esc(e.statusText)}</p>
      <p><strong>How it’s usually taken:</strong> ${esc(e.taken)}</p>
      <p><strong>What to watch for:</strong> ${esc(e.watch)}</p>
      ${mine.has(e.name) ? '<p class="in-mine">✓ In my peptides</p>' : `<button type="button" class="btn ghost small" data-add="${esc(e.name)}">Add to my peptides</button>`}
    </details>`;
  }
  $('libList').innerHTML = html || '<p class="subtle-p">No match.</p>';
}
$('libSearch').addEventListener('input', renderLibrary);
$('libCats').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { state.libCat = b.dataset.cat; renderLibrary(); } });
$('libList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-add]');
  if (!b) return;
  openPeptideDialog(null, () => renderLibrary());
  $('pName').value = b.dataset.add;
  $('pAmount').focus();
});

// ---------- Guides ----------
const GUIDES = [
  ['Mixing a vial', `
    <ol>
      <li>Wash your hands. Wipe the vial tops (peptide and bacteriostatic water) with an alcohol swab and let them dry.</li>
      <li>Draw the amount of bac water you want into a fresh syringe. More water makes each unit weaker and easier to measure; less water means smaller injections.</li>
      <li>Push the needle through the peptide vial’s stopper at an angle and let the water run slowly down the inside wall. Don’t spray it onto the powder.</li>
      <li>Swirl gently or roll the vial between your hands until it’s clear. Don’t shake it.</li>
      <li>Label the vial with the date and how much water you added. In this app, tap <strong>Mix a new vial</strong> (Peptides → the peptide) so the amount left and the units are worked out for you.</li>
      <li>Store it in the fridge.</li>
    </ol>`],
  ['Working out units', `
    <p>On a U-100 insulin syringe, <strong>100 units = 1 mL</strong>.</p>
    <ol>
      <li>Strength = amount in the vial ÷ water added. Example: 10 mg in 2 mL = 5 mg per mL.</li>
      <li>mL to draw = your dose ÷ strength. Example: 0.5 mg ÷ 5 mg/mL = 0.1 mL.</li>
      <li>Units = mL × 100. Example: 0.1 mL = 10 units.</li>
    </ol>
    <p>Watch mg and mcg: 1 mg = 1,000 mcg. The <strong>Calc</strong> tab does this for you.</p>`],
  ['Reading a syringe', `
    <ul>
      <li><strong>0.3 mL (30 units):</strong> each line is usually 1 unit (some have half units). Best for small doses.</li>
      <li><strong>0.5 mL (50 units):</strong> each line is 1 unit.</li>
      <li><strong>1 mL (100 units):</strong> each line is usually 2 units, so small doses are harder to measure.</li>
    </ul>
    <p>Read the dose at the edge of the black rubber plunger nearest the needle, not the far edge. Tap out air bubbles and push them back into the vial before you check the line.</p>`],
  ['Storage', `
    <ul>
      <li><strong>Powder (not mixed):</strong> cool, dry and dark. The fridge is good; the freezer for long-term storage.</li>
      <li><strong>Mixed:</strong> in the fridge (2–8 °C), away from light, never frozen. Most mixed peptides are best used within about 4 weeks, which is why the app warns after 28 days.</li>
      <li>Throw it out if it goes cloudy, changes colour or has bits in it.</li>
      <li>Bacteriostatic water: use within 28 days of first piercing.</li>
    </ul>`],
  ['Injecting and rotating sites', `
    <ol>
      <li>Wash your hands. Use a new needle every time and never share one.</li>
      <li>Clean the skin with an alcohol swab and let it dry.</li>
      <li>Pinch a fold of skin (belly at least 5 cm from the navel, outer thigh or back of the arm).</li>
      <li>Insert the needle at 45–90°, inject slowly, wait a few seconds, then withdraw.</li>
      <li>Put used needles straight into a sharps container.</li>
    </ol>
    <p><strong>Rotate:</strong> move each dose at least 2–3 cm from the last, and switch areas regularly. The injection-site buttons on the Log screen show which site you used last. Repeated use of one spot causes lumps that absorb poorly.</p>`],
  ['Cycling', `
    <p>Many people run peptides in cycles, for example 4 weeks on and 4 weeks off, or short courses once or twice a year. For most research peptides these patterns are convention rather than evidence from trials.</p>
    <p>To track one, set the weeks on and off and the start date with <strong>Edit</strong> on the peptide. The app shows which week you’re in and leaves the peptide off your Today list during off weeks.</p>`],
  ['Staying safe', `
    <ul>
      <li>Most peptides here are not approved medicines, and products sold “for research only” have no quality checks. Ask for third-party test results (purity and endotoxin).</li>
      <li>Tell your doctor what you take, especially with diabetes, heart, kidney or liver disease, or a cancer history, and before surgery.</li>
      <li>Don’t use them if pregnant, trying to conceive or breastfeeding.</li>
      <li>Start one new peptide at a time, so you know what caused any reaction.</li>
      <li>Get help straight away for trouble breathing, swelling of the face or throat, chest pain, severe stomach pain, or a hot, spreading, painful injection site. Call your emergency number (000 in Australia).</li>
      <li>Many are banned in tested sport (WADA).</li>
    </ul>`]
];
function renderGuides() {
  if ($('info-guides').dataset.done) return;
  $('info-guides').innerHTML = GUIDES.map(([title, body]) => `<details class="info-card guide"><summary><span class="info-name">${esc(title)}</span></summary>${body}</details>`).join('');
  $('info-guides').dataset.done = '1';
}

$('robotLink').addEventListener('click', (e) => { e.preventDefault(); openExternal('https://peptiderobot.com'); });
