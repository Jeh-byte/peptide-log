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
// Selank: 10 units from Jeh (22 Oct 2026); 500 mcg at 10 mg in 2 mL.
window.SEED_SELANK = { dose: 500, doseUnit: 'mcg', volume: 10, volumeUnit: 'units' };
// BPC-157 and TB-500: 10 units every night from Jeh (23 Oct 2026); 500 mcg at 10 mg in 2 mL.
// Added once to the 'Every night' schedule on existing installs too.
window.SEED_NIGHTLY = [
  { peptide: 'BPC-157', dose: 500, doseUnit: 'mcg', volume: 10, volumeUnit: 'units', time: '21:00' },
  { peptide: 'TB-500', dose: 500, doseUnit: 'mcg', volume: 10, volumeUnit: 'units', time: '21:00' }
];
// SS-31 came off the cycle (Jeh, 25 Oct 2026). Removed once from every schedule on existing installs;
// the peptide, its vials and its logged doses stay.
window.SEED_UNSCHEDULE = ['SS-31'];
window.SEED_SCHEDULES = [
  { name: 'Every morning', rule: 'daily', startDate: '2026-10-16', items: [
    { peptide: 'GHK-Cu', dose: 2.5, doseUnit: 'mg', volume: 5, volumeUnit: 'units', time: '08:00' },
    { peptide: 'KPV', dose: 500, doseUnit: 'mcg', volume: 10, volumeUnit: 'units', time: '08:00' }
  ] },
  { name: 'Semax / Selank', rule: 'rotate', blockDays: 28, startDate: '2026-10-16', items: [
    { peptide: 'Selank', dose: 500, doseUnit: 'mcg', volume: 10, volumeUnit: 'units', time: '08:00' },
    { peptide: 'Semax', time: '08:00' }
  ] },
  { name: 'Every night', rule: 'daily', startDate: '2026-10-16', items: [
    ...window.SEED_NIGHTLY
  ] },
  { name: 'Alternating days', rule: 'rotate', blockDays: 1, startDate: '2026-10-16', items: [
    { peptide: 'MOTS-c', dose: 5, doseUnit: 'mg', time: '18:00' },
    { peptide: 'Glutathione', dose: 200, doseUnit: 'mg', time: '18:00' }
  ] },
  { name: 'Retatrutide', rule: 'every', every: 6, startDate: '2026-10-17', items: [
    { peptide: 'Retatrutide', dose: 3, doseUnit: 'mg', time: '10:00' }
  ] }
];

// Tablets and supplements from Jeh (20 Oct 2026). Applied once, on new and existing installs.
// kind 'oral': no vial or mixing; ticking one off on Today logs it straight away. No doses were
// given, so none are set; add them under Peptides > Schedule.
window.SEED_ORAL = [
  { name: 'Cymbalta', time: '08:00', schedule: 'Cymbalta with breakfast', notes: 'With breakfast, alongside GHK-Cu.' },
  { name: 'Iron + vitamin C', time: '15:00', schedule: 'Iron + vitamin C', notes: '' },
  { name: 'Zinc + vitamin D', time: '18:30', schedule: 'Zinc + vitamin D with dinner', notes: 'With dinner.' }
];
