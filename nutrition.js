/* Nutrient metadata, daily targets (DRI), and the adaptive expenditure coach. */
import { addDays, diff, todayK } from "./util.js";

// key, label, unit, group, kind (goal = reach at least, limit = stay under, info)
export const NUTRIENTS = [
  ["kcal","Calories","kcal","energy","limit"], ["p","Protein","g","macro","goal"], ["c","Carbs","g","macro","info"], ["f","Fat","g","macro","info"],
  ["fib","Fiber","g","carb","goal"], ["sug","Sugars","g","carb","limit"], ["asug","Added sugars","g","carb","limit"],
  ["sat","Saturated fat","g","fat","limit"], ["mono","Monounsaturated fat","g","fat","info"], ["poly","Polyunsaturated fat","g","fat","info"], ["trans","Trans fat","g","fat","limit"], ["chol","Cholesterol","mg","fat","limit"],
  ["na","Sodium","mg","mineral","limit"], ["k","Potassium","mg","mineral","goal"], ["ca","Calcium","mg","mineral","goal"], ["fe","Iron","mg","mineral","goal"], ["mg","Magnesium","mg","mineral","goal"], ["phos","Phosphorus","mg","mineral","goal"], ["zn","Zinc","mg","mineral","goal"], ["se","Selenium","µg","mineral","goal"],
  ["vA","Vitamin A","µg","vitamin","goal"], ["vC","Vitamin C","mg","vitamin","goal"], ["vD","Vitamin D","µg","vitamin","goal"], ["vE","Vitamin E","mg","vitamin","goal"], ["vK","Vitamin K","µg","vitamin","goal"],
  ["b1","Thiamin (B1)","mg","vitamin","goal"], ["b2","Riboflavin (B2)","mg","vitamin","goal"], ["b3","Niacin (B3)","mg","vitamin","goal"], ["b6","Vitamin B6","mg","vitamin","goal"], ["fol","Folate","µg","vitamin","goal"], ["b12","Vitamin B12","µg","vitamin","goal"], ["chol_n","Choline","mg","vitamin","goal"],
  ["caf","Caffeine","mg","other","limit"], ["alc","Alcohol","g","other","info"], ["h2o","Water from food","g","other","info"]
];
export const NUT = Object.fromEntries(NUTRIENTS.map(n => [n[0], { key: n[0], label: n[1], unit: n[2], group: n[3], kind: n[4] }]));
export const NUT_KEYS = NUTRIENTS.map(n => n[0]);
export const MACRO_KEYS = ["kcal","p","c","f","fib","sug","na"];

/* Adult Dietary Reference Intakes (NIH ODS), simplified by sex and age band. */
export function microTargets(sex, age) {
  const m = sex !== "f", old = +age > 50, older = +age > 70;
  return {
    trans: 2, chol: 300, na: 2300, caf: 400,
    k: m ? 3400 : 2600, ca: (!m && old) || older ? 1200 : 1000, fe: m || old ? 8 : 18, mg: m ? 420 : 320, phos: 700, zn: m ? 11 : 8, se: 55,
    vA: m ? 900 : 700, vC: m ? 90 : 75, vD: older ? 20 : 15, vE: 15, vK: m ? 120 : 90,
    b1: m ? 1.2 : 1.1, b2: m ? 1.3 : 1.1, b3: m ? 16 : 14, b6: old ? (m ? 1.7 : 1.5) : 1.3, fol: 400, b12: 2.4, chol_n: m ? 550 : 425
  };
}

export const GOAL_RATES = [
  ["-1", "Lose 1% of body weight per week (aggressive)"],
  ["-0.75", "Lose 0.75% per week"],
  ["-0.5", "Lose 0.5% per week (steady)"],
  ["-0.25", "Recomp: lose 0.25% per week while building"],
  ["0", "Maintain"],
  ["0.25", "Lean gain: +0.25% per week"],
  ["0.5", "Gain: +0.5% per week"]
];
export const ACTIVITY = [
  ["1.2", "Sedentary job, no planned exercise"],
  ["1.375", "Desk job + 3–4 workouts a week"],
  ["1.55", "Desk job + daily training and walks (75-style)"],
  ["1.725", "On your feet all day + daily training"],
  ["1.9", "Physical labor + hard training"]
];

