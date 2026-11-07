/* App logic shared by the views: settings, program, progression, streaks, analysis. */
import { D, saveProfile, saveDay, saveWorkout, saveFood, deleteFood } from "./store.js";
import { EX, generateProgram, blockAdjust, nextWeight, deloadWeight, PRESETS } from "./library.js";
import { NUT_KEYS, estimateExpenditure, computeTargets, microTargets, trendSeries, bmr } from "./nutrition.js";
import { addDays, diff, todayK, parseK, wkStart, clone, e1rm, uuid } from "./util.js";

export const S = { tab: "today", view: todayK(), sheet: null, viewer: null, modal: null, status: "", toast: "", routineEdit: null, picker: null, onboard: 0, auth: "signin", authMsg: "", confirm: null, exChart: "", cmpA: "", cmpB: "" };

export const DEFAULT_RULES = [
  { id: "w1", label: "Workout 1: today's training session (45+ min)", on: true },
  { id: "w2", label: "Workout 2: outdoors (45+ min)", on: true },
  { id: "eat", label: "Ate right: within calories, hit protein", on: true },
  { id: "alcohol", label: "No alcohol, no cheat meals", on: true },
  { id: "water", label: "Drink the water target", on: true },
  { id: "read", label: "Read 10 pages of nonfiction", on: true },
  { id: "photos", label: "Two progress photos (morning and evening)", on: true }
];
export const BUILTIN_RULES = new Set(DEFAULT_RULES.map(r => r.id));

export function settings() {
  const p = D.profile || {};
  const prx = PRESETS[0];
  return {
    onboarded: !!p.onboarded,
    about: { sex: "", age: "", ft: "", inch: "", weight: "", goalWeight: "", activity: "1.55", rate: "-0.25", proteinPerLb: "1", ...(p.about || {}) },
    gear: { preset: "", equipment: [], dbKind: "fixed5", dbMax: 50, bar: 45, plates: [45, 35, 25, 10, 5, 2.5], ...(p.gear || {}) },
    training: { days: 4, minutes: 60, level: "intermediate", goal: "recomp", ...(p.training || {}) },
    program: { source: "generated", routineId: "", startDate: "", ...(p.program || {}) },
    challenge: { started: false, startDate: todayK(), length: 75, strict: true, water: 128, rules: DEFAULT_RULES.map(r => ({ ...r })), ...(p.challenge || {}) },
    targets: { mode: "auto", applied: null, appliedAt: "", manual: {}, ...(p.targets || {}) },
    prxPreset: prx
  };
}
export function setSettings(fn) {
  const s = settings(); delete s.prxPreset; fn(s);
  D.profile = s; saveProfile();
}

/* ---------- Days, workouts, food ---------- */
export const day = k => D.days[k] || {};
export function editDay(k, fn) { const d = clone(D.days[k] || {}); fn(d); D.days[k] = d; saveDay(k); }
export const workout = k => D.workouts[k] || null;
export function editWorkout(k, fn) { const w = clone(D.workouts[k] || { items: [] }); fn(w); D.workouts[k] = w; saveWorkout(k); }
export const foodOn = k => D.food[k] || [];
export function addFood(e) { const entry = { id: uuid(), created_at: new Date().toISOString(), ...e }; (D.food[e.date] = D.food[e.date] || []).push(entry); saveFood(entry); return entry; }
export function updateFood(e) { const list = D.food[e.date] || []; const i = list.findIndex(x => x.id === e.id); if (i >= 0) list[i] = e; saveFood(e); }
export function removeFood(id) { for (const k in D.food) { const before = D.food[k].length; D.food[k] = D.food[k].filter(e => e.id !== id); if (D.food[k].length !== before) { deleteFood(id); return; } } }
export function dayTotals(k) { const t = {}; for (const key of NUT_KEYS) t[key] = 0; for (const e of foodOn(k)) for (const key in e.nutrients) t[key] = (t[key] || 0) + (+e.nutrients[key] || 0); return t; }
export function weightsMap() { const m = {}; for (const k in D.days) { const w = +D.days[k].weight; if (w > 0) m[k] = w; } return m; }
export function latestWeight(upTo) { const ks = Object.keys(D.days).filter(k => !upTo || k <= upTo).sort().reverse(); for (const k of ks) { const w = +D.days[k].weight; if (w > 0) return w; } return 0; }
export function intakeMap() { const m = {}; for (const k in D.food) { if (!D.food[k].length) continue; m[k] = D.food[k].reduce((a, e) => a + (+e.nutrients.kcal || 0), 0); } return m; }

