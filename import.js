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
const TYPE_FALLBACKS = {
  "plt": "images/armor/armor/plate_mail.sprite.00.png",
  "fld": "images/armor/armor/field_plate.sprite.00.png",
  "gth": "images/armor/armor/gothic_plate.sprite.00.png",
  "ful": "images/armor/armor/full_plate_mail.sprite.00.png",
  "lea": "images/armor/armor/leather_armor.sprite.00.png",
  "hla": "images/armor/armor/hard_leather_armor.sprite.00.png",
  "stu": "images/armor/armor/studded_leather.sprite.00.png",
  "rng": "images/armor/armor/ring_mail.sprite.00.png",
  "scl": "images/armor/armor/scale_mail.sprite.00.png",
  "chn": "images/armor/armor/chain_mail.sprite.00.png",
  "spl": "images/armor/armor/splint_mail.sprite.00.png",
  "brs": "images/armor/armor/breast_plate.sprite.00.png",
  "ltp": "images/armor/armor/light_plate.sprite.00.png",
  "xlt": "images/armor/armor/plate_mail.sprite.00.png",
  "xpl": "images/armor/armor/plate_mail.sprite.00.png",
  "xth": "images/armor/armor/gothic_plate.sprite.00.png",
  "xfl": "images/armor/armor/full_plate_mail.sprite.00.png",
  "xla": "images/weapon/axe/large_axe.sprite.00.png",
  "xhl": "images/armor/helmet/full_helm.sprite.00.png",
  "xui": "images/armor/armor/studded_leather.sprite.00.png",
  "xrn": "images/armor/helmet/crown.sprite.00.png",
  "xsc": "images/weapon/scepter/scepter.sprite.00.png",
  "xch": "images/armor/armor/chain_mail.sprite.00.png",
  "uld": "images/armor/armor/full_plate_mail.sprite.00.png",
  "ult": "images/armor/armor/full_plate_mail.sprite.00.png",
  "cap": "images/armor/helmet/skull_cap.sprite.00.png",
  "skp": "images/armor/helmet/skull_cap.sprite.00.png",
  "hlm": "images/armor/helmet/helm.sprite.00.png",
  "fhl": "images/armor/helmet/full_helm.sprite.00.png",
  "ghm": "images/armor/helmet/great_helm.sprite.00.png",
  "crn": "images/armor/helmet/crown.sprite.00.png",
  "msk": "images/armor/helmet/mask.sprite.00.png",
  "bhm": "images/armor/helmet/bone_helm.sprite.00.png",
  "xap": "images/armor/helmet/skull_cap.sprite.00.png",
  "xkp": "images/armor/helmet/skull_cap.sprite.00.png",
  "xlm": "images/armor/helmet/helm.sprite.00.png",
  "xhm": "images/armor/helmet/great_helm.sprite.00.png",
  "uap": "images/armor/helmet/skull_cap.sprite.00.png",
  "uhm": "images/armor/helmet/great_helm.sprite.00.png",
  "urn": "images/armor/helmet/crown.sprite.00.png",
  "ci0": "images/armor/circlet/circlet.sprite.00.png",
  "ci1": "images/armor/circlet/coronet.sprite.00.png",
  "ci2": "images/armor/circlet/tiara.sprite.00.png",
  "ci3": "images/armor/circlet/diadem.sprite.00.png",
  "dr1": "images/armor/pelt/wolf_head.sprite.00.png",
  "dr2": "images/armor/pelt/hawk_helm.sprite.00.png",
  "dr3": "images/armor/pelt/antlers.sprite.00.png",
  "dr4": "images/armor/pelt/falcon_mask.sprite.00.png",
  "dr5": "images/armor/pelt/spirit_mask.sprite.00.png",
  "buc": "images/armor/shield/buckler.sprite.00.png",
  "sml": "images/armor/shield/small_shield.sprite.00.png",
  "lrg": "images/armor/shield/large_shield.sprite.00.png",
  "kit": "images/armor/shield/kite_shield.sprite.00.png",
  "tow": "images/armor/shield/tower_shield.sprite.00.png",
  "gts": "images/armor/shield/gothic_shield.sprite.00.png",
  "spk": "images/armor/shield/spiked_shield.sprite.00.png",
  "xuc": "images/armor/shield/buckler.sprite.00.png",
  "xml": "images/armor/shield/small_shield.sprite.00.png",
  "xrg": "images/armor/shield/large_shield.sprite.00.png",
  "xit": "images/armor/shield/kite_shield.sprite.00.png",
  "xow": "images/armor/shield/tower_shield.sprite.00.png",
  "xts": "images/armor/shield/gothic_shield.sprite.00.png",
  "uuc": "images/armor/shield/buckler.sprite.00.png",
  "uml": "images/armor/shield/small_shield.sprite.00.png",
  "urg": "images/armor/shield/large_shield.sprite.00.png",
  "lbt": "images/armor/boot/leather_boots.sprite.00.png",
  "vbt": "images/armor/boot/heavy_boots.sprite.00.png",
  "mbt": "images/armor/boot/chain_boots.sprite.00.png",
  "tbt": "images/armor/boot/plate_boots.sprite.00.png",
  "hbt": "images/armor/boot/plate_boots.sprite.00.png",
  "xlb": "images/armor/boot/leather_boots.sprite.00.png",
  "xvb": "images/armor/boot/heavy_boots.sprite.00.png",
  "xmb": "images/armor/boot/chain_boots.sprite.00.png",
  "xtb": "images/armor/boot/plate_boots.sprite.00.png",
  "ulb": "images/armor/boot/leather_boots.sprite.00.png",
  "uvb": "images/armor/boot/heavy_boots.sprite.00.png",
  "umb": "images/armor/boot/chain_boots.sprite.00.png",
  "utb": "images/armor/boot/plate_boots.sprite.00.png",
  "lgl": "images/armor/glove/gloves_l.sprite.00.png",
  "vgl": "images/armor/glove/heavy_gloves.sprite.00.png",
  "mgl": "images/armor/glove/bracers_m.sprite.00.png",
  "tgl": "images/armor/glove/gaunlets_h.sprite.00.png",
  "hgl": "images/armor/glove/gaunlets_h.sprite.00.png",
  "xlg": "images/armor/glove/gloves_l.sprite.00.png",
  "xvg": "images/armor/glove/heavy_gloves.sprite.00.png",
  "xmg": "images/armor/glove/bracers_m.sprite.00.png",
  "xhg": "images/armor/glove/gaunlets_h.sprite.00.png",
  "ulg": "images/armor/glove/gloves_l.sprite.00.png",
  "uvg": "images/armor/glove/heavy_gloves.sprite.00.png",
  "umg": "images/armor/glove/bracers_m.sprite.00.png",
  "uhg": "images/armor/glove/gaunlets_h.sprite.00.png",
  "lbl": "images/armor/belt/light_belt.sprite.00.png",
  "vbl": "images/armor/belt/belt_m.sprite.00.png",
  "mbl": "images/armor/belt/heavy_belt.sprite.00.png",
  "tbl": "images/armor/belt/girdle_h.sprite.00.png",
  "hbl": "images/armor/belt/girdle_h.sprite.00.png",
  "zlb": "images/armor/belt/light_belt.sprite.00.png",
  "zvb": "images/armor/belt/belt_m.sprite.00.png",
  "zmb": "images/armor/belt/heavy_belt.sprite.00.png",
  "zhb": "images/armor/belt/girdle_h.sprite.00.png",
  "ulc": "images/armor/belt/light_belt.sprite.00.png",
  "uvc": "images/armor/belt/belt_m.sprite.00.png",
  "umc": "images/armor/belt/heavy_belt.sprite.00.png",
  "uhc": "images/armor/belt/girdle_h.sprite.00.png",
  "rin": "images/misc/ring/ring.sprite.00.png",
  "amu": "images/misc/amulet/amulet.sprite.00.png",
  "cm1": "images/misc/charm/charm_small.sprite.00.png",
  "cm2": "images/misc/charm/charm_medium.sprite.00.png",
  "cm3": "images/misc/charm/charm_large.sprite.00.png",
  "ssd": "images/weapon/sword/short_sword.sprite.00.png",
  "scm": "images/weapon/sword/scimitar.sprite.00.png",
  "sbr": "images/weapon/sword/saber.sprite.00.png",
  "flc": "images/weapon/sword/falchion.sprite.00.png",
  "crs": "images/weapon/sword/crystal_sword.sprite.00.png",
  "bsw": "images/weapon/sword/broad_sword.sprite.00.png",
  "flb": "images/weapon/sword/flamberge.sprite.00.png",
  "gsd": "images/weapon/sword/great_sword.sprite.00.png",
  "lsd": "images/weapon/sword/long_sword.sprite.00.png",
  "wsd": "images/weapon/sword/war_sword.sprite.00.png",
  "clm": "images/weapon/sword/claymore.sprite.00.png",
  "bsd": "images/weapon/sword/bastard_sword.sprite.00.png",
  "xss": "images/weapon/staff/short_staff.sprite.00.png",
  "xsb": "images/weapon/sword/saber.sprite.00.png",
  "xfc": "images/weapon/sword/falchion.sprite.00.png",
  "xcr": "images/weapon/sword/crystal_sword.sprite.00.png",
  "xbs": "images/weapon/sword/broad_sword.sprite.00.png",
  "xfb": "images/weapon/sword/flamberge.sprite.00.png",
  "xgs": "images/weapon/scepter/grand_scepter.sprite.00.png",
  "uss": "images/weapon/sword/short_sword.sprite.00.png",
  "usc": "images/weapon/sword/crystal_sword.sprite.00.png",
  "ubs": "images/weapon/sword/broad_sword.sprite.00.png",
  "ugs": "images/weapon/sword/great_sword.sprite.00.png",
  "hax": "images/weapon/axe/hatchet.sprite.00.png",
  "axe": "images/weapon/axe/axe.sprite.00.png",
  "2ax": "images/weapon/axe/double_axe.sprite.00.png",
  "mpi": "images/weapon/axe/military_pick.sprite.00.png",
  "wax": "images/weapon/axe/war_axe.sprite.00.png",
  "lax": "images/weapon/axe/large_axe.sprite.00.png",
  "bax": "images/weapon/axe/broad_axe.sprite.00.png",
  "btx": "images/weapon/axe/battle_axe.sprite.00.png",
  "gax": "images/weapon/axe/great_axe.sprite.00.png",
  "gix": "images/weapon/axe/giant_axe.sprite.00.png",
  "xha": "images/weapon/axe/hatchet.sprite.00.png",
  "xax": "images/weapon/axe/axe.sprite.00.png",
  "x2a": "images/weapon/axe/double_axe.sprite.00.png",
  "xmp": "images/weapon/axe/military_pick.sprite.00.png",
  "xwa": "images/weapon/axe/war_axe.sprite.00.png",
  "xba": "images/weapon/axe/broad_axe.sprite.00.png",
  "xbt": "images/weapon/axe/battle_axe.sprite.00.png",
  "xga": "images/weapon/axe/great_axe.sprite.00.png",
  "xgi": "images/weapon/axe/giant_axe.sprite.00.png",
  "uha": "images/weapon/axe/hatchet.sprite.00.png",
  "uax": "images/weapon/axe/axe.sprite.00.png",
  "u2a": "images/weapon/axe/double_axe.sprite.00.png",
  "clb": "images/weapon/club/club.sprite.00.png",
  "spc": "images/weapon/club/spiked_club.sprite.00.png",
  "mac": "images/weapon/mace/mace.sprite.00.png",
  "mst": "images/weapon/mace/morning_star.sprite.00.png",
  "fla": "images/weapon/mace/flail.sprite.00.png",
  "whm": "images/weapon/hammer/war_hammer.sprite.00.png",
  "mau": "images/weapon/hammer/maul.sprite.00.png",
  "gma": "images/weapon/hammer/great_maul.sprite.00.png",
  "xmace": "images/weapon/mace/mace.sprite.00.png",
  "wnd": "images/weapon/wand/wand.sprite.00.png",
  "ywn": "images/weapon/wand/yew_wand.sprite.00.png",
  "bwn": "images/weapon/wand/bone_wand.sprite.00.png",
  "gwn": "images/weapon/wand/grim_wand.sprite.00.png",
  "xwn": "images/weapon/wand/wand.sprite.00.png",
  "xyw": "images/weapon/wand/yew_wand.sprite.00.png",
  "xbw": "images/weapon/wand/bone_wand.sprite.00.png",
  "xgw": "images/weapon/wand/grim_wand.sprite.00.png",
  "sst": "images/weapon/staff/short_staff.sprite.00.png",
  "lst": "images/weapon/staff/long_staff.sprite.00.png",
  "cst": "images/weapon/staff/gnarled_staff.sprite.00.png",
  "bst": "images/weapon/staff/battle_staff.sprite.00.png",
  "wst": "images/weapon/staff/war_staff.sprite.00.png",
  "xls": "images/weapon/staff/long_staff.sprite.00.png",
  "xcs": "images/weapon/staff/gnarled_staff.sprite.00.png",
  "sbw": "images/weapon/bow/short_bow.sprite.00.png",
  "hbw": "images/weapon/bow/hunter_bow.sprite.00.png",
  "lbw": "images/weapon/bow/long_bow.sprite.00.png",
  "cbw": "images/weapon/bow/composite_bow.sprite.00.png",
  "sbb": "images/weapon/bow/short_battle_bow.sprite.00.png",
  "lbb": "images/weapon/bow/long_battle_bow.sprite.00.png",
  "swb": "images/weapon/bow/short_war_bow.sprite.00.png",
  "lwb": "images/weapon/bow/long_war_bow.sprite.00.png",
  "lxb": "images/weapon/bow/light_crossbow.sprite.00.png",
  "mxb": "images/weapon/bow/crossbow.sprite.00.png",
  "hxb": "images/weapon/bow/heavy_crossbow.sprite.00.png",
  "scp": "images/weapon/scepter/scepter.sprite.00.png",
  "gsc": "images/weapon/scepter/grand_scepter.sprite.00.png",
  "wsp": "images/weapon/scepter/war_scepter.sprite.00.png",
  "spr": "images/weapon/spear/spear.sprite.00.png",
  "tri": "images/weapon/spear/trident.sprite.00.png",
  "brn": "images/weapon/spear/brandistock.sprite.00.png",
  "spt": "images/weapon/spear/spetum.sprite.00.png",
  "pik": "images/weapon/spear/pike.sprite.00.png",
  "bar": "images/weapon/polearm/bardiche.sprite.00.png",
  "vou": "images/weapon/polearm/voulge.sprite.00.png",
  "scy": "images/weapon/polearm/scythe.sprite.00.png",
  "pax": "images/weapon/polearm/poleaxe.sprite.00.png",
  "hal": "images/weapon/polearm/halberd.sprite.00.png",
  "wsc": "images/weapon/polearm/war_scythe.sprite.00.png",
  "dgr": "images/weapon/knife/dagger.sprite.00.png",
  "dir": "images/weapon/knife/dirk.sprite.00.png",
  "kri": "images/weapon/knife/kriss.sprite.00.png",
  "bld": "images/weapon/knife/blade.sprite.00.png",
  "ktr": "images/weapon/h2h/katar.sprite.00.png",
  "wrb": "images/weapon/h2h/wrist_blade.sprite.00.png",
  "axf": "images/weapon/h2h/quhab.sprite.00.png",
  "ces": "images/weapon/h2h/suwayyah.sprite.00.png",
  "jav": "images/weapon/javelin/javelin.sprite.00.png",
  "pil": "images/weapon/javelin/pilum.sprite.00.png",
  "ssp": "images/weapon/javelin/short_spear.sprite.00.png",
  "glv": "images/weapon/javelin/glaive.sprite.00.png",
  "tsp": "images/weapon/javelin/throwing_spear.sprite.00.png",
  "ob1": "images/weapon/orb/eagle_orb.sprite.00.png",
  "ob2": "images/weapon/orb/sacred_globe.sprite.00.png",
  "ob3": "images/weapon/orb/smoked_sphere.sprite.00.png",
  "ob4": "images/weapon/orb/clasped_orb.sprite.00.png",
  "ob5": "images/weapon/orb/dragon_stone.sprite.00.png",
};

