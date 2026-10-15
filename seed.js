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
