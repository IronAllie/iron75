/* Food search: verified USDA database shipped with the app, plus live branded/barcode lookups. */
import { CONFIG } from "./config.js";
import { NUT_KEYS } from "./nutrition.js";

let DB = null, loading = null;
export function foodDbReady() { return !!DB; }
export function loadFoodDb() {
  if (DB) return Promise.resolve(DB);
  if (loading) return loading;
  loading = fetch("data/foods.json").then(r => { if (!r.ok) throw new Error("food file " + r.status); return r.json(); }).then(j => {
    const keys = j.keys;
    DB = j.foods.map(f => {
      const per100 = {}; keys.forEach((k, i) => { if (f[4][i] != null) per100[k] = f[4][i]; });
      const name = f[1];
      return { key: "usda:" + f[0], src: f[3] === "sr" ? "usda" : "usda_fndds", srcId: String(f[0]), name, cat: f[2] || "", per100,
        portions: f[5].map(p => ({ label: p[0], g: p[1] })), lc: name.toLowerCase(), words: name.toLowerCase().split(/[^a-z0-9%]+/).filter(Boolean) };
    });
    return DB;
  }).catch(e => { loading = null; throw e; });
  return loading;
}
const stem = w => w.length > 3 ? w.replace(/(ies)$/, "y").replace(/(es|s)$/, "") : w;
const SYN = { oatmeal: "oat", oats: "oat", chix: "chicken", ground: "ground", hamburger: "beef", burger: "burger", pb: "peanut", ff: "fries", yoghurt: "yogurt", soda: "carbonated" };
const LOW = /baby food|infant formula|babyfood/i;

