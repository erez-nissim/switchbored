// import.js — loads a catalog CSV into a game's products.
//
//   IMPORTANT: stop the server before running this (the running server holds
//   data in memory and would overwrite the import). Then restart it after.
//
// Usage:
//   node import.js                      # add new items, update existing by name
//   node import.js --reset              # wipe the game's products first, then load
//   node import.js --game "Warframe" --file warframe-catalog.csv
//
import fs from 'node:fs';
import * as db from './db.js';

const arg = (flag, def) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : def; };
const GAME_NAME = arg('--game', 'Diablo II Resurrected');
const FILE = arg('--file', 'd2r-catalog.csv');
const RESET = process.argv.includes('--reset');

// --- tiny RFC-style CSV parser (handles quoted fields, commas, escaped quotes) ---
function parseCSV(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* ignore */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r[0] && r[0].trim() !== ''));
}

// --- locate the game ---
const game = db.listGames().find(g => g.name.toLowerCase() === GAME_NAME.toLowerCase());
if (!game) {
  console.error(`Game "${GAME_NAME}" not found. Start the server once so it seeds, or check the name.`);
  process.exit(1);
}

// --- read + parse ---
const rows = parseCSV(fs.readFileSync(FILE, 'utf8'));
const header = rows.shift().map(h => h.trim().toLowerCase());
const col = (name) => header.indexOf(name);
const iName = col('name'), iChar = col('characteristics'), iCost = col('cost_in_game'), iImg = col('image');
if (iName < 0 || iCost < 0) { console.error('CSV must have at least "name" and "cost_in_game" columns.'); process.exit(1); }

const placeholder = (name) => `https://placehold.co/300x300/1F2738/F5C24B?text=${encodeURIComponent(name)}`;

if (RESET) {
  const removed = db.deleteProductsByGame(game.id);
  console.log(`--reset: removed ${removed} existing product(s) from ${game.name}.`);
}

let added = 0, updated = 0, skipped = 0;
for (const r of rows) {
  const name = (r[iName] || '').trim();
  const cost = Number(r[iCost]);
  if (!name) { skipped++; continue; }
  if (!(cost > 0)) { console.warn(`  skip "${name}" — invalid cost_in_game`); skipped++; continue; }
  const fields = {
    characteristics: (iChar > -1 ? r[iChar] : '').trim(),
    cost_in_game: cost,
    image: (iImg > -1 && r[iImg] && r[iImg].trim()) ? r[iImg].trim() : placeholder(name)
  };
  const existing = db.findProductByName(game.id, name);
  if (existing) { db.updateProduct(existing.id, fields); updated++; }
  else { db.insertProduct({ id: db.newId('p'), game_id: game.id, name, ...fields }); added++; }
}

console.log(`\nDone for ${game.name}: ${added} added, ${updated} updated, ${skipped} skipped.`);
console.log(`Catalog now has ${db.listProducts(game.id).length} items. Restart the server to serve them.`);