/* ---------- Targets ---------- */
export function expenditure() { const s = settings(); return estimateExpenditure({ weights: weightsMap(), intake: intakeMap(), profile: s.about, latestWeight: latestWeight() }); }
export function profileReady(s) { const a = (s || settings()).about; return !!(a.sex && +a.age && +a.ft && (latestWeight() || +a.weight)); }
export function targets(k) {
  const s = settings(), a = s.about, w = latestWeight(k) || +a.weight;
  let t = null;
  if (s.targets.applied) t = { ...computeTargets({ profile: a, expenditure: 2000, weight: w || 180 }), ...s.targets.applied };
  else if (profileReady(s)) t = computeTargets({ profile: a, expenditure: bmr(a, w) * (+a.activity || 1.55), weight: w });
  if (s.targets.mode === "manual") { t = t || { ...microTargets(a.sex, a.age), fib: 30, sug: 75, asug: 50, sat: 22, kcal: 0, p: 0, c: 0, f: 0 }; for (const key in s.targets.manual) if (+s.targets.manual[key] > 0) t[key] = +s.targets.manual[key]; }
  if (t && !(t.kcal > 0 && t.p > 0)) return null;
  return t;
}
export function proposedTargets() {
  const s = settings(), ex = expenditure(), w = latestWeight() || +s.about.weight;
  if (!profileReady(s)) return null;
  return { ex, t: computeTargets({ profile: s.about, expenditure: ex.estimate, weight: w }) };
}
export function eatStatus(k) {
  const t = targets(k), tot = dayTotals(k), n = foodOn(k).length;
  if (!t) return { auto: false, ok: !!(day(k).habits || {}).eat, tot, t, n };
  const ok = n > 0 && tot.kcal <= t.kcal * 1.05 && tot.kcal >= t.kcal * 0.7 && tot.p >= t.p * 0.9;
  return { auto: true, ok, tot, t, n };
}

/* ---------- Program ---------- */
let progMemo = { key: "", prog: null };
export function program() {
  const s = settings();
  if (s.program.source === "routine" && D.routines[s.program.routineId]) { const r = D.routines[s.program.routineId]; return { ...r.data, name: r.name, routineId: r.id }; }
  const key = JSON.stringify([s.gear.equipment, s.training]);
  if (progMemo.key !== key) progMemo = { key, prog: generateProgram({ equipment: s.gear.equipment, ...s.training }) };
  return progMemo.prog;
}
export function programStart() { const s = settings(); return s.program.startDate || s.challenge.startDate || todayK(); }
export function programWeek(k) { return Math.max(1, Math.floor(diff(k, programStart()) / 7) + 1); }
export function sessionFor(k) {
  const p = program(); const w = workout(k);
  const id = (w && w.sessionId) || p.schedule[parseK(k).getDay()];
  return p.days.find(d => d.id === id) || null;
}
export function plannedItems(k, sess) {
  const p = program(), wk = programWeek(k);
  return (sess.items || []).map(it => blockAdjust(it, wk, p.deloadEvery || 4));
}
export function isDeload(k) { const p = program(); return programWeek(k) % (p.deloadEvery || 4) === 0; }

