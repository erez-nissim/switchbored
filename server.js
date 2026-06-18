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

// Auto-import full D2R catalog if no products exist yet
{
  const raw = db.getRawData();
  if (Object.keys(raw.products).length === 0) {
    console.log('No products found — running full D2R catalog import...');
    import('./import.js').catch(e => console.error('Import failed:', e.message));
  }
}

const app = express();
app.use(cors());
app.use(express.json());

const h = (fn) => (req, res) => {
  try { res.json(fn(req, res)); }
  catch (e) { res.status(e.code || 500).json({ error: e.message || 'Server error' }); }
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
