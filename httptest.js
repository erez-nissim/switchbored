process.env.PORT = '3210';
process.env.DATA_FILE = 'httptest.json';
import fs from 'node:fs';
try { fs.unlinkSync('httptest.json'); } catch {}

await import('./server.js');           // starts app.listen
await new Promise(r => setTimeout(r, 400));

const B = 'http://localhost:3210/api';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
const get = (p, tok) => fetch(B + p, { headers: tok ? { Authorization: 'Bearer ' + tok } : {} }).then(r => r.json());
const post = (p, body, tok) => fetch(B + p, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, json: await r.json() }));

const games = await get('/games');
ok(Array.isArray(games) && games.length === 3, 'GET /games returns 3 seeded games');
const gid = games[0].id;

const seller = (await post('/auth/signup', { name: 'S', email: 's2@x.com', password: 'pw' })).json;
const buyer = (await post('/auth/signup', { name: 'B', email: 'b2@x.com', password: 'pw' })).json;
ok(seller.token && buyer.token, 'POST /auth/signup returns tokens');

const noauth = await post(`/games/${gid}/listings`, { productId: 'x', marketGold: 1 });
ok(noauth.status === 401, 'listing without token -> 401');

const products = await get(`/games/${gid}/products`);
const prod = products[0];
const over = await post(`/games/${gid}/listings`, { productId: prod.id, marketGold: prod.maxMarketGold + 1 }, seller.token);
ok(over.status === 400 && /Max is/.test(over.json.error), 'over-cap listing -> 400 with message');

const listed = await post(`/games/${gid}/listings`, { productId: prod.id, marketGold: 2000, itemNotes: 'hi' }, seller.token);
ok(listed.json.marketGold === 2000, 'seller paid 2000 MG on listing');
const listings = await get(`/games/${gid}/listings`);
ok(listings.length === 1 && listings[0].sellerName === 'S', 'GET listings shows it, seller joined');
const tid = listings[0].id;

const poor = await post(`/trades/${tid}/buy`, { buyerInGameName: 'T' }, buyer.token);
ok(poor.status === 400, 'buy with no MG -> 400');
await post('/me/topup', { amount: 5000 }, buyer.token);
const bought = await post(`/trades/${tid}/buy`, { buyerInGameName: 'BuyerToon' }, buyer.token);
ok(bought.json.marketGold === 3000, 'buy debits buyer 5000-2000=3000');
await post(`/trades/${tid}/deliver`, {}, seller.token);
const sellerMe = await get('/me', seller.token);
ok(sellerMe.marketGold === 2000, 'seller still has 2000 (paid on listing; delivery just closes)');

const mt = await get('/me/trades', seller.token);
ok(mt.selling.length === 1 && mt.selling[0].gameName, 'GET /me/trades enriched');

console.log(`\nHTTP RESULT: ${pass} passed, ${fail} failed`);
try { fs.unlinkSync('httptest.json'); } catch {}
process.exit(fail ? 1 : 0);
