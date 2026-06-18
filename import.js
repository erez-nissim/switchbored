// import.js — Full D2R catalog import from game data files
// Usage: node import.js
// Wipes all products and trades, rebuilds catalog from JSON data files
// Run with server STOPPED.

import * as db from './db.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── helpers ──────────────────────────────────────────────────────────────────
const load = (file) => JSON.parse(readFileSync(path.join(__dirname, file), 'utf8'));

const PROP_MAP = {
  'dmg%':        (a,b) => a===b ? `+${a}% Enhanced Damage` : `+${a}-${b}% Enhanced Damage`,
  'res-all':     (a,b) => a===b ? `+${a} to All Resistances` : `+${a}-${b} to All Resistances`,
  'res-fire':    (a,b) => a===b ? `+${a}% Fire Resist` : `+${a}-${b}% Fire Resist`,
  'res-cold':    (a,b) => a===b ? `+${a}% Cold Resist` : `+${a}-${b}% Cold Resist`,
  'res-ltng':    (a,b) => a===b ? `+${a}% Lightning Resist` : `+${a}-${b}% Lightning Resist`,
  'res-pois':    (a,b) => a===b ? `+${a}% Poison Resist` : `+${a}-${b}% Poison Resist`,
  'allskills':   (a,b) => `+${a} to All Skills`,
  'att':         (a,b) => a===b ? `+${a} to Attack Rating` : `+${a}-${b} to Attack Rating`,
  'att%':        (a,b) => a===b ? `+${a}% Bonus to Attack Rating` : `+${a}-${b}% Bonus to Attack Rating`,
  'lifesteal':   (a,b) => a===b ? `+${a}% Life Stolen Per Hit` : `+${a}-${b}% Life Stolen Per Hit`,
  'manasteal':   (a,b) => a===b ? `+${a}% Mana Stolen Per Hit` : `+${a}-${b}% Mana Stolen Per Hit`,
  'str':         (a,b) => a===b ? `+${a} to Strength` : `+${a}-${b} to Strength`,
  'dex':         (a,b) => a===b ? `+${a} to Dexterity` : `+${a}-${b} to Dexterity`,
  'vit':         (a,b) => a===b ? `+${a} to Vitality` : `+${a}-${b} to Vitality`,
  'enr':         (a,b) => a===b ? `+${a} to Energy` : `+${a}-${b} to Energy`,
  'mana':        (a,b) => a===b ? `+${a} to Mana` : `+${a}-${b} to Mana`,
  'hp':          (a,b) => a===b ? `+${a} to Life` : `+${a}-${b} to Life`,
  'ac':          (a,b) => a===b ? `+${a} to Defense` : `+${a}-${b} to Defense`,
  'ac%':         (a,b) => a===b ? `+${a}% Enhanced Defense` : `+${a}-${b}% Enhanced Defense`,
  'swing2':      (a,b) => `+${a}% Increased Attack Speed`,
  'swing3':      (a,b) => `+${a}% Increased Attack Speed`,
  'run':         (a,b) => `+${a}% Faster Run/Walk`,
  'move2':       (a,b) => `+${a}% Faster Run/Walk`,
  'cast2':       (a,b) => `+${a}% Faster Cast Rate`,
  'block':       (a,b) => `+${a}% Faster Block Rate`,
  'regen':       (a,b) => `Regenerate Life +${a}`,
  'regen-stam':  (a,b) => `Replenish Stamina +${a}%`,
  'regen-mana':  (a,b) => `+${a}% Regenerate Mana`,
  'indestruct':  (a,b) => 'Indestructible',
  'openwounds':  (a,b) => `${a}% Chance of Open Wounds`,
  'crush':       (a,b) => `${a}% Chance of Crushing Blow`,
  'deadly':      (a,b) => `${a}% Deadly Strike`,
  'freeze':      (a,b) => 'Freezes Target',
  'slow':        (a,b) => `Slows Target by ${a}%`,
  'noheal':      (a,b) => 'Prevent Monster Heal',
  'nokill':      (a,b) => 'Cannot Be Frozen',
  'light':       (a,b) => a===b ? `+${a} to Light Radius` : `+${a}-${b} to Light Radius`,
  'extra-gold':  (a,b) => `+${a}% Extra Gold from Monsters`,
  'mag%':        (a,b) => a===b ? `+${a}% Magic Find` : `+${a}-${b}% Magic Find`,
  'dmg-undead':  (a,b) => `+${a}% Damage to Undead`,
  'att-undead':  (a,b) => `+${a} Attack Rating vs Undead`,
  'dmg-min':     (a,b) => `+${a} to Minimum Damage`,
  'dmg-max':     (a,b) => `+${a} to Maximum Damage`,
  'dmg-ac':      (a,b) => `${a} to Enemy Defense`,
  'stupidity':   (a,b) => 'Hit Causes Monster to Flee',
  'knock':       (a,b) => 'Knockback',
  'red-mag':     (a,b) => `Magic Damage Reduced by ${a}`,
  'red-dmg':     (a,b) => `Physical Damage Reduced by ${a}`,
  'red-dmg%':    (a,b) => `${a}% Physical Damage Reduction`,
  'abs-fire':    (a,b) => `Fire Absorb ${a}%`,
  'abs-cold':    (a,b) => `Cold Absorb ${a}%`,
  'abs-ltng':    (a,b) => `Lightning Absorb ${a}%`,
  'pierce-ltng': (a,b) => `-${a}% to Enemy Lightning Resistance`,
  'pierce-fire': (a,b) => `-${a}% to Enemy Fire Resistance`,
  'pierce-cold': (a,b) => `-${a}% to Enemy Cold Resistance`,
  'pierce-pois': (a,b) => `-${a}% to Enemy Poison Resistance`,
  'sock':        (a,b) => `+${a} Sockets`,
};