/* Common foods: the everyday entries people mean, pinned to the top (like the curated "common foods" in MyFitnessPal and MacroFactor). */
const STAPLES = {
  "chicken breast": ["Chicken, broilers or fryers, breast, meat only, cooked, roasted", "Chicken breast, grilled without sauce, skin not eaten"],
  "chicken thigh": ["Chicken thigh, baked or broiled, skin not eaten, from pre-cooked", "Chicken thigh, NS as to cooking method, skin not eaten"],
  "chicken": ["Chicken, broilers or fryers, breast, meat only, cooked, roasted", "Chicken breast, grilled without sauce, skin not eaten", "Chicken thigh, NS as to cooking method, skin not eaten"],
  "egg": ["Egg, whole, boiled or poached", "Egg, whole, fried with oil", "Egg, whole, fried no added fat"],
  "salmon": ["Fish, salmon, Atlantic, farmed, cooked, dry heat", "Fish, salmon, sockeye, cooked, dry heat", "Fish, salmon, Atlantic, wild, cooked, dry heat"],
  "steak": ["Beef, top sirloin, steak, separable lean only, trimmed to 0\" fat, all grades, cooked, broiled", "Beef, steak, sirloin, lean and fat eaten", "Beef, steak, strip, NS as to fat eaten", "Beef, rib eye steak, boneless, lip off, separable lean and fat, trimmed to 0\" fat, all grades, cooked, grilled"],
  "sirloin": ["Beef, top sirloin, steak, separable lean only, trimmed to 0\" fat, all grades, cooked, broiled"],
  "ribeye": ["Beef, rib eye steak, boneless, lip off, separable lean and fat, trimmed to 0\" fat, all grades, cooked, grilled"],
  "ground beef": ["Beef, ground, 85% lean meat / 15% fat, crumbles, cooked, pan-browned", "Beef, ground, 80% lean meat / 20% fat, crumbles, cooked, pan-browned", "Beef, ground, 85% lean meat / 15% fat, patty, cooked, pan-broiled"],
  "ground turkey": ["Turkey, ground, 93% lean, 7% fat, pan-broiled crumbles", "Turkey, ground, 85% lean, 15% fat, pan-broiled crumbles"],
  "tuna": ["Fish, tuna, light, canned in water, drained solids (Includes foods for USDA's Food Distribution Program)"],
  "shrimp": ["Shrimp, steamed or boiled", "Shrimp, baked or broiled"],
  "tilapia": ["Fish, tilapia, cooked, dry heat"],
  "pork chop": ["Pork, chop, lean only eaten", "Pork, fresh, loin, center loin (chops), bone-in, separable lean only, cooked, broiled"],
  "bacon": ["Pork, cured, bacon, cooked, baked", "Pork, cured, bacon, cooked, microwaved", "Bacon, turkey, microwaved"],
  "oatmeal": ["Oatmeal, instant, plain, made with water, no added fat", "Oatmeal, instant, plain, made with milk, no added fat", "Cereals, oats, regular and quick, not fortified, dry"],
  "oat": ["Cereals, oats, regular and quick, not fortified, dry", "Oatmeal, instant, plain, made with water, no added fat"],
  "white rice": ["Rice, white, cooked, no added fat", "Rice, white, cooked, made with oil"],
  "rice": ["Rice, white, cooked, no added fat", "Rice, brown, cooked, no added fat"],
  "brown rice": ["Rice, brown, cooked, no added fat"],
  "greek yogurt": ["Yogurt, Greek, nonfat, plain, CHOBANI", "Yogurt, Greek, whole, plain, CHOBANI"],
  "cottage cheese": ["Cheese, cottage, lowfat, 2% milkfat"],
  "milk": ["Milk, reduced fat, fluid, 2% milkfat, with added nonfat milk solids and vitamin A and vitamin D", "Milk, whole, 3.25% milkfat, without added vitamin A and vitamin D", "Milk, nonfat, fluid, with added vitamin A and vitamin D (fat free or skim)"],
  "protein powder": ["Beverages, Protein powder whey based", "Beverages, Whey protein powder isolate"],
  "whey": ["Beverages, Protein powder whey based", "Beverages, Whey protein powder isolate"],
  "protein shake": ["Beverages, Protein powder whey based", "Nutritional drink or shake, high protein, ready-to-drink, NFS"],
  "apple": ["Apple, raw"], "banana": ["Banana, raw"], "orange": ["Orange, raw"], "avocado": ["Avocado, raw"],
  "grape": ["Grapes, red or green (European type, such as Thompson seedless), raw"], "strawberry": ["Strawberries, raw"], "blueberry": ["Blueberries, raw"],
  "spinach": ["Spinach, raw"], "broccoli": ["Broccoli, cooked, boiled, drained, without salt"],
  "potato": ["Potato, baked, peel not eaten"], "sweet potato": ["Sweet potato, baked, no added fat"],
  "pasta": ["Pasta, cooked, enriched, without added salt"], "quinoa": ["Quinoa, cooked"],
  "bread": ["Bread, white, commercially prepared (includes soft bread crumbs)", "Bread, white wheat"],
  "bagel": ["Bagels, plain, enriched, with calcium propionate (includes onion, poppy, sesame), toasted"],
  "tortilla": ["Tortilla, flour"], "black bean": ["Black beans, from canned, no added fat"],
  "cheddar": ["Cheese, cheddar (Includes foods for USDA's Food Distribution Program)"], "cheese": ["Cheese, cheddar (Includes foods for USDA's Food Distribution Program)"],
  "peanut butter": ["Peanut butter"], "almond": ["Almonds, NFS", "Almonds, salted"], "olive oil": ["Olive oil"], "butter": ["Butter, salted", "Butter, without salt"],
  "coffee": ["Coffee, brewed"], "hamburger": ["Hamburger, NFS", "Hamburger, from fast food, 1 medium patty"], "cheeseburger": ["Cheeseburger, NFS", "Cheeseburger (McDonalds)"],
  "french fry": ["Potatoes, french fried, all types, salt not added in processing, frozen, oven-heated"], "fry": ["Potatoes, french fried, all types, salt not added in processing, frozen, oven-heated"]
};
let STAPLE_IDX = null;
function staplesFor(toks) {
  if (!STAPLE_IDX) { STAPLE_IDX = {}; const byName = new Map(DB.map(f => [f.name, f])); for (const k in STAPLES) STAPLE_IDX[k.split(" ").map(stem).join(" ")] = STAPLES[k].map(n => byName.get(n)).filter(Boolean); }
  return STAPLE_IDX[toks.join(" ")] || [];
}
export function searchLocal(q, boosts) {
  if (!DB) return [];
  const toks = q.toLowerCase().split(/[^a-z0-9%]+/).filter(Boolean).map(t => stem(SYN[t] || t));
  if (!toks.length) return [];
  const pinned = staplesFor(toks), pinnedSet = new Set(pinned);
  const out = pinned.map((f, i) => [1000 - i, f]);
  for (const f of DB) {
    if (pinnedSet.has(f)) continue;
    let ok = true, score = 0;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i]; let hit = -1, exact = false;
      for (let j = 0; j < f.words.length; j++) { const w = f.words[j]; if (w === t || stem(w) === t) { hit = j; exact = true; break; } if (hit < 0 && w.startsWith(t)) hit = j; }
      if (hit < 0) { ok = false; break; }
      score += (exact ? 10 : 3) + (hit === 0 ? 6 : hit < 3 ? 3 : 0);
    }
    if (!ok) continue;
    const segWords = f.lc.split(",")[0].split(/[^a-z0-9%]+/).filter(Boolean).map(stem);
    const segHits = toks.filter(t => segWords.includes(t)).length;
    if (segHits === toks.length) score += 10 - Math.max(0, segWords.length - toks.length) * 3;
    score -= f.words.length * 0.6;
    const protein = /poultry|beef|pork|lamb|veal|game|finfish|shellfish|sausage|egg/i.test(f.cat) || /\b(chicken|beef|pork|turkey|salmon|tuna|fish|shrimp|steak|egg)\b/.test(f.lc);
    if (/\braw\b/.test(f.lc) && !toks.includes("raw")) score -= protein ? 6 : 0;
    if (!protein && /\braw\b/.test(f.lc) && /fruit|vegetable/i.test(f.cat)) score += 3;
    if (/\b(cooked|roasted|grilled|baked|boiled|broiled|poached|scrambled)\b/.test(f.lc)) score += protein ? 3 : 1;
    if (f.src === "usda_fndds") score += 1;
    if (LOW.test(f.lc) || LOW.test(f.cat)) score -= 20;
    const qs = toks.join(" ");
    if (/skin not eaten|meat only|lean only/.test(f.lc)) score += 4;
    if (/\bnfs\b/.test(f.lc)) score += 2;
    if (/luncheon|sausage/i.test(f.cat) && !/deli|lunch|sausage|roll|bologna|ham|salami|hot dog/.test(qs)) score -= 8;
    if (/\b(coated|breaded|battered)\b/.test(f.lc) && !/coat|bread|batter|fried|nugget|tender/.test(qs)) score -= 4;
    if (/\b(with sauce|with gravy|in sauce)\b/.test(f.lc) && !/sauce|gravy/.test(qs)) score -= 2;
    if (boosts && boosts[f.key]) score += Math.min(15, boosts[f.key] * 3);
    out.push([score, f]);
  }
  out.sort((a, b) => b[0] - a[0]);
  return out.slice(0, 60).map(x => x[1]);
}

