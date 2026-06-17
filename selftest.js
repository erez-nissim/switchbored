import * as db from './db.js';
import * as svc from './services.js';
db.seedIfEmpty();
const row = id => db.getUserById(id);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };

const gid = svc.getGames()[0].id;
const prod = svc.searchCatalog(gid, '')[0];
console.log('Game:', svc.getGames()[0].name, '| Product:', prod.name, '| in-game cost', prod.costInGame, '| max MG', prod.maxMarketGold);

const seller = svc.signup({ name: 'Seller', email: 's@x.com', password: 'pw' });
const buyer = svc.signup({ name: 'Buyer', email: 'b@x.com', password: 'pw' });
ok(seller.token && buyer.token, 'signup returns tokens');
ok(svc.login({ email: 's@x.com', password: 'pw' }).token, 'login works');
try { svc.login({ email: 's@x.com', password: 'wrong' }); ok(false, 'wrong password rejected'); } catch { ok(true, 'wrong password rejected'); }

console.log('Price cap:');
try { svc.createListing(row(seller.user.id), gid, { productId: prod.id, marketGold: prod.maxMarketGold + 1 }); ok(false, 'over-cap rejected'); }
catch (e) { ok(/Max is/.test(e.message), 'over-cap rejected (' + e.message + ')'); }
svc.createListing(row(seller.user.id), gid, { productId: prod.id, marketGold: 3000, itemNotes: 'perfect roll' });
ok(row(seller.user.id).market_gold === 3000, 'seller paid 3000 MG the moment they list');
const listings = svc.listListings(gid, '');
ok(listings.length === 1 && listings[0].sellerName === 'Seller', 'listing visible with seller name joined');
const tid = listings[0].id;

console.log('Buy flow:');
try { svc.buy(row(buyer.user.id), tid, 'Toon'); ok(false, 'buy with 0 balance rejected'); }
catch (e) { ok(/Not enough/.test(e.message), 'buy with 0 balance rejected'); }
try { svc.buy(row(seller.user.id), tid, 'Toon'); ok(false, 'cannot buy own listing'); }
catch (e) { ok(/own listing/.test(e.message), 'cannot buy own listing'); }
svc.topUp(row(buyer.user.id), 5000);
const afterBuy = svc.buy(row(buyer.user.id), tid, 'BuyerToon');
ok(afterBuy.marketGold === 2000, 'buyer debited 5000-3000=2000');
ok(row(seller.user.id).market_gold === 3000, 'seller already holds their 3000 from listing');
try { svc.buy(row(buyer.user.id), tid, 'Toon'); ok(false, 'cannot rebuy in-progress'); }
catch (e) { ok(/no longer available/.test(e.message), 'cannot rebuy in-progress'); }

console.log('Delivery:');
try { svc.markDelivered(row(buyer.user.id), tid); ok(false, 'only seller delivers'); }
catch (e) { ok(/Only the seller/.test(e.message), 'only seller can mark delivered'); }
svc.markDelivered(row(seller.user.id), tid);
ok(row(seller.user.id).market_gold === 3000, 'delivery just closes the trade — no double payment');

console.log('Cancel + refund:');
svc.createListing(row(seller.user.id), gid, { productId: prod.id, marketGold: 1000 });
const t2 = svc.listListings(gid, '')[0].id;
svc.buy(row(buyer.user.id), t2, 'BuyerToon');
ok(row(buyer.user.id).market_gold === 1000, 'buyer debited for 2nd trade');
svc.cancelTrade(row(seller.user.id), t2);
ok(row(buyer.user.id).market_gold === 2000, 'buyer refunded on cancel');
ok(row(seller.user.id).market_gold === 3000, 'seller listing payout clawed back on cancel');

console.log('My trades + activity:');
const mt = svc.myTrades(row(seller.user.id));
ok(mt.selling.length === 2, 'seller sees 2 in My Trades');
ok(!!mt.selling[0].gameName, 'my-trades rows carry gameName');
const feed = svc.activityFeed(gid);
ok(feed.length >= 2 && !!feed[0].verb, 'activity feed carries computed verb');

console.log('Rollback (atomicity):');
const balBefore = row(buyer.user.id).market_gold;
try { db.tx(() => { db.setBalance(buyer.user.id, 999999); throw new Error('boom'); }); } catch {}
ok(row(buyer.user.id).market_gold === balBefore, 'failed tx rolled back the write');

console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
