// reset-listings.js — delete ALL listings/trades for a clean slate.
// Keeps your accounts, games, and catalog. Run with the server STOPPED:
//   node reset-listings.js
import fs from 'node:fs';

const FILE = process.env.DATA_FILE || 'data.json';
let data;
try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
catch { console.log(`No ${FILE} found — nothing to clear.`); process.exit(0); }

const n = Object.keys(data.trades || {}).length;
data.trades = {};
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
console.log(`Removed ${n} listing(s). Accounts, games and catalog are untouched.`);
