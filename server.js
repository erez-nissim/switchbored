// server.js — HTTP layer only. Routes call services; services hold the logic.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import * as db from './db.js';
import { requireAuth } from './auth.js';
import * as svc from './services.js';

db.seedIfEmpty();

const app = express();
app.use(cors());                 // dev: allow any origin. Restrict in production.
app.use(express.json());

// small wrapper so handlers can throw AppError and return clean JSON
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
app.get('/api/games/:gameId/products', h((req) => svc.searchCatalog(req.params.gameId, req.query.q || '', req.query.category || '')));
app.get('/api/games/:gameId/listings', h((req) => svc.listListings(req.params.gameId, req.query.q || '', req.query.category || '')));
app.get('/api/games/:gameId/activity', h((req) => svc.activityFeed(req.params.gameId, req.query.category || '')));
app.post('/api/games/:gameId/products', requireAuth, h((req) => svc.addProduct(req.user, req.params.gameId, req.body)));
app.post('/api/games/:gameId/listings', requireAuth, h((req) => svc.createListing(req.user, req.params.gameId, req.body)));

// --- trades ---
app.post('/api/trades/:tradeId/buy',     requireAuth, h((req) => svc.buy(req.user, req.params.tradeId, req.body.buyerInGameName)));
app.post('/api/trades/:tradeId/deliver', requireAuth, h((req) => svc.markDelivered(req.user, req.params.tradeId)));
app.post('/api/trades/:tradeId/cancel',  requireAuth, h((req) => svc.cancelTrade(req.user, req.params.tradeId)));

// --- account ---
app.get('/api/me/trades', requireAuth, h((req) => svc.myTrades(req.user)));
app.post('/api/me/topup', requireAuth, h((req) => svc.topUp(req.user, req.body.amount)));

app.get('/', (_req, res) => res.json({ ok: true, service: 'SwitchBored API' }));

// ---- serve frontend (index.html) from root ----
app.use(express.static('.'));
app.get('/', (req, res) => res.sendFile('index.html', { root: '.' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SwitchBored API on http://localhost:${PORT}`));