const ELEM_SKIP = new Set(['fire-min','fire-max','cold-min','cold-max','ltng-min','ltng-max','pois-min','pois-max']);

function humanProps(item, pp='prop', mp='min', xp='max') {
  const elem = {};
  for (let i = 1; i <= 12; i++) {
    const p = item[`${pp}${i}`]; if (!p) continue;
    const a = item[`${mp}${i}`]||0, b = item[`${xp}${i}`]||0;
    for (const el of ['fire','cold','ltng','pois']) {
      if (p===`${el}-min`) { elem[el] = elem[el]||{}; elem[el].min=a; }
      if (p===`${el}-max`) { elem[el] = elem[el]||{}; elem[el].max=b; }
    }
  }
  const parts = [];
  const ENAMES = {fire:'Fire',cold:'Cold',ltng:'Lightning',pois:'Poison'};
  for (const [el, {min,max}] of Object.entries(elem)) {
    if (min!=null && max!=null) parts.push(`Adds ${min}-${max} ${ENAMES[el]} Damage`);
  }
  for (let i = 1; i <= 12; i++) {
    const p = item[`${pp}${i}`]; if (!p || ELEM_SKIP.has(p)) continue;
    const a = item[`${mp}${i}`]||0, b = item[`${xp}${i}`]||0;
    const fn = PROP_MAP[p];
    if (fn) { const t = fn(a,b); if (t) parts.push(t); }
  }
  return parts.join(' / ');
}

// ── image lookup ──────────────────────────────────────────────────────────────
// Maps item name → relative image path served from /images/...
const IMAGE_MAP = {
  // Rings
  "The Stone of Jordan": "images/misc/ring/ring.sprite.00.png",
  "Nagelring": "images/misc/ring/ring1.sprite.00.png",
  "Manald Heal": "images/misc/ring/ring2.sprite.00.png",
  "Dwarf Star": "images/misc/ring/ring3.sprite.00.png",
  "Raven Frost": "images/misc/ring/ring4.sprite.00.png",
  "Bul Katho's Wedding Band": "images/misc/ring/ring5.sprite.00.png",
  "Carrion Wind": "images/misc/ring/ring.sprite.00.png",
  "Nature's Peace": "images/misc/ring/ring2.sprite.00.png",
  "Wisp": "images/misc/ring/ring3.sprite.00.png",
  "Opalvein": "images/misc/ring/ring4.sprite.00.png",
  "Sling": "images/misc/ring/ring1.sprite.00.png",
  // Runes
  "El Rune": "images/misc/rune/el_rune.sprite.00.png",
  "Eld Rune": "images/misc/rune/eld_rune.sprite.00.png",
  "Tir Rune": "images/misc/rune/tir_rune.sprite.00.png",
  "Nef Rune": "images/misc/rune/nef_rune.sprite.00.png",
  "Eth Rune": "images/misc/rune/eth_rune.sprite.00.png",
  "Ith Rune": "images/misc/rune/ith_rune.sprite.00.png",
  "Tal Rune": "images/misc/rune/tal_rune.sprite.00.png",
  "Ral Rune": "images/misc/rune/ral_rune.sprite.00.png",
  "Ort Rune": "images/misc/rune/ort_rune.sprite.00.png",
  "Thul Rune": "images/misc/rune/thul_rune.sprite.00.png",
  "Amn Rune": "images/misc/rune/amn_rune.sprite.00.png",
  "Sol Rune": "images/misc/rune/sol_rune.sprite.00.png",
  "Shael Rune": "images/misc/rune/shael_rune.sprite.00.png",
  "Dol Rune": "images/misc/rune/dol_rune.sprite.00.png",
  "Hel Rune": "images/misc/rune/hel_rune.sprite.00.png",
  "Io Rune": "images/misc/rune/io_rune.sprite.00.png",
  "Lum Rune": "images/misc/rune/lum_rune.sprite.00.png",
  "Ko Rune": "images/misc/rune/ko_rune.sprite.00.png",
  "Fal Rune": "images/misc/rune/fal_rune.sprite.00.png",
  "Lem Rune": "images/misc/rune/lem_rune.sprite.00.png",
  "Pul Rune": "images/misc/rune/pul_rune.sprite.00.png",
  "Um Rune": "images/misc/rune/um_rune.sprite.00.png",
  "Mal Rune": "images/misc/rune/mal_rune.sprite.00.png",
  "Ist Rune": "images/misc/rune/ist_rune.sprite.00.png",
  "Gul Rune": "images/misc/rune/gul_rune.sprite.00.png",
  "Vex Rune": "images/misc/rune/vex_rune.sprite.00.png",
  "Ohm Rune": "images/misc/rune/ohm_rune.sprite.00.png",
  "Lo Rune": "images/misc/rune/lo_rune.sprite.00.png",
  "Sur Rune": "images/misc/rune/sur_rune.sprite.00.png",
  "Ber Rune": "images/misc/rune/ber_rune.sprite.00.png",
  "Jah Rune": "images/misc/rune/jah_rune.sprite.00.png",
  "Cham Rune": "images/misc/rune/cham_rune.sprite.00.png",
  "Zod Rune": "images/misc/rune/zod_rune.sprite.00.png",
};