/* ---------- History, progression, PRs ---------- */
export function history(exId, before) {
  const out = [];
  for (const k of Object.keys(D.workouts).sort()) {
    if (before && k >= before) continue;
    const w = D.workouts[k]; for (const it of w.items || []) if (it.ex === exId) { const sets = (it.sets || []).filter(x => +x.r > 0); if (sets.length) out.push({ k, sets }); }
  }
  return out;
}
export function lastPerf(exId, before) { const h = history(exId, before); return h.length ? h[h.length - 1] : null; }
const loadOf = (ex, x) => (ex.load === "bw" ? (+x.w || 0) : +x.w || 0);
export function setScore(ex, x) { const w = loadOf(ex, x), r = +x.r; if (!(r > 0)) return 0; if (ex.unit === "sec") return r; return ex.load === "bw" ? (w + 100) * (1 + r / 30) : (w > 0 && r <= 20 ? e1rm(w, r) : 0); }
export function bestBefore(exId, before) {
  const ex = EX[exId] || { load: "bb" }; let best = { sc: 0, w: 0, r: 0, maxW: 0, repsAt: {} };
  for (const h of history(exId, before)) for (const x of h.sets) {
    const sc = setScore(ex, x); if (sc > best.sc) Object.assign(best, { sc, w: +x.w || 0, r: +x.r, k: h.k });
    best.maxW = Math.max(best.maxW, +x.w || 0); const w = +x.w || 0; best.repsAt[w] = Math.max(best.repsAt[w] || 0, +x.r);
  }
  return best;
}
export function prTypes(exId, x, date) {
  const ex = EX[exId] || { load: "bb" }; const b = bestBefore(exId, date); if (!b.sc) return [];
  const t = []; const sc = setScore(ex, x), w = +x.w || 0, r = +x.r;
  if (sc > b.sc * 1.001) t.push(ex.unit === "sec" ? "Longest hold" : "Best est. 1RM");
  if (w > b.maxW && w > 0) t.push("Heaviest weight");
  else if (r > (b.repsAt[w] || 0) && b.repsAt[w] !== undefined) t.push(`Most reps at ${w}`);
  return t;
}
export function advise(item, k, deload) {
  const ex = EX[item.ex] || { load: "bb", name: item.ex }; const gear = settings().gear;
  const last = lastPerf(item.ex, k); const u = ex.load === "db" ? "lb each" : ex.load === "bw" ? "+lb" : ex.unit === "sec" ? "s" : "lb";
  if (!last) return { w: "", text: ex.unit === "sec" ? `Hold for ${item.lo}–${item.hi} seconds.` : ex.load === "bw" ? `Bodyweight. Once every set hits ${item.hi}, add weight.` : `First time: pick a weight you could do for about ${item.hi + 2} reps and stop at ${item.hi}. Leave 1–2 reps in the tank.`, last: null, unit: u };
  const w = Math.max(...last.sets.map(x => +x.w || 0));
  const allTop = last.sets.length >= Math.max(1, item.sets - 1) && last.sets.every(x => +x.r >= item.hi);
  let nw = w, text;
  if (deload) { nw = w > 0 ? deloadWeight(w, ex, gear) : w; text = `Deload: ${nw ? nw + " " + u + ", " : ""}${item.sets} sets, stop 3 reps short of failure.`; }
  else if (allTop) {
    nw = ex.unit === "sec" ? w : nextWeight(w, ex, gear);
    if (ex.unit === "sec") text = `Hit ${item.hi}s on every set. Add 5–10 seconds or make it harder.`;
    else if (nw === w) text = ex.load === "db" ? `You've hit the top of your dumbbells. Add a rep per set or slow the lowering to 3 s.` : `Hit ${item.hi} on every set. Add reps or slow the tempo.`;
    else text = `You hit ${item.hi} on every set. Go up to ${nw} ${u} today and work back up the rep range.`;
  } else text = `Stay at ${w} ${u}. Beat last time by at least one rep somewhere.`;
  return { w: nw, text, last, unit: u };
}

