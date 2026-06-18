// db.js — storage layer (zero-dependency embedded store).
// No native build, no DB server: data lives in a single JSON file.
// Money operations are synchronous, and the server is a single process, so a
// read-modify-write runs without interleaving = atomic in practice. tx() adds
// snapshot/rollback on error. All storage is isolated here: to move to real
// SQLite or Postgres later, reimplement these exports and nothing else changes.
import fs from 'node:fs';
import crypto from 'node:crypto';

const FILE = process.env.DATA_FILE || 'data.json';
let data = load();

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { games: {}, products: {}, users: {}, trades: {} }; }
}
function persist() { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
export { persist };
export const getRawData = () => data;
const values = (m) => Object.values(m);
const copy = (o) => (o ? structuredClone(o) : o);   // hand out snapshots, not live refs

export const newId = (p) => p + '_' + crypto.randomBytes(6).toString('hex');

// run a multi-step mutation atomically; rolls back the whole store on throw
export function tx(fn) {
  const snapshot = structuredClone(data);
  try { const r = fn(); persist(); return r; }
  catch (e) { data = snapshot; persist(); throw e; }
}

// ---- games & products ----
export const listGames = () => values(data.games).filter(g => g.active).map(g => ({ id: g.id, name: g.name, url: g.url, image: g.image }));
export const getGame = (id) => copy(data.games[id]) || null;
export const listProducts = (gameId) => values(data.products).filter(p => p.game_id === gameId).sort((a, b) => a.name.localeCompare(b.name)).map(copy);
export const getProduct = (id) => copy(data.products[id]) || null;
export const insertProduct = (p) => { data.products[p.id] = p; persist(); return copy(p); };
export const findProductByName = (gameId, name) => { const p = values(data.products).find(p => p.game_id === gameId && p.name.toLowerCase() === String(name).toLowerCase()); return p ? copy(p) : null; };
export const updateProduct = (id, fields) => { Object.assign(data.products[id], fields); persist(); return copy(data.products[id]); };
export const deleteProductsByGame = (gameId) => { let n = 0; for (const id of Object.keys(data.products)) if (data.products[id].game_id === gameId) { delete data.products[id]; n++; } persist(); return n; };

// ---- users ----
export const getUserByEmail = (email) => { const u = values(data.users).find(u => u.email === email); return u ? copy(u) : null; };
export const getUserById = (id) => copy(data.users[id]) || null;
export const insertUser = (u) => { data.users[u.id] = u; persist(); return copy(u); };
export const setBalance = (userId, amount) => { data.users[userId].market_gold = amount; persist(); };

// ---- trades ----
export const insertTrade = (t) => { data.trades[t.id] = t; persist(); return copy(t); };
export const getTrade = (id) => copy(data.trades[id]) || null;
export const tradesByGame = (gameId) => values(data.trades).filter(t => t.game_id === gameId).map(copy);
export const tradesForUser = (userId) => values(data.trades).filter(t => t.seller_user_id === userId || t.buyer_user_id === userId).map(copy);
export const updateTradeFields = (id, fields) => { Object.assign(data.trades[id], fields); persist(); return copy(data.trades[id]); };

// ---- one-time seed ----
export function seedIfEmpty() {
  if (values(data.games).length > 0) return;
  const seed = [
    { name: 'Diablo II Resurrected', url: 'https://diablo2.blizzard.com',
      products: [['Enigma Runeword','Body armor, +2 skills, Teleport',8000],['Stone of Jordan','Unique ring, +1 skills, +mana',2000],['Harlequin Crest (Shako)','Unique helm, +2 skills, all res',3000]] },
    { name: 'Warframe', url: 'https://www.warframe.com',
      products: [['Primed Flow','Mod, +energy capacity',1500],['Arcane Energize','Arcane, energy on pickup',6000],['Riven Mod (Rifle)','Randomized stat mod',5000]] },
    { name: 'Elder Scrolls Online', url: 'https://www.elderscrollsonline.com',
      products: [['Perfected Maelstrom Bow','Weapon, increased damage proc',4000],['Slimecraw Monster Set','Shoulder, minor berserk',1200]] }
  ];
  for (const g of seed) {
    const gid = newId('g');
    data.games[gid] = { id: gid, name: g.name, url: g.url, active: 1,
      image: `https://placehold.co/600x400/171D2B/F5C24B?text=${encodeURIComponent(g.name)}` };
    for (const [name, characteristics, cost] of g.products) {
      const pid = newId('p');
      data.products[pid] = { id: pid, game_id: gid, name, characteristics, cost_in_game: cost,
        image: `https://placehold.co/300x300/1F2738/F5C24B?text=${encodeURIComponent(name)}` };
    }
  }
  persist();
  console.log('Seeded sample games + products.');
}