/* ---- Open Food Facts ---- */
const OFF_FIELDS = "code,product_name,brands,nutriments,serving_size,serving_quantity,image_front_small_url";
function offToItem(p) {
  const n = p.nutriments || {};
  let kcal = n["energy-kcal_100g"]; if (kcal === undefined && n.energy_100g !== undefined) kcal = n.energy_100g / 4.184;
  if (kcal === undefined || !p.product_name) return null;
  const g = v => (v === undefined || v === "" ? undefined : +v);
  const per100 = { kcal: +kcal, p: g(n.proteins_100g), c: g(n.carbohydrates_100g), f: g(n.fat_100g), fib: g(n.fiber_100g), sug: g(n.sugars_100g), asug: g(n["added-sugars_100g"]),
    sat: g(n["saturated-fat_100g"]), trans: g(n["trans-fat_100g"]), chol: n.cholesterol_100g !== undefined ? n.cholesterol_100g * 1000 : undefined,
    na: n.sodium_100g !== undefined ? n.sodium_100g * 1000 : undefined, k: n.potassium_100g !== undefined ? n.potassium_100g * 1000 : undefined,
    ca: n.calcium_100g !== undefined ? n.calcium_100g * 1000 : undefined, fe: n.iron_100g !== undefined ? n.iron_100g * 1000 : undefined,
    vC: n["vitamin-c_100g"] !== undefined ? n["vitamin-c_100g"] * 1000 : undefined, vD: n["vitamin-d_100g"] !== undefined ? n["vitamin-d_100g"] * 1e6 : undefined,
    caf: n.caffeine_100g !== undefined ? n.caffeine_100g * 1000 : undefined };
  Object.keys(per100).forEach(k => per100[k] === undefined || isNaN(per100[k]) ? delete per100[k] : 0);
  const sq = +p.serving_quantity;
  const portions = sq > 0 ? [{ label: p.serving_size || "1 serving", g: sq }] : [];
  return { key: "off:" + p.code, src: "off", srcId: String(p.code || ""), name: p.product_name, brand: p.brands ? String(p.brands).split(",")[0].trim() : "", per100, portions, img: p.image_front_small_url || "" };
}
export async function offSearch(q, tries = 2) {
  try {
    const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=30&fields=${OFF_FIELDS}`);
    if (!r.ok) throw new Error("off " + r.status);
    const j = await r.json(); return (j.products || []).map(offToItem).filter(Boolean);
  } catch (e) {
    if (tries > 1) { await new Promise(r => setTimeout(r, 700)); return offSearch(q, tries - 1); }
    throw e;
  }
}
export async function offBarcode(code) {
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
  if (!r.ok) return null;
  const j = await r.json(); return j && j.status === 1 && j.product ? offToItem({ ...j.product, code }) : null;
}

/* ---- USDA Branded Foods (FoodData Central API) ---- */
const NBR = { "208":"kcal","203":"p","205":"c","204":"f","291":"fib","269":"sug","539":"asug","606":"sat","605":"trans","601":"chol","307":"na","306":"k","301":"ca","303":"fe","304":"mg","305":"phos","309":"zn","320":"vA","401":"vC","328":"vD","262":"caf" };
function fdcToItem(f) {
  const per100 = {};
  for (const n of f.foodNutrients || []) { const k = NBR[String(n.nutrientNumber)]; if (k && n.value != null) per100[k] = +n.value; }
  if (per100.kcal == null) { const e = (f.foodNutrients || []).find(n => n.unitName === "KCAL"); if (e) per100.kcal = +e.value; else return null; }
  const unit = (f.servingSizeUnit || "").toLowerCase();
  const portions = f.servingSize && (unit === "g" || unit === "grm" || unit === "ml" || unit === "mlt") ? [{ label: f.householdServingFullText ? `${f.householdServingFullText} (${Math.round(f.servingSize)} ${unit.startsWith("m") ? "ml" : "g"})` : `1 serving (${Math.round(f.servingSize)} g)`, g: +f.servingSize }] : [];
  const name = (f.description || "").replace(/\b\w/g, c => c.toUpperCase()).replace(/\B\w/g, c => c.toLowerCase());
  return { key: "fdc:" + f.fdcId, src: "usda_branded", srcId: String(f.fdcId), name, brand: f.brandName || f.brandOwner || "", per100, portions, barcode: f.gtinUpc || "" };
}
export async function fdcSearch(q) {
  const key = CONFIG.USDA_API_KEY || "DEMO_KEY";
  const r = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(q)}&dataType=Branded&pageSize=40`);
  if (r.status === 429) throw new Error("rate");
  if (!r.ok) throw new Error("fdc " + r.status);
  const j = await r.json(); return (j.foods || []).map(fdcToItem).filter(Boolean);
}
export async function lookupBarcode(code) {
  const c = String(code).replace(/\D/g, "");
  let item = await offBarcode(c).catch(() => null);
  if (item) return item;
  const list = await fdcSearch(c).catch(() => []);
  return list.find(x => x.barcode && x.barcode.replace(/^0+/, "") === c.replace(/^0+/, "")) || list[0] || null;
}

