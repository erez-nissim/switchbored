import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as db from './db.js';
import { requireAuth } from './auth.js';
import * as svc from './services.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

db.seedIfEmpty();

// data.json is pre-built with all 1184 items — no runtime import needed

const app = express();
app.use(cors());
app.use(express.json());

const h = (fn) => (req, res) => {
  try { Promise.resolve(fn(req, res)).then(r => res.json(r)).catch(e => res.status(e.status || e.code || 500).json({ error: e.message || 'Server error' })); }
  catch (e) { res.status(e.status || e.code || 500).json({ error: e.message || 'Server error' }); }
};

// --- auth ---
app.post('/api/auth/signup', h((req) => svc.signup(req.body)));
app.post('/api/auth/login',  h((req) => svc.login(req.body)));
app.get('/api/me', requireAuth, h((req) => svc.me(req.user)));

// --- games & catalog ---
app.get('/api/games', h(() => svc.getGames()));
app.get('/api/games/:gameId/categories', h((req) => svc.listCategories(req.params.gameId)));
app.get('/api/games/:gameId/listing-categories', h((req) => svc.listListingCategories(req.params.gameId)));
app.get('/api/games/:gameId/products', h((req) => svc.searchCatalog(req.params.gameId, req.query.q || '', req.query.category || '')));
app.get('/api/games/:gameId/listings', h((req) => svc.listListings(req.params.gameId, req.query.q || '', req.query.category || '')));
app.get('/api/games/:gameId/activity', h((req) => svc.activityFeed(req.params.gameId, req.query.category || '')));
app.post('/api/games/:gameId/products', requireAuth, h((req) => svc.addProduct(req.user, req.params.gameId, req.body)));
app.post('/api/games/:gameId/listings', requireAuth, h((req) => svc.createListing(req.user, req.params.gameId, req.body)));

// --- trades ---
app.post('/api/trades/:tradeId/buy',     requireAuth, h((req) => svc.buy(req.user, req.params.tradeId, req.body.buyerInGameName)));
app.post('/api/trades/:tradeId/deliver', requireAuth, h((req) => svc.markDelivered(req.user, req.params.tradeId)));
app.post('/api/trades/:tradeId/confirm', requireAuth, h((req) => svc.confirmArrival(req.user, req.params.tradeId)));
app.post('/api/trades/:tradeId/cancel',  requireAuth, h((req) => svc.cancelTrade(req.user, req.params.tradeId)));

// --- admin ---
app.post('/api/admin/import', requireAuth, h(async (req) => {
  if (req.user.email !== 'erezn1976@gmail.com') throw { status: 403, message: 'Admin only' };
  console.log('[admin] Manual import triggered by', req.user.email);
  const { runImport } = await import('./import.js');
  await runImport();
  const count = Object.keys(db.getRawData().products).length;
  return { ok: true, message: `Import complete! ${count} products loaded.` };
}));

// --- account ---
app.get('/api/me/trades', requireAuth, h((req) => svc.myTrades(req.user)));
app.post('/api/me/topup', requireAuth, h((req) => svc.topUp(req.user, req.body.amount)));

// ---- serve frontend ----
app.use(express.static(__dirname));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SwitchBored on port ${PORT}`));