const IMAGE_MAP = {
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
  "The Stone of Jordan": "images/misc/ring/ring.sprite.00.png",
  "Nagelring": "images/misc/ring/ring1.sprite.00.png",
  "Manald Heal": "images/misc/ring/ring2.sprite.00.png",
  "Dwarf Star": "images/misc/ring/ring3.sprite.00.png",
  "Raven Frost": "images/misc/ring/ring4.sprite.00.png",
  "Bul Katho\'s Wedding Band": "images/misc/ring/ring5.sprite.00.png",
  "Carrion Wind": "images/misc/ring/ring.sprite.00.png",
  "Nature\'s Peace": "images/misc/ring/ring2.sprite.00.png",
  "Wisp": "images/misc/ring/ring3.sprite.00.png",
  "Opalvein": "images/misc/ring/ring4.sprite.00.png",
  "Sling": "images/misc/ring/ring1.sprite.00.png",
  "The Eye of Etlich": "images/misc/amulet/amulet.sprite.00.png",
  "Nokozan Relic": "images/misc/amulet/amulet1.sprite.00.png",
  "The Mahim-Oak Curio": "images/misc/amulet/amulet2.sprite.00.png",
  "Saracen\'s Chance": "images/misc/amulet/amulet3.sprite.00.png",
  "Crescent Moon": "images/misc/amulet/amulet.sprite.00.png",
  "Atma\'s Scarab": "images/misc/amulet/viper_amulet.sprite.00.png",
  "Highlord\'s Wrath": "images/misc/amulet/amulet1.sprite.00.png",
  "Mara\'s Kaleidoscope": "images/misc/amulet/amulet2.sprite.00.png",
  "The Cat\'s Eye": "images/misc/amulet/amulet3.sprite.00.png",
  "The Rising Sun": "images/misc/amulet/viper_amulet1.sprite.00.png",
  "Metalgrid": "images/misc/amulet/viper_amulet2.sprite.00.png",
  "Amulet of the Viper": "images/misc/amulet/viper_amulet.sprite.00.png",
  "Seraph\'s Hymn": "images/misc/amulet/amulet2.sprite.00.png",
  "Entropy Locket": "images/misc/amulet/amulet3.sprite.00.png",
  "The Gnasher": "images/weapon/axe/the_gnasher.sprite.00.png",
  "Deathspade": "images/weapon/axe/deathspade.sprite.00.png",
  "Bladebone": "images/weapon/axe/double_axe.sprite.00.png",
  "Mindrend": "images/weapon/axe/mindrend.sprite.00.png",
  "Rakescar": "images/weapon/axe/war_axe.sprite.00.png",
  "Fechmars Axe": "images/weapon/axe/large_axe.sprite.00.png",
  "Goreshovel": "images/weapon/axe/broad_axe.sprite.00.png",
  "The Chieftan": "images/weapon/axe/the_chieftan.sprite.00.png",
  "Brainhew": "images/weapon/axe/brainhew.sprite.00.png",
  "The Humongous": "images/weapon/axe/giant_axe.sprite.00.png",
  "Iros Torch": "images/weapon/wand/iros_torch.sprite.00.png",
  "Maelstromwrath": "images/weapon/wand/yew_wand.sprite.00.png",
  "Gravenspine": "images/weapon/wand/gravenspine.sprite.00.png",
  "Umes Lament": "images/weapon/wand/grim_wand.sprite.00.png",
  "Felloak": "images/weapon/club/felloak.sprite.00.png",
  "Knell Striker": "images/weapon/scepter/scepter.sprite.00.png",
  "Rusthandle": "images/weapon/scepter/grand_scepter.sprite.00.png",
  "Stormeye": "images/weapon/scepter/war_scepter.sprite.00.png",
  "Stoutnail": "images/weapon/club/stoutnail.sprite.00.png",
  "Crushflange": "images/weapon/mace/mace.sprite.00.png",
  "Bloodrise": "images/weapon/mace/bloodrise.sprite.00.png",
  "The Generals Tan Do Li Ga": "images/weapon/mace/flail.sprite.00.png",
  "Ironstone": "images/weapon/hammer/war_hammer.sprite.00.png",
  "Bonesob": "images/weapon/hammer/bonesob.sprite.00.png",
  "Steeldriver": "images/weapon/hammer/great_maul.sprite.00.png",
  "Rixots Keen": "images/weapon/sword/short_sword.sprite.00.png",
  "Blood Crescent": "images/weapon/sword/blood_crescent.sprite.00.png",
  "Krintizs Skewer": "images/weapon/sword/krintizs_skewer.sprite.00.png",
  "Gleamscythe": "images/weapon/sword/gleamscythe.sprite.00.png",
  "Griswolds Edge": "images/weapon/sword/griswolds_edge.sprite.00.png",
  "Hellplague": "images/weapon/sword/hellplague.sprite.00.png",
  "Culwens Point": "images/weapon/sword/war_sword.sprite.00.png",
  "Shadowfang": "images/weapon/sword/shadowfang.sprite.00.png",
  "Soulflay": "images/weapon/sword/claymore.sprite.00.png",
  "Kinemils Awl": "images/weapon/sword/kinemils_awl.sprite.00.png",
  "Blacktongue": "images/weapon/sword/blacktongue.sprite.00.png",
  "Ripsaw": "images/weapon/sword/flamberge.sprite.00.png",
  "The Patriarch": "images/weapon/sword/the_patriarch.sprite.00.png",
  "Gull": "images/weapon/knife/dagger.sprite.00.png",
  "The Diggler": "images/weapon/knife/dirk.sprite.00.png",
  "The Jade Tan Do": "images/weapon/knife/the_jade_tan_do.sprite.00.png",
  "Irices Shard": "images/weapon/knife/blade.sprite.00.png",
  "The Dragon Chang": "images/weapon/spear/spear.sprite.00.png",
  "Razortine": "images/weapon/spear/razortine.sprite.00.png",
  "Bloodthief": "images/weapon/spear/brandistock.sprite.00.png",
  "Lance of Yaggai": "images/weapon/spear/spetum.sprite.00.png",
  "The Tannr Gorerod": "images/weapon/spear/pike.sprite.00.png",
  "Dimoaks Hew": "images/weapon/polearm/bardiche.sprite.00.png",
  "Steelgoad": "images/weapon/polearm/voulge.sprite.00.png",
  "Soul Harvest": "images/weapon/polearm/soul_harvest.sprite.00.png",
  "The Battlebranch": "images/weapon/polearm/poleaxe.sprite.00.png",
  "Woestave": "images/weapon/polearm/halberd.sprite.00.png",
  "The Grim Reaper": "images/weapon/polearm/war_scythe.sprite.00.png",
  "Bane Ash": "images/weapon/staff/short_staff.sprite.00.png",
  "Serpent Lord": "images/weapon/staff/long_staff.sprite.00.png",
  "Lazarus Spire": "images/weapon/staff/lazarus_spire.sprite.00.png",
  "The Salamander": "images/weapon/staff/battle_staff.sprite.00.png",
  "The Iron Jang Bong": "images/weapon/staff/war_staff.sprite.00.png",
  "Pluckeye": "images/weapon/bow/short_bow.sprite.00.png",
  "Rimeraven": "images/weapon/bow/long_bow.sprite.00.png",
  "Piercerib": "images/weapon/bow/piercerib.sprite.00.png",
  "Pullspite": "images/weapon/bow/pullspite.sprite.00.png",
  "Wizendraw": "images/weapon/bow/long_battle_bow.sprite.00.png",
  "Hellclap": "images/weapon/bow/hellclap.sprite.00.png",
  "Blastbark": "images/weapon/bow/long_war_bow.sprite.00.png",
  "Leadcrow": "images/weapon/bow/leadcrow.sprite.00.png",
  "Ichorsting": "images/weapon/bow/ichorsting.sprite.00.png",
  "Hellcast": "images/weapon/bow/hellcast.sprite.00.png",
  "Doomspittle": "images/weapon/bow/doomspittle.sprite.00.png",
  "War Bonnet": "images/armor/helmet/war_bonnet.sprite.00.png",
  "Tarnhelm": "images/armor/helmet/skull_cap.sprite.00.png",
  "Coif of Glory": "images/armor/helmet/coif_of_glory.sprite.00.png",
  "Duskdeep": "images/armor/helmet/duskdeep.sprite.00.png",
  "Wormskull": "images/armor/helmet/wormskull.sprite.00.png",
  "Howltusk": "images/armor/helmet/great_helm.sprite.00.png",
  "Undead Crown": "images/armor/helmet/crown.sprite.00.png",
  "The Face of Horror": "images/armor/helmet/mask.sprite.00.png",
  "Greyform": "images/armor/armor/quilted_armor.sprite.00.png",
  "Blinkbats Form": "images/armor/armor/leather_armor.sprite.00.png",
  "Twitchthroe": "images/armor/armor/studded_leather.sprite.00.png",
  "Darkglow": "images/armor/armor/ring_mail.sprite.00.png",
  "Hawkmail": "images/armor/armor/scale_mail.sprite.00.png",
  "Sparking Mail": "images/armor/armor/chain_mail.sprite.00.png",
  "Venomsward": "images/armor/armor/breast_plate.sprite.00.png",
  "Iceblink": "images/armor/armor/splint_mail.sprite.00.png",
  "Boneflesh": "images/armor/armor/plate_mail.sprite.00.png",
  "Rockfleece": "images/armor/armor/field_plate.sprite.00.png",
  "Rattlecage": "images/armor/armor/gothic_plate.sprite.00.png",
  "Goldskin": "images/armor/armor/goldskin.sprite.00.png",
  "Victors Silk": "images/armor/armor/victors_silk.sprite.00.png",
  "Heavenly Garb": "images/armor/armor/light_plate.sprite.00.png",
  "Pelta Lunata": "images/armor/shield/pelta_lunata.sprite.00.png",
  "Umbral Disk": "images/armor/shield/umbral_disk.sprite.00.png",
  "Stormguild": "images/armor/shield/stormguild.sprite.00.png",
  "Wall of the Eyeless": "images/armor/shield/wall_of_the_eyeless.sprite.00.png",
  "Swordback Hold": "images/armor/shield/swordback_hold.sprite.00.png",
  "Steelclash": "images/armor/shield/steelclash.sprite.00.png",
  "Bverrit Keep": "images/armor/shield/bverrit_keep.sprite.00.png",
  "The Ward": "images/armor/shield/the_ward.sprite.00.png",
  "Bloodfist": "images/armor/glove/heavy_gloves.sprite.00.png",
  "Magefist": "images/armor/glove/light_gauntlets.sprite.00.png",
  "Hotspur": "images/armor/boot/leather_boots.sprite.00.png",
  "Gorefoot": "images/armor/boot/heavy_boots.sprite.00.png",
  "Treads of Cthon": "images/armor/boot/chain_boots.sprite.00.png",
  "Goblin Toe": "images/armor/boot/light_plate_boots.sprite.00.png",
  "Tearhaunch": "images/armor/boot/plate_boots.sprite.00.png",
  "Snakecord": "images/armor/belt/light_belt.sprite.00.png",
  "Goldwrap": "images/armor/belt/heavy_belt.sprite.00.png",
  "Horadric Staff": "images/weapon/staff/horadric_staff.sprite.00.png",
  "KhalimFlail": "images/weapon/mace/flail.sprite.00.png",
  "SuperKhalimFlail": "images/weapon/mace/flail.sprite.00.png",
  "Stormrider": "images/weapon/axe/stormrider.sprite.00.png",
  "The Minataur": "images/weapon/axe/the_minataur.sprite.00.png",
  "Blackhand Key": "images/weapon/wand/blackhand_key.sprite.00.png",
  "The Gavel of Pain": "images/weapon/hammer/the_gavel_of_pain.sprite.00.png",
  "Hexfire": "images/weapon/sword/hexfire.sprite.00.png",
  "Ginther\'s Rift": "images/weapon/sword/ginthers_rift.sprite.00.png",
  "Plague Bearer": "images/weapon/sword/plague_bearer.sprite.00.png",
  "Todesfaelle Flamme": "images/weapon/sword/todesfaelle_flamme.sprite.00.png",
  "Stormspike": "images/weapon/knife/stormspike.sprite.00.png",
  "Soulfeast Tine": "images/weapon/spear/soulfeast_tine.sprite.00.png",
  "Athena\'s Wrath": "images/weapon/polearm/athenas_wrath.sprite.00.png",
  "Skullcollector": "images/weapon/staff/skullcollector.sprite.00.png",
  "Kuko Shakaku": "images/weapon/bow/kuko_shakaku.sprite.00.png",
  "Whichwild String": "images/weapon/bow/whichwild_string.sprite.00.png",
  "Langer Briser": "images/weapon/bow/langer_briser.sprite.00.png",
  "Pus Spiter": "images/weapon/bow/pus_spiter.sprite.00.png",
  "Rockstopper": "images/armor/helmet/rockstopper.sprite.00.png",
  "Crown of Thieves": "images/armor/helmet/crown_of_thieves.sprite.00.png",
  "Ironpelt": "images/armor/armor/ironpelt.sprite.00.png",
  "Corpsemourn": "images/armor/armor/corpsemourn.sprite.00.png",
  "Mosers Blessed Circle": "images/armor/shield/mosers_blessed_circle.sprite.00.png",
  "Stormchaser": "images/armor/shield/stormchaser.sprite.00.png",
  "Lidless Wall": "images/armor/shield/lidless_wall.sprite.00.png",
  "Lance Guard": "images/armor/shield/lance_guard.sprite.00.png",
  "Lightsabre": "images/weapon/sword/lightsabre.sprite.00.png",
  "Herald of Zakarum": "images/armor/shield/aerin_shield.sprite.00.png",
  "Warshrike": "images/weapon/knife/warshrike.sprite.00.png",
  "Shadowkiller": "images/weapon/h2h/shadowkiller.sprite.00.png",
  "Griffon\'s Eye": "images/armor/circlet/diadem.sprite.00.png",
  "Kira\'s Guardian": "images/armor/circlet/tiara.sprite.00.png",
  "Angelic Halo": "images/misc/ring/ring.sprite.00.png",
  "Angelic Mantle": "images/armor/armor/ring_mail.sprite.00.png",
  "Angelic Wings": "images/misc/amulet/amulet.sprite.00.png",
  "Arcanna\'s Deathwand": "images/weapon/staff/war_staff.sprite.00.png",
  "Arcanna\'s Flesh": "images/armor/armor/light_plate.sprite.00.png",
  "Arcanna\'s Head": "images/armor/helmet/skull_cap.sprite.00.png",
  "Arcanna\'s Sign": "images/misc/amulet/amulet.sprite.00.png",
  "Arctic Binding": "images/armor/belt/light_belt.sprite.00.png",
  "Arctic Furs": "images/armor/armor/quilted_armor.sprite.00.png",
  "Arctic Horn": "images/weapon/bow/short_war_bow.sprite.00.png",
  "Arctic Mitts": "images/armor/glove/light_gauntlets.sprite.00.png",
  "Bane\'s Authority": "images/armor/belt/light_belt.sprite.00.png",
  "Bane\'s Oathmaker": "images/weapon/knife/kriss.sprite.00.png",
  "Bane\'s Wraithskin": "images/armor/armor/hard_leather_armor.sprite.00.png",
  "Berserker\'s Hatchet": "images/weapon/axe/double_axe.sprite.00.png",
  "Berserker\'s Hauberk": "images/armor/armor/splint_mail.sprite.00.png",
  "Berserker\'s Headgear": "images/armor/helmet/helm.sprite.00.png",
  "Cathan\'s Mesh": "images/armor/armor/chain_mail.sprite.00.png",
  "Cathan\'s Rule": "images/weapon/staff/battle_staff.sprite.00.png",
  "Cathan\'s Seal": "images/misc/ring/ring.sprite.00.png",
  "Cathan\'s Sigil": "images/misc/amulet/amulet.sprite.00.png",
  "Cathan\'s Visage": "images/armor/helmet/mask.sprite.00.png",
  "Civerb\'s Cudgel": "images/weapon/scepter/grand_scepter.sprite.00.png",
  "Civerb\'s Icon": "images/misc/amulet/amulet.sprite.00.png",
  "Civerb\'s Ward": "images/armor/shield/large_shield.sprite.00.png",
  "Cleglaw\'s Claw": "images/armor/shield/small_shield.sprite.00.png",
  "Cleglaw\'s Tooth": "images/weapon/sword/long_sword.sprite.00.png",
  "Cow King\'s Hide": "images/armor/armor/studded_leather.sprite.00.png",
  "Cow King\'s Hoofs": "images/armor/boot/heavy_boots.sprite.00.png",
  "Dangoon\'s Teaching": "images/weapon/mace/dangoons_teaching.sprite.00.png",
  "Death\'s Touch": "images/weapon/sword/war_sword.sprite.00.png",
  "Haemosu\'s Adament": "images/armor/armor/haemosus_adament.sprite.00.png",
  "Heaven\'s Taebaek": "images/armor/shield/heavens_taebaek.sprite.00.png",
  "Hsarus\' Iron Fist": "images/armor/shield/buckler.sprite.00.png",
  "Hsarus\' Iron Heel": "images/armor/boot/chain_boots.sprite.00.png",
  "Immortal King\'s Will": "images/armor/helmet/avenger_guard.sprite.00.png",
  "Infernal Sign": "images/armor/belt/heavy_belt.sprite.00.png",
  "Infernal Torch": "images/weapon/wand/grim_wand.sprite.00.png",
  "Iratha\'s Coil": "images/armor/helmet/crown.sprite.00.png",
  "Iratha\'s Collar": "images/misc/amulet/amulet.sprite.00.png",
  "Iratha\'s Cord": "images/armor/belt/heavy_belt.sprite.00.png",
  "Iratha\'s Cuff": "images/armor/glove/light_gauntlets.sprite.00.png",
  "Isenhart\'s Case": "images/armor/armor/breast_plate.sprite.00.png",
  "Isenhart\'s Horns": "images/armor/helmet/full_helm.sprite.00.png",
  "Isenhart\'s Lightbrand": "images/weapon/sword/broad_sword.sprite.00.png",
  "Isenhart\'s Parry": "images/armor/shield/gothic_shield.sprite.00.png",
  "M\'avina\'s True Sight": "images/armor/circlet/diadem.sprite.00.png",
  "McAuley\'s Riprap": "images/armor/boot/heavy_boots.sprite.00.png",
  "McAuley\'s Superstition": "images/weapon/wand/bone_wand.sprite.00.png",
  "McAuley\'s Taboo": "images/armor/glove/heavy_gloves.sprite.00.png",
  "Milabrega\'s Diadem": "images/armor/helmet/crown.sprite.00.png",
  "Milabrega\'s Orb": "images/armor/shield/kite_shield.sprite.00.png",
  "Milabrega\'s Robe": "images/armor/armor/ancient_armor.sprite.00.png",
  "Milabrega\'s Rod": "images/weapon/scepter/war_scepter.sprite.00.png",
  "Naj\'s Circlet": "images/armor/circlet/circlet.sprite.00.png",
  "Natalya\'s Mark": "images/weapon/h2h/natalyas_mark.sprite.00.png",
  "Ondal\'s Almighty": "images/armor/helmet/ondals_almighty.sprite.00.png",
  "Sigon\'s Guard": "images/armor/shield/tower_shield.sprite.00.png",
  "Sigon\'s Shelter": "images/armor/armor/gothic_plate.sprite.00.png",
  "Sigon\'s Visor": "images/armor/helmet/great_helm.sprite.00.png",
  "Tal Rasha\'s Adjudication": "images/misc/amulet/amulet.sprite.00.png",
  "Tancred\'s Crowbill": "images/weapon/axe/military_pick.sprite.00.png",
  "Tancred\'s Skull": "images/armor/helmet/bone_helm.sprite.00.png",
  "Tancred\'s Spine": "images/armor/armor/full_plate_mail.sprite.00.png",
  "Tancred\'s Weird": "images/misc/amulet/amulet.sprite.00.png",
  "Telling of Beads": "images/misc/amulet/amulet.sprite.00.png",
  "Vidala\'s Ambush": "images/armor/armor/leather_armor.sprite.00.png",
  "Vidala\'s Barb": "images/weapon/bow/long_battle_bow.sprite.00.png",
  "Vidala\'s Snare": "images/misc/amulet/amulet.sprite.00.png",
};