/* ---- Amount math ---- */
export function unitsFor(item) {
  const u = [];
  for (const p of item.portions || []) u.push({ id: "p:" + p.label, label: p.label, g: p.g });
  if (item.per100) { u.push({ id: "g", label: "grams", g: 1 }); u.push({ id: "oz", label: "ounces", g: 28.3495 }); }
  if (item.perServing) u.unshift({ id: "serving", label: item.serving || "serving", g: item.grams || 0, serving: true });
  return u;
}
export function computeNutrients(item, amount, unitId) {
  const out = {}; const units = unitsFor(item); const u = units.find(x => x.id === unitId) || units[0];
  let grams = null;
  if (u && u.serving) {
    for (const k of NUT_KEYS) if (item.perServing[k] != null) out[k] = item.perServing[k] * amount;
    grams = item.grams ? item.grams * amount : null;
  } else if (u && item.per100) {
    grams = u.g * amount;
    for (const k of NUT_KEYS) if (item.per100[k] != null) out[k] = item.per100[k] * grams / 100;
  }
  for (const k in out) out[k] = Math.round(out[k] * 100) / 100;
  return { nutrients: out, grams, unitLabel: u ? u.label : "" };
}
export function defaultUnit(item) {
  const u = unitsFor(item);
  const ok = x => x.id.startsWith("p:") && x.g > 0 && !/yield|refuse|bone|chopped|diced|shredded|NFS|not specified/i.test(x.label);
  const PREF = ["serving","egg","large","medium","breast","thigh","fillet","steak","patty","link","slice","piece","bar","bottle","can","container","tortilla","bagel","muffin","banana","apple","orange","scoop","oz","cup","tbsp","tablespoon","small"];
  let pref = u.find(x => x.serving);
  if (!pref) for (const w of PREF) { pref = u.find(x => ok(x) && new RegExp("^1 " + w + "\\b", "i").test(x.label)); if (pref) break; }
  pref = pref || u.find(ok) || u.find(x => x.id === "g");
  return pref ? pref.id : (u[0] && u[0].id);
}
export function customToItem(c) {
  return { key: "custom:" + c.id, src: c.kind === "food" ? "custom" : c.kind, srcId: c.id, name: c.name, brand: c.brand || "", perServing: c.nutrients, serving: c.serving, grams: c.grams || null,
    per100: c.grams ? Object.fromEntries(Object.entries(c.nutrients).map(([k, v]) => [k, v * 100 / c.grams])) : null, portions: [], custom: c };
}

/* ---- Barcode scanning (camera) ---- */
let zxing = null;
async function zx() { if (!zxing) zxing = await import("https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm"); return zxing; }
export async function startScanner(video, onCode) {
  const { BrowserMultiFormatReader } = await zx();
  const reader = new BrowserMultiFormatReader();
  const controls = await reader.decodeFromConstraints({ video: { facingMode: "environment" } }, video, (res, err, ctl) => {
    if (res) { ctl.stop(); onCode(res.getText()); }
  });
  return controls;
}
export async function decodeImageFile(file) {
  const { BrowserMultiFormatReader } = await zx();
  const reader = new BrowserMultiFormatReader();
  const url = URL.createObjectURL(file);
  try { const r = await reader.decodeFromImageUrl(url); return r.getText(); } finally { URL.revokeObjectURL(url); }
}