// Build dynamic image map from filesystem filenames
function buildImageLookup() {
  // These are the names derived from the image filenames (snake_case → normal)
  // We pre-built IMAGE_MAP above for special cases (rings, runes)
  // For everything else, we map by converting item name to snake_case filename
  return (name, baseName) => {
    if (IMAGE_MAP[name]) return IMAGE_MAP[name];
    // Try unique name as snake_case
    const toSnake = s => s.toLowerCase().replace(/'/g,'').replace(/[^a-z0-9]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');
    // We'll let the server serve from /images/ path
    return '';
  };
}

// ── categories ────────────────────────────────────────────────────────────────
function categoryOf(name, chars) {
  const c = (chars||'').toLowerCase();
  const n = (name||'').toLowerCase();
  if (n.includes(' rune') && !c.includes('runeword')) return 'Runes';
  if (c.includes('runeword:')) return 'Runewords';
  if (c.startsWith('unique ')) return 'Uniques';
  if (c.includes('set item') || c.includes("'s set") || c.includes('set /')) return 'Sets';
  if (c.includes('base /') || c.startsWith('base armor') || c.startsWith('base weapon')) return 'Bases';
  if (c.includes('charm') || c.includes('jewel') || n.includes('facet')) return 'Charms';
  return 'Keys & Misc';
}

// ── main ──────────────────────────────────────────────────────────────────────
console.log('Loading game data...');
const uniqueItems = load('uniqueitems.json');
const armorData   = load('armor.json');
const weaponData  = load('weapons.json');
const runeData    = load('runes.json');
const setData     = load('setitems.json');
const itemsData   = load('items.json');

// Wipe existing products and trades
console.log('Wiping existing products and trades...');
const data = db.getRawData();
data.products = {};
data.trades   = {};
db.persist();

let count = 0;

function addProduct(name, chars, costInGame, image) {
  if (!name || !costInGame) return;
  const id = db.newId('p');
  // Get game id - D2R is the first game
  const gameId = Object.keys(data.games)[0];
  if (!gameId) { console.error('No game found! Run seedIfEmpty first.'); process.exit(1); }
  data.products[id] = {
    id, game_id: gameId, name: name.trim(),
    characteristics: chars.trim(),
    cost_in_game: Math.floor(costInGame),
    image: image || ''
  };
  count++;
}

// ── 1. RUNE ITEMS (El → Zod) ─────────────────────────────────────────────────
console.log('Importing rune items...');
const RUNE_COSTS = {
  'El':1,'Eld':1,'Tir':2,'Nef':3,'Eth':5,'Ith':8,'Tal':13,'Ral':21,'Ort':34,'Thul':55,
  'Amn':89,'Sol':144,'Shael':233,'Dol':377,'Hel':610,'Io':987,'Lum':1597,'Ko':2584,
  'Fal':4181,'Lem':6765,'Pul':10946,'Um':17711,'Mal':28657,'Ist':46368,'Gul':75025,
  'Vex':121393,'Ohm':196418,'Lo':317811,'Sur':514229,'Ber':832040,'Jah':1346269,
  'Cham':2178309,'Zod':5000000
};
for (const [k, item] of Object.entries(itemsData)) {
  if (!item.name || !item.name.endsWith(' Rune')) continue;
  const runeName = item.name.replace(' Rune','');
  const cost = RUNE_COSTS[runeName] || 1000;
  const img = IMAGE_MAP[item.name] || '';
  const chars = `Rune / Socket into weapons or armor for bonuses`;
  addProduct(item.name, chars, cost, img);
}

