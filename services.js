// services.js — the business logic that used to be split between Apps Script
// and the frontend now lives here: auth, validation, the 50% cap, escrow money
// moves (atomic via transactions), plus all search / sorting / joining.
import * as db from './db.js';
import { hashPassword, checkPassword, signToken, publicUser } from './auth.js';
import { notifySellerOfSale, notifyBuyerOfCompletion } from './email.js';

const SIGNUP_BONUS_MG = 0;
const maxPrice = (costInGame) => Math.floor(Number(costInGame) * 0.5);

class AppError extends Error { constructor(msg, code = 400) { super(msg); this.code = code; } }

// ---- enrichment (the joining/formatting moved off the client) ----
function enrich(trade, productCache, nameCache) {
  const p = productCache[trade.product_id] || (productCache[trade.product_id] = db.getProduct(trade.product_id));
  const sellerName = nameCache[trade.seller_user_id] ||
    (nameCache[trade.seller_user_id] = (db.getUserById(trade.seller_user_id)?.name || '(unknown)'));
  return {
    id: trade.id, gameId: trade.game_id, productId: trade.product_id,
    productName: p?.name || '(removed)', characteristics: p?.characteristics || '',
    image: p?.image || '', costInGame: p ? p.cost_in_game : null,
    category: categoryOf(p?.name, p?.characteristics),
    marketGold: trade.market_gold, sellerUserId: trade.seller_user_id, sellerName,
    buyerUserId: trade.buyer_user_id, buyerInGameName: trade.buyer_ingame_name,
    status: trade.status, itemNotes: trade.item_notes,
    sellerTimestamp: trade.seller_ts || '', buyerTimestamp: trade.buyer_ts || ''
  };
}
// Category derived from the item's own data (no schema change / no re-import needed)
const CATEGORY_ORDER = ['Uniques', 'Runes', 'Runewords', 'Sets', 'Bases', 'Charms', 'Keys & Misc'];
function categoryOf(name, ch) {
  const c = (ch || '').toLowerCase(), n = (name || '').toLowerCase();
  if (c.includes('of 33')) return 'Runes';
  if (c.startsWith('runeword:')) return 'Runewords';
  if (c.startsWith('unique ')) return 'Uniques';
  if (c.includes('set /') || c.includes('set piece') || c.includes("'s set")) return 'Sets';
  if (c.includes('base /')) return 'Bases';
  if (c.includes('charm') || c.includes('jewel') || n.includes('facet')) return 'Charms';
  return 'Keys & Misc';
}
const byLatest = (a, b) => (b.buyerTimestamp || b.sellerTimestamp).localeCompare(a.buyerTimestamp || a.sellerTimestamp);
const hit = (text, q) => !q || text.toLowerCase().includes(q.toLowerCase());
const verbFor = (s) => s === 'Open' ? 'listed' : s === 'Closed' ? 'completed a trade for' : s === 'Cancelled' ? 'cancelled' : 'is trading';

// ---- auth ----
export function signup({ name, email, password }) {
  if (!name || !email || !password) throw new AppError('Name, email and password are required.');
  email = String(email).trim().toLowerCase();
  if (db.getUserByEmail(email)) throw new AppError('An account with that email already exists.');
  const user = db.insertUser({
    id: db.newId('u'), name: String(name).trim(), email,
    password_hash: hashPassword(password), market_gold: SIGNUP_BONUS_MG,
    created_at: new Date().toISOString()
  });
  return { token: signToken(user.id), user: publicUser(user) };
}
export function login({ email, password }) {
  if (!email || !password) throw new AppError('Email and password are required.');
  const user = db.getUserByEmail(String(email).trim().toLowerCase());
  if (!user || !checkPassword(password, user.password_hash)) throw new AppError('Wrong email or password.', 401);
  return { token: signToken(user.id), user: publicUser(user) };
}

// ---- reads (fully prepared for display) ----
export const getGames = () => db.listGames();

export function searchCatalog(gameId, q, category) {       // for the Sell picker
  requireGame(gameId);
  return db.listProducts(gameId)
    .map(p => ({ id: p.id, name: p.name, characteristics: p.characteristics,
      costInGame: p.cost_in_game, image: p.image, maxMarketGold: maxPrice(p.cost_in_game),
      category: categoryOf(p.name, p.characteristics) }))
    .filter(p => (!category || p.category === category) && hit(`${p.name} ${p.characteristics || ''}`, q));
}