function findImage(name, baseName, code) {
  if (IMAGE_MAP[name]) return IMAGE_MAP[name];
  const clean = s => s.toLowerCase().replace(/'/g,'').replace(/-/g,' ').replace(/  /g,' ').trim();
  const cleanName = clean(name), cleanBase = clean(baseName||'');
  // Already handled by IMAGE_MAP above
  // Type code fallback
  if (code && TYPE_FALLBACKS[code.toLowerCase()]) return TYPE_FALLBACKS[code.toLowerCase()];
  return '';
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
export async function runImport() {
console.log('Loading game data...');
const uniqueItems = load('uniqueitems.json');
const armorData   = load('armor.json');
const weaponData  = load('weapons.json');
const runeData    = load('runes.json');
const setData     = load('setitems.json');
const itemsData   = load('items.json');

// Wipe existing products and trades
console.log('Wiping existing products and trades...');
const raw = db.getRawData();
const gameId = 'g_d2r_resurrected'; // fixed ID matching db.js seedIfEmpty
// Delete all existing products and trades via db
for (const id of Object.keys(raw.products)) delete raw.products[id];
for (const id of Object.keys(raw.trades)) delete raw.trades[id];
db.persist();

let count = 0;

function makeProductId(name, suffix) {
  // Deterministic ID based on item name so it survives restarts
  const clean = (name + (suffix ? '_' + suffix : '')).toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 50);
  return 'p_d2r_' + clean;
}

// Track used IDs to handle collisions
const usedIds = new Set();
function addProduct(name, chars, costInGame, image, suffix) {
  if (!name || !costInGame) return;
  let id = makeProductId(name, suffix);
  // Handle any remaining collisions with a counter
  if (usedIds.has(id)) {
    let i = 2;
    while (usedIds.has(id + '_' + i)) i++;
    id = id + '_' + i;
  }
  usedIds.add(id);
  db.insertProduct({
    id, game_id: gameId, name: name.trim(),
    characteristics: chars.trim(),
    cost_in_game: Math.floor(costInGame),
    image: image || ''
  });
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
  const itype = [rw.itype1,rw.itype2,rw.itype3].filter(Boolean).join('/');
  const props = humanProps(rw, 'T1Code', 'T1Min', 'T1Max');
  const chars = `Runeword: ${runes} / Socket: ${itype || 'various'}${props ? ' / ' + props : ''}`;
  const cost = runewordCost(runes);
  addProduct(name, chars, cost, '', 'rw');  // 'rw' suffix avoids collision with same-named unique
}

// ── 3. UNIQUE ITEMS ───────────────────────────────────────────────────────────
console.log('Importing unique items...');
const uniqueNameCount = {};
for (const [k, item] of Object.entries(uniqueItems)) {
  if (!item.spawnable || !item.index) continue;
  const name = item.index;
  uniqueNameCount[name] = (uniqueNameCount[name] || 0) + 1;
}
const uniqueNameSeen = {};
for (const [k, item] of Object.entries(uniqueItems)) {
  if (!item.spawnable || !item.index) continue;
  const name = item.index;
  const baseName = item['*ItemName'] || '';
  const lvlReq = item['lvl req'] || 1;
  const props = humanProps(item);
  const chars = `Unique ${baseName}${props ? ' / ' + props : ''}`;
  const cost = Math.max(500, lvlReq * lvlReq * 10);
  const img = findImage(name, baseName, item.code || '');
  // Handle duplicate names (e.g. Rainbow Facet has fire/cold/ltng/pois variants)
  uniqueNameSeen[name] = (uniqueNameSeen[name] || 0) + 1;
  const suffix = uniqueNameCount[name] > 1 ? String(uniqueNameSeen[name]) : undefined;
  addProduct(name, chars, cost, img, suffix);
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
  const simg = findImage(name, baseName, item.item || '');
  addProduct(name, chars, cost, simg);
}

// ── 5. BASE ARMOR ─────────────────────────────────────────────────────────────
console.log('Importing base armor...');
for (const [k, item] of Object.entries(armorData)) {
  if (!item.spawnable || !item.name) continue;
  const name = item.name;
  const defMin = item.minac || 0, defMax = item.maxac || 0;
  const reqStr = item.reqstr || 0;
  const sockets = item.gemsockets || 0;
  const chars = `Base armor / Defense: ${defMin}-${defMax} / Req Str: ${reqStr}${sockets ? ` / Max Sockets: ${sockets}` : ''}`;
  const cost = Math.max(200, (defMin + defMax) * 3);
  const aimg = findImage(name, '', item.code || '');
  addProduct(name, chars, cost, aimg, 'armor');
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
  const wimg = findImage(name, '', item.code || '');
  addProduct(name, chars, cost, wimg, 'wpn');
}

  db.persist();
  console.log(`\n✓ Import complete! ${count} products added to D2R.`);
} // end runImport
