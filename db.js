// db.js — storage layer (zero-dependency embedded store).
// data.json holds games, products, trades.
// users.json holds user accounts separately so it survives data.json resets.
import fs from 'node:fs';
import crypto from 'node:crypto';

const FILE       = process.env.DATA_FILE  || 'data.json';
const USERS_FILE = process.env.USERS_FILE || 'users.json';

let data  = loadData();
let users = loadUsers();

function loadData() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    console.log(`Loaded data: ${Object.keys(d.games||{}).length} games, ${Object.keys(d.products||{}).length} products, ${Object.keys(d.trades||{}).length} trades`);
    return { games: d.games||{}, products: d.products||{}, trades: d.trades||{} };
  } catch (e) {
    return { games: {}, products: {}, trades: {} };
  }
}

function loadUsers() {
  try {
    const u = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    console.log(`Loaded ${Object.keys(u).length} users from users.json`);
    return u;
  } catch (e) {
    return {};
  }
}

function persist() {
  fs.writeFileSync(FILE, JSON.stringify({ games: data.games, products: data.products, trades: data.trades }, null, 2));
}
function persistUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export { persist };
export const getRawData = () => ({ games: data.games, products: data.products, trades: data.trades, users });

const values = (m) => Object.values(m);
const copy = (o) => (o ? structuredClone(o) : o);

export const newId = (p) => p + '_' + crypto.randomBytes(6).toString('hex');

export function tx(fn) {
  const snapshot = structuredClone({ ...data, users });
  try { const r = fn(); persist(); return r; }
  catch (e) {
    data = { games: snapshot.games, products: snapshot.products, trades: snapshot.trades };
    users = snapshot.users;
    persist(); persistUsers(); throw e;
  }
}

// ---- games & products ----
export const listGames = () => values(data.games).filter(g => g.active == 1).map(g => ({ id: g.id, name: g.name, url: g.url, image: g.image }));
export const getGame = (id) => copy(data.games[id]) || null;
export const listProducts = (gameId) => values(data.products).filter(p => p.game_id === gameId).sort((a, b) => a.name.localeCompare(b.name)).map(copy);
export const getProduct = (id) => copy(data.products[id]) || null;
export const insertProduct = (p) => { data.products[p.id] = p; persist(); return copy(p); };
export const findProductByName = (gameId, name) => { const p = values(data.products).find(p => p.game_id === gameId && p.name.toLowerCase() === String(name).toLowerCase()); return p ? copy(p) : null; };
export const updateProduct = (id, fields) => { Object.assign(data.products[id], fields); persist(); return copy(data.products[id]); };
export const deleteProductsByGame = (gameId) => { let n = 0; for (const id of Object.keys(data.products)) if (data.products[id].game_id === gameId) { delete data.products[id]; n++; } persist(); return n; };

// ---- users ----
export const getUserByEmail = (email) => { const u = values(users).find(u => u.email === email); return u ? copy(u) : null; };
export const getUserById = (id) => copy(users[id]) || null;
export const insertUser = (u) => { users[u.id] = u; persistUsers(); return copy(u); };
export const setBalance = (userId, amount) => { users[userId].market_gold = amount; persistUsers(); };

// ---- trades ----
export const insertTrade = (t) => { data.trades[t.id] = t; persist(); return copy(t); };
export const getTrade = (id) => copy(data.trades[id]) || null;
export const tradesByGame = (gameId) => values(data.trades).filter(t => t.game_id === gameId).map(copy);
export const tradesForUser = (userId) => values(data.trades).filter(t => t.seller_user_id === userId || t.buyer_user_id === userId).map(copy);
export const updateTradeFields = (id, fields) => { Object.assign(data.trades[id], fields); persist(); return copy(data.trades[id]); };

// ---- seed ----
export function seedIfEmpty() {
  if (values(data.games).length > 0) return;
  const gid = newId('g');
  data.games[gid] = { id: gid, name: 'Diablo II Resurrected',
    url: 'https://diablo2.blizzard.com', active: 1,
    image: 'https://placehold.co/600x400/171D2B/F5C24B?text=Diablo+II+Resurrected' };
  persist();
  console.log('Seeded D2R game entry.');
}