// ── 2. RUNEWORDS ─────────────────────────────────────────────────────────────
console.log('Importing runewords...');
const RUNEWORD_COSTS = {
  'Zod':5000000,'Cham':2178309,'Jah':1346269,'Ber':832040,'Sur':514229,'Lo':317811,
  'Ohm':196418,'Vex':121393,'Gul':75025,'Ist':46368,'Mal':28657,'Um':17711,
  'Pul':10946,'Lem':6765,'Fal':4181,'Ko':2584,'Lum':1597,'Io':987,'Hel':610,
  'Dol':377,'Shael':233,'Sol':144,'Amn':89,'Thul':55,'Ort':34,'Ral':21,
  'Tal':13,'Ith':8,'Eth':5,'Nef':3,'Tir':2,'Eld':1,'El':1
};
function runewordCost(runesUsed) {
  if (!runesUsed) return 5000;
  const runes = runesUsed.match(/[A-Z][a-z]*/g) || [];
  return runes.reduce((s,r) => s + (RUNEWORD_COSTS[r]||1000), 0);
}
for (const [k, rw] of Object.entries(runeData)) {
  if (!rw['*Rune Name'] || !rw.complete) continue;
  const name = rw['*Rune Name'];
  const runes = rw['*RunesUsed'] || '';
  // Build characteristics
  const itype = [rw.itype1,rw.itype2,rw.itype3].filter(Boolean).join('/');
  const props = humanProps(rw, 'T1Code', 'T1Min', 'T1Max');
  const chars = `Runeword: ${runes} / Socket: ${itype || 'various'}${props ? ' / ' + props : ''}`;
  const cost = runewordCost(runes);
  addProduct(name, chars, cost, '');
}

// ── 3. UNIQUE ITEMS ───────────────────────────────────────────────────────────
console.log('Importing unique items...');
for (const [k, item] of Object.entries(uniqueItems)) {
  if (!item.spawnable || !item.index) continue;
  const name = item.index;
  const baseName = item['*ItemName'] || '';
  const lvlReq = item['lvl req'] || 1;
  const props = humanProps(item);
  const chars = `Unique ${baseName}${props ? ' / ' + props : ''}`;
  // Cost based on level req
  const cost = Math.max(500, lvlReq * lvlReq * 10);
  const img = IMAGE_MAP[name] || '';
  addProduct(name, chars, cost, img);
}

// ── 4. SET ITEMS ──────────────────────────────────────────────────────────────
console.log('Importing set items...');
for (const [k, item] of Object.entries(setData)) {
  if (!item.spawnable || !item.index) continue;
  const name = item.index;
  const baseName = item['*ItemName'] || '';
  const setName = item.set || '';
  const lvlReq = item['lvl req'] || 1;
  const props = humanProps(item);
  const chars = `Set item / ${setName} / ${baseName}${props ? ' / ' + props : ''}`;
  const cost = Math.max(300, lvlReq * lvlReq * 5);
  addProduct(name, chars, cost, '');
}

// ── 5. BASE ARMOR ─────────────────────────────────────────────────────────────
console.log('Importing base armor...');
for (const [k, item] of Object.entries(armorData)) {
  if (!item.spawnable || !item.name) continue;
  const name = item.name;
  const defMin = item.minac || 0, defMax = item.maxac || 0;
  const reqStr = item.reqstr || 0;
  const sockets = item.gemsockets || 0;
  const lvlReq = item.levelreq || 0;
  const chars = `Base armor / Defense: ${defMin}-${defMax} / Req Str: ${reqStr}${sockets ? ` / Max Sockets: ${sockets}` : ''}`;
  const cost = Math.max(200, (defMin + defMax) * 3);
  addProduct(name, chars, cost, '');
}

// ── 6. BASE WEAPONS ───────────────────────────────────────────────────────────
console.log('Importing base weapons...');
for (const [k, item] of Object.entries(weaponData)) {
  if (!item.spawnable || !item.name) continue;
  const name = item.name;
  const dmgMin = item['2handmindam'] || item['mindam'] || 0;
  const dmgMax = item['2handmaxdam'] || item['maxdam'] || 0;
  const reqStr = item.reqstr || 0;
  const sockets = item.gemsockets || 0;
  const chars = `Base weapon / Damage: ${dmgMin}-${dmgMax} / Req Str: ${reqStr}${sockets ? ` / Max Sockets: ${sockets}` : ''}`;
  const cost = Math.max(200, (dmgMin + dmgMax) * 10);
  addProduct(name, chars, cost, '');
}

db.persist();
console.log(`\n✓ Import complete! ${count} products added to D2R.`);
console.log('Start the server now to verify.');
