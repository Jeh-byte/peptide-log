// Starting inventory from Jeh's list (15 Oct 2026). Loaded once on first run; editable in the app.
// vialAmount is the total peptide per vial. Lemon Bottle had no size given.
window.SEED_PEPTIDES = [
  { name: 'GHK-Cu', vialAmount: 100, vialUnit: 'mg', vialCount: 1 },
  { name: 'Cagrilintide', vialAmount: 5, vialUnit: 'mg', vialCount: 1 },
  { name: 'BPC-157', vialAmount: 10, vialUnit: 'mg', vialCount: 1 },
  { name: 'TB-500', vialAmount: 10, vialUnit: 'mg', vialCount: 1 },
  { name: 'CJC-1295 (no DAC)', vialAmount: 10, vialUnit: 'mg', vialCount: 1 },
  { name: 'Epithalon', vialAmount: 10, vialUnit: 'mg', vialCount: 1 },
  { name: 'Ipamorelin', vialAmount: 10, vialUnit: 'mg', vialCount: 1 },
  { name: 'DSIP', vialAmount: 10, vialUnit: 'mg', vialCount: 1 },
  { name: 'Snap-8', vialAmount: 10, vialUnit: 'mg', vialCount: 1 },
  { name: 'KPV', vialAmount: 10, vialUnit: 'mg', vialCount: 2 },
  { name: 'Glutathione', vialAmount: 1500, vialUnit: 'mg', vialCount: 7 },
  { name: 'Semax', vialAmount: 10, vialUnit: 'mg', vialCount: 1 },
  { name: 'Selank', vialAmount: 10, vialUnit: 'mg', vialCount: 1 },
  { name: 'Lemon Bottle', vialAmount: null, vialUnit: 'mg', vialCount: 1 },
  { name: 'SS-31', vialAmount: 10, vialUnit: 'mg', vialCount: 1 },
  { name: 'MOTS-c', vialAmount: 20, vialUnit: 'mg', vialCount: 1 },
  { name: 'Retatrutide 10mg', vialAmount: 10, vialUnit: 'mg', vialCount: 1 },
  { name: 'Retatrutide 20mg', vialAmount: 20, vialUnit: 'mg', vialCount: 1 }
];

// Mixing ingredients, not peptides. Step 2 uses these for reconstitution.
window.SEED_SUPPLIES = [
  { name: 'Bacteriostatic water', amount: 10, unit: 'mL', count: 2 }
];

// Bac water per vial (mL), from Jeh (16 Oct 2026): every vial gets 2 mL except Glutathione, 7.5 mL.
// Applied once to every peptide and every vial already mixed, on new and existing installs; new
// peptides and new mixes default to SEED_MIX_DEFAULT.
window.SEED_MIX_DEFAULT = 2;
window.SEED_MIX = { 'Glutathione': 7.5 };

// Schedules from Jeh's messages (16 Oct 2026). Applied once. Peptides are matched by name; an item
// with no dose takes the last logged dose of that peptide, or opens the log form when tapped.
// Times and the Reta dose were guesses in the message, and are editable under Peptides > Schedule.
window.SEED_SCHEDULES = [
  { name: 'Every morning', rule: 'daily', startDate: '2026-10-16', items: [
    { peptide: 'GHK-Cu', dose: 2.5, doseUnit: 'mg', volume: 5, volumeUnit: 'units', time: '08:00' },
    { peptide: 'KPV', dose: 500, doseUnit: 'mcg', volume: 10, volumeUnit: 'units', time: '08:00' }
  ] },
  { name: 'Semax / Selank', rule: 'rotate', blockDays: 28, startDate: '2026-10-16', items: [
    { peptide: 'Selank', time: '08:00' },
    { peptide: 'Semax', time: '08:00' }
  ] },
  { name: 'Every night', rule: 'daily', startDate: '2026-10-16', items: [
    { peptide: 'SS-31', dose: 2, doseUnit: 'mg', volume: 40, volumeUnit: 'units', time: '21:00' }
  ] },
  { name: 'Alternating days', rule: 'rotate', blockDays: 1, startDate: '2026-10-16', items: [
    { peptide: 'MOTS-c', dose: 5, doseUnit: 'mg', time: '18:00' },
    { peptide: 'Glutathione', dose: 200, doseUnit: 'mg', time: '18:00' }
  ] },
  { name: 'Retatrutide', rule: 'every', every: 6, startDate: '2026-10-17', items: [
    { peptide: 'Retatrutide', dose: 3, doseUnit: 'mg', time: '10:00' }
  ] }
];