// Categories of open listings (for buy tab counts)
export function listListingCategories(gameId) {
  requireGame(gameId);
  const counts = {};
  db.tradesByGame(gameId).filter(t => t.status === 'Open').forEach(t => {
    const p = db.getProduct(t.product_id);
    if (!p) return;
    const k = categoryOf(p.name, p.characteristics);
    counts[k] = (counts[k] || 0) + 1;
  });
  return CATEGORY_ORDER.filter(k => counts[k]).map(k => ({ name: k, count: counts[k] }));
}

// Categories present in a game's catalog, with item counts, in display order.
export function listCategories(gameId) {
  requireGame(gameId);
  const counts = {};
  db.listProducts(gameId).forEach(p => { const k = categoryOf(p.name, p.characteristics); counts[k] = (counts[k] || 0) + 1; });
  return CATEGORY_ORDER.filter(k => counts[k]).map(k => ({ name: k, count: counts[k] }));
}

export function listListings(gameId, q, category) {        // open listings for the Buy view
  requireGame(gameId);
  const pc = {}, nc = {};
  return db.tradesByGame(gameId).filter(t => t.status === 'Open')
    .map(t => enrich(t, pc, nc))
    .filter(t => t.productName !== '(removed)' && (!category || t.category === category) && hit(`${t.productName} ${t.characteristics} ${t.itemNotes || ''}`, q))
    .sort(byLatest);
}

export function activityFeed(gameId, category) {           // recent activity for the game
  requireGame(gameId);
  const pc = {}, nc = {};
  return db.tradesByGame(gameId).map(t => enrich(t, pc, nc))
    .filter(t => t.productName !== '(removed)' && (!category || t.category === category))
    .sort(byLatest).map(t => ({ ...t, verb: verbFor(t.status) })).slice(0, 25);
}

export function myTrades(user) {
  const pc = {}, nc = {};
  const all = db.tradesForUser(user.id).map(t => {
    const e = enrich(t, pc, nc);
    e.gameName = db.getGame(t.game_id)?.name || '';
    return e;
  }).filter(t => t.productName !== '(removed)').sort(byLatest);
  return { selling: all.filter(t => t.sellerUserId === user.id),
           buying: all.filter(t => t.buyerUserId === user.id) };
}

// ---- writes ----
export function addProduct(user, gameId, { name, characteristics, costInGame, imageUrl }) {
  requireGame(gameId);
  const cost = Number(costInGame);
  if (!name) throw new AppError('Item name is required.');
  if (!(cost > 0)) throw new AppError('Cost in game must be a positive number.');
  const p = db.insertProduct({ id: db.newId('p'), game_id: gameId, name: String(name).trim(),
    characteristics: String(characteristics || '').trim(), cost_in_game: cost, image: String(imageUrl || '').trim() });
  return { id: p.id, name: p.name, characteristics: p.characteristics,
    costInGame: p.cost_in_game, image: p.image, maxMarketGold: maxPrice(p.cost_in_game) };
}

export function createListing(user, gameId, { productId, marketGold, itemNotes }) {
  requireGame(gameId);
  const product = db.getProduct(productId);
  if (!product || product.game_id !== gameId) throw new AppError('Product not found.');
  const mg = Math.floor(Number(marketGold));
  const max = maxPrice(product.cost_in_game);
  if (!(mg > 0)) throw new AppError('Market Gold price must be positive.');
  if (mg > max) throw new AppError(`Price too high. Max is ${max} MG (50% of the in-game cost).`);
  let newBalance;
  db.tx(() => {
    const seller = db.getUserById(user.id);
    db.insertTrade({ id: db.newId('t'), game_id: gameId, product_id: productId,
      seller_user_id: user.id, market_gold: mg, buyer_user_id: null,
      seller_ts: new Date().toISOString(), buyer_ts: null, status: 'Open',
      item_notes: String(itemNotes || '').trim(), buyer_ingame_name: null, completed_ts: null });
    newBalance = seller.market_gold + mg;
    db.setBalance(seller.id, newBalance);          // seller is paid the moment they list
  });
  return { ok: true, marketGold: newBalance };
}