/* ---------- Rules, streaks, challenge ---------- */
export const photosOn = (k, kind) => Object.values(D.photos).filter(p => p.date === k && p.kind === kind);
export const progSlot = (k, slot) => Object.values(D.photos).find(p => p.date === k && p.kind === "progress" && p.slot === slot);
export function ruleDone(r, k) {
  const d = day(k), h = d.habits || {}, s = settings();
  switch (r.id) {
    case "eat": return eatStatus(k).ok;
    case "water": return (+d.water || 0) >= (+s.challenge.water || 128);
    case "read": return !!h.read || (+d.pages || 0) >= 10;
    case "photos": return !!(progSlot(k, "am") && progSlot(k, "pm"));
    case "w1": { const w = workout(k); return !!h.w1 || !!(w && w.finished); }
    default: return !!h[r.id];
  }
}
export function dayStatus(k) { const rs = settings().challenge.rules.filter(r => r.on); const n = rs.filter(r => ruleDone(r, k)).length; return { n, total: rs.length, done: rs.length > 0 && n === rs.length, any: n > 0 }; }
const R = id => settings().challenge.rules.find(r => r.id === id) || DEFAULT_RULES.find(r => r.id === id);
export const STREAKS = [
  ["exercise", "Exercise", k => ruleDone(R("w1"), k) && ruleDone(R("w2"), k)],
  ["eat", "Eating", k => ruleDone(R("eat"), k)],
  ["read", "Reading", k => ruleDone(R("read"), k)],
  ["photos", "Photos", k => ruleDone(R("photos"), k)],
  ["water", "Water", k => ruleDone(R("water"), k)]
];
function firstKey() { const s = settings(); const ks = [...Object.keys(D.days), ...Object.keys(D.workouts), ...Object.keys(D.food)].sort(); const a = ks[0] || todayK(); return a < s.challenge.startDate ? a : s.challenge.startDate; }
export function streak(fn) {
  const today = todayK(), first = firstKey(); const todayDone = fn(today);
  let cur = 0, k = todayDone ? today : addDays(today, -1);
  while (k >= first && fn(k)) { cur++; k = addDays(k, -1); if (cur > 3000) break; }
  let best = 0, run = 0; for (let x = first; x <= today; x = addDays(x, 1)) { if (fn(x)) { run++; if (run > best) best = run; } else run = 0; }
  return { cur, best, todayDone };
}
export function challenge() {
  const c = settings().challenge, today = todayK(); let start = c.startDate, attempts = 1, missed = 0, prevMiss = false;
  for (let k = c.startDate; k < today; k = addDays(k, 1)) {
    if (diff(k, start) >= c.length) break;
    if (!dayStatus(k).done) { missed++; if (c.strict) { start = addDays(k, 1); if (!prevMiss) attempts++; } prevMiss = true; } else prevMiss = false;
  }
  const n = diff(today, start) + 1;
  return { start, n, attempts, missed, finished: n > c.length, notStarted: n < 1, length: c.length, strict: c.strict };
}