export function bmr(p, w) {
  const kg = w * 0.45359, cm = ((+p.ft || 0) * 12 + (+p.inch || 0)) * 2.54;
  return 10 * kg + 6.25 * cm - 5 * (+p.age || 30) + (p.sex === "f" ? -161 : 5);
}

/* Trend weight: exponentially smoothed (10% per day), like Hacker's Diet / MacroFactor-style trend lines. */
export function trendSeries(weights) {
  const ks = Object.keys(weights).filter(k => weights[k] > 0).sort();
  if (!ks.length) return {};
  const out = {}; let t = weights[ks[0]];
  for (let k = ks[0]; k <= todayK(); k = addDays(k, 1)) {
    if (weights[k] > 0) t = t + 0.1 * (weights[k] - t);
    out[k] = t;
  }
  return out;
}

/* Adaptive expenditure: average intake minus the energy stored or released, read from the change in trend weight. */
export function estimateExpenditure({ weights, intake, profile, latestWeight }) {
  const today = todayK(), end = addDays(today, -1);
  const w = latestWeight || +profile.weight || 0;
  const formula = w && profile.ft && profile.age ? bmr(profile, w) * (+profile.activity || 1.55) : 0;
  const trend = trendSeries(weights);
  let span = 21, start = addDays(end, -(span - 1));
  const logged = []; let weighIns = 0;
  for (let k = start; k <= end; k = addDays(k, 1)) {
    if (intake[k] > 600) logged.push(intake[k]);
    if (weights[k] > 0) weighIns++;
  }
  const tStart = trend[addDays(start, -1)] ?? trend[start], tEnd = trend[end];
  const res = { formula: Math.round(formula), estimate: Math.round(formula), confidence: 0, loggedDays: logged.length, weighIns, span, avgIntake: 0, trendChange: 0, ready: false };
  if (logged.length < 7 || weighIns < 5 || tStart == null || tEnd == null) return res;
  const avg = logged.reduce((a, b) => a + b, 0) / logged.length;
  const dT = tEnd - tStart;
  const data = avg - (dT * 3500) / span;
  const conf = Math.min(1, logged.length / 14) * Math.min(1, weighIns / 10);
  res.avgIntake = Math.round(avg); res.trendChange = dT; res.ready = true; res.confidence = conf;
  res.estimate = Math.round(formula ? conf * data + (1 - conf) * formula : data);
  res.dataOnly = Math.round(data);
  return res;
}

/* Calorie and macro targets from expenditure, goal rate and body weight. */
export function computeTargets({ profile, expenditure, weight }) {
  const w = weight || +profile.weight || 0;
  if (!w || !expenditure) return null;
  const rate = +profile.rate || 0; // percent of body weight per week
  const kcalDelta = (rate / 100) * w * 3500 / 7;
  const floor = profile.sex === "f" ? 1200 : 1500;
  const kcal = Math.max(floor, Math.round((expenditure + kcalDelta) / 10) * 10);
  const goalW = +profile.goalWeight || w;
  const pPerLb = +profile.proteinPerLb || 1;
  const p = Math.round(Math.min(w, Math.max(goalW, w * 0.8)) * pPerLb);
  const f = Math.round(Math.max(0.3 * w, kcal * 0.25 / 9));
  const c = Math.max(40, Math.round((kcal - p * 4 - f * 9) / 4));
  const micro = microTargets(profile.sex, profile.age);
  return {
    kcal, p, c, f,
    fib: Math.max(25, Math.round(kcal / 1000 * 14)),
    sug: Math.round(kcal * 0.10 / 4) + 25,
    asug: Math.round(kcal * 0.10 / 4),
    sat: Math.round(kcal * 0.10 / 9),
    ...micro
  };
}
export function weeklyChangeLb(rate, w) { return (rate / 100) * w; }
export function daysBetween(a, b) { return diff(a, b); }