export function buy(user, tradeId, buyerInGameName) {
  if (!buyerInGameName) throw new AppError('Your in-game name is required.');
  let newBalance, ctx;
  db.tx(() => {
    const t = db.getTrade(tradeId);
    if (!t) throw new AppError('Trade not found.', 404);
    if (t.status !== 'Open') throw new AppError('This listing is no longer available.');
    if (t.seller_user_id === user.id) throw new AppError('You cannot buy your own listing.');
    const buyer = db.getUserById(user.id);
    if (buyer.market_gold < t.market_gold)
      throw new AppError(`Not enough Market Gold. You need ${t.market_gold - buyer.market_gold} more.`);
    db.setBalance(buyer.id, buyer.market_gold - t.market_gold);   // debit + hold (escrow)
    db.updateTradeFields(tradeId, { buyer_user_id: buyer.id, buyer_ts: new Date().toISOString(),
      status: 'In Progress', buyer_ingame_name: String(buyerInGameName).trim() });
    newBalance = buyer.market_gold - t.market_gold;
    ctx = { t, buyer };
  });
  // email outside the transaction
  const { t, buyer } = ctx;
  const product = db.getProduct(t.product_id), seller = db.getUserById(t.seller_user_id);
  notifySellerOfSale({ seller, buyer, gameName: db.getGame(t.game_id)?.name,
    productName: product?.name, itemNotes: t.item_notes, marketGold: t.market_gold, buyerInGameName });
  return { marketGold: newBalance };
}

export function markDelivered(user, tradeId) {
  let ctx;
  db.tx(() => {
    const t = db.getTrade(tradeId);
    if (!t) throw new AppError('Trade not found.', 404);
    if (t.seller_user_id !== user.id) throw new AppError('Only the seller can confirm delivery.', 403);
    if (t.status !== 'In Progress') throw new AppError('This trade is not awaiting delivery.');
    db.updateTradeFields(tradeId, { status: 'Delivered', completed_ts: new Date().toISOString() });
    ctx = { t };
  });
  const { t } = ctx;
  const buyer = db.getUserById(t.buyer_user_id), product = db.getProduct(t.product_id);
  notifyBuyerOfCompletion({ buyer, gameName: db.getGame(t.game_id)?.name,
    productName: product?.name, marketGold: t.market_gold });
  return { ok: true };
}

export function confirmArrival(user, tradeId) {
  db.tx(() => {
    const t = db.getTrade(tradeId);
    if (!t) throw new AppError('Trade not found.', 404);
    if (t.buyer_user_id !== user.id) throw new AppError('Only the buyer can confirm arrival.', 403);
    if (t.status !== 'Delivered') throw new AppError('Seller has not marked this as delivered yet.');
    db.updateTradeFields(tradeId, { status: 'Closed', completed_ts: new Date().toISOString() });
  });
  return { ok: true };
}

export function cancelTrade(user, tradeId) {
  db.tx(() => {
    const t = db.getTrade(tradeId);
    if (!t) throw new AppError('Trade not found.', 404);
    const isSeller = t.seller_user_id === user.id, isBuyer = t.buyer_user_id === user.id;
    if (!isSeller && !isBuyer) throw new AppError('You are not part of this trade.', 403);
    if (t.status !== 'Open' && t.status !== 'In Progress' && t.status !== 'Delivered') throw new AppError('This trade can no longer be cancelled.');
    if (t.status === 'Open' && !isSeller) throw new AppError('Only the seller can cancel an open listing.', 403);
    const seller = db.getUserById(t.seller_user_id);
    if (seller.market_gold < t.market_gold)
      throw new AppError("You've already spent the gold from this listing, so it can't be cancelled.");
    db.setBalance(seller.id, seller.market_gold - t.market_gold);     // reverse the listing payout
    if (t.status === 'In Progress' || t.status === 'Delivered') {
      const buyer = db.getUserById(t.buyer_user_id);
      db.setBalance(buyer.id, buyer.market_gold + t.market_gold);     // refund the buyer who had paid
    }
    db.updateTradeFields(tradeId, { status: 'Cancelled', completed_ts: new Date().toISOString() });
  });
  return { ok: true };
}

export function topUp(user, amount) {                       // simulated "buy more gold"
  const amt = Math.floor(Number(amount));
  if (!(amt > 0)) throw new AppError('Top-up amount must be positive.');
  const fresh = db.getUserById(user.id);
  const balance = fresh.market_gold + amt;
  db.setBalance(user.id, balance);
  return { marketGold: balance };
}

export const me = (user) => publicUser(user);
function requireGame(id) { if (!db.getGame(id)) throw new AppError('Game not found.', 404); }
export { AppError };