/* ---------- Analysis ---------- */
export function liftScore(exId, keys) {
  const ex = EX[exId] || { load: "bb" }; let best = null; const set = new Set(keys);
  for (const k of keys) { const w = D.workouts[k]; if (!w) continue; for (const it of w.items || []) if (it.ex === exId) for (const x of it.sets || []) { const sc = setScore(ex, x); if (sc > 0 && (!best || sc > best.sc)) best = { sc, w: +x.w || 0, r: +x.r, k }; } }
  return set.size ? best : null;
}
export const weekKeys = ws => Array.from({ length: 7 }, (_, i) => addDays(ws, i));
export function liftWeeks() { const s = new Set(); for (const k in D.workouts) if ((D.workouts[k].items || []).some(it => (it.sets || []).some(x => +x.r > 0))) s.add(wkStart(k)); return [...s].sort(); }
export function exercisesLogged() { const s = new Set(); for (const k in D.workouts) for (const it of D.workouts[k].items || []) if ((it.sets || []).some(x => +x.r > 0)) s.add(it.ex); return [...s]; }
export function weekCompare() {
  const weeks = liftWeeks(); if (!weeks.length) return null;
  const A = weeks[weeks.length - 1], B = weeks.length > 1 ? weeks[weeks.length - 2] : null;
  const ka = weekKeys(A), kb = B ? weekKeys(B) : [];
  const rows = [];
  for (const id of exercisesLogged()) {
    const a = liftScore(id, ka), b = B ? liftScore(id, kb) : null; if (!a && !b) continue;
    let ch = "new", cls = "flat";
    if (a && b) { const pct = (a.sc - b.sc) / b.sc * 100; ch = (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%"; cls = pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat"; }
    else if (!a) ch = "not done";
    rows.push({ id, a, b, ch, cls });
  }
  return { A, B, rows, up: rows.filter(r => r.cls === "up").length, down: rows.filter(r => r.cls === "down").length, both: rows.filter(r => r.a && r.b).length };
}
export function weeklyVolume() {
  const m = {}; for (const k in D.workouts) { const wk = wkStart(k); for (const it of D.workouts[k].items || []) { const ex = EX[it.ex]; if (!ex || ex.load === "bw" || ex.unit === "sec") continue; for (const x of it.sets || []) { const v = (+x.w || 0) * (+x.r || 0) * (ex.load === "db" ? 2 : 1); if (v > 0) m[wk] = (m[wk] || 0) + v; } } }
  return Object.keys(m).sort().map(k => ({ k, y: Math.round(m[k]) }));
}
export function setsPerMuscle(ws) {
  const out = {}; for (const k of weekKeys(ws)) { const w = D.workouts[k]; if (!w) continue; for (const it of w.items || []) { const ex = EX[it.ex]; if (!ex) continue; const n = (it.sets || []).filter(x => +x.r > 0).length; if (!n) continue; const m = muscleGroup(ex); out[m] = (out[m] || 0) + n; } }
  return out;
}
const MG = { squat: "Quads", lunge: "Quads", quad_iso: "Quads", hinge: "Hamstrings & glutes", ham_iso: "Hamstrings & glutes", glute: "Hamstrings & glutes", h_push: "Chest", chest_iso: "Chest", v_push: "Shoulders", lat_delt: "Shoulders", rear_delt: "Shoulders", h_pull: "Back", v_pull: "Back", biceps: "Arms", triceps: "Arms", calf: "Calves", core_flex: "Core", core_anti: "Core", cond: "Conditioning" };
export const muscleGroup = ex => MG[ex.pattern] || "Other";
export function weightTrendRate() {
  const tr = trendSeries(weightsMap()); const ks = Object.keys(tr).sort(); if (ks.length < 10) return null;
  const end = ks[ks.length - 1], start = ks.find(k => k >= addDays(end, -27)) || ks[0]; if (diff(end, start) < 10) return null;
  return (tr[end] - tr[start]) / diff(end, start) * 7;
}
export function waistChange() {
  const ks = Object.keys(D.days).filter(k => D.days[k].meas && +D.days[k].meas.waist > 0).sort(); if (ks.length < 2) return null;
  const recent = ks[ks.length - 1]; const base = ks.find(k => k >= addDays(recent, -42)) || ks[0]; if (base === recent) return null;
  return { d: +D.days[recent].meas.waist - +D.days[base].meas.waist, days: diff(recent, base) };
}
export function verdict() {
  const today = todayK(), recent = [], prev = [];
  for (let i = 0; i < 14; i++) recent.push(addDays(today, -i));
  for (let i = 21; i < 42; i++) prev.push(addDays(today, -i));
  let n = 0, up = 0, sum = 0;
  for (const id of exercisesLogged()) { const a = liftScore(id, recent), b = liftScore(id, prev); if (a && b) { n++; const pct = (a.sc - b.sc) / b.sc * 100; sum += pct; if (pct > 1) up++; } }
  const wt = weightTrendRate(), waist = waistChange(), avg = n ? sum / n : 0;
  const t = targets(today); let pDays = 0, pHit = 0;
  for (let i = 0; i < 7; i++) { const k = addDays(today, -i); if (foodOn(k).length) { pDays++; if (t && dayTotals(k).p >= t.p * 0.9) pHit++; } }
  const stats = { n, up, avg, wt, waist, pDays, pHit };
  if (n < 2) return { cls: "", head: "Not enough data yet", body: "After about 3 weeks of logged lifts, this compares your last 2 weeks with the 3 weeks before and tells you whether you're building. Log every set and weigh in most mornings.", stats };
  const sUp = avg > 1 || up >= Math.ceil(n / 2), sDown = avg < -2, losing = wt !== null && wt < -0.25, gaining = wt !== null && wt > 0.25;
  if (sUp && losing) return { cls: "good", head: "Recomping", body: "You're getting stronger while your weight trend drops. You're building muscle and losing fat at the same time.", stats };
  if (sUp && gaining) return { cls: waist && waist.d > 0.5 ? "warn" : "good", head: "Building", body: "Strength and body weight are both rising. " + (waist && waist.d > 0.5 ? "Your waist is growing too, so trim about 150 calories a day." : "Your waist is holding, so most of that gain is likely muscle."), stats };
  if (sUp) return { cls: "good", head: "Building", body: "Strength is climbing at a steady body weight. That's what a recomposition looks like.", stats };
  if (sDown) return { cls: "bad", head: "Losing strength", body: "Your lifts went down. Eat closer to your calorie target, sleep 7+ hours, and hit protein. If you're beat up, take a deload week early.", stats };
  if (losing) return { cls: "warn", head: "Cutting, holding strength", body: "Fat loss is working and strength is holding. To build, add a rep or two each week and keep protein high.", stats };
  return { cls: "warn", head: "Stalled", body: "Strength and weight are both flat. Make sure you add reps or weight each week, hit protein, and sleep enough.", stats };
}
