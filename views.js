/* All screens. Pure functions of state that return HTML strings. */
import { D, configured, photoUrlSync } from "./store.js";
import { S, settings, day, workout, foodOn, dayTotals, targets, proposedTargets, eatStatus, program, programWeek, sessionFor, plannedItems, isDeload, advise, prTypes, ruleDone, dayStatus, STREAKS, streak, challenge, progSlot, photosOn, liftScore, weekKeys, weekCompare, weeklyVolume, setsPerMuscle, verdict, exercisesLogged, latestWeight, weightsMap, profileReady, BUILTIN_RULES, expenditure, history, setScore } from "./core.js";
import { EX, EXERCISES, EQUIPMENT_GROUPS, EQUIPMENT_LABEL, PRESETS, DB_KINDS, GOALS, PATTERN_LABEL, hasEq, alternatives, videoUrl, generateProgram, platesFor } from "./library.js";
import { NUTRIENTS, NUT, GOAL_RATES, ACTIVITY, trendSeries } from "./nutrition.js";
import { unitsFor, computeNutrients, foodDbReady, defaultUnit } from "./food.js";
import { esc, fmt, r1, md, fmtDate, todayK, addDays, diff, wkStart, parseK, dayIdx } from "./util.js";

const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
export const MEALS = [["b","Breakfast"],["l","Lunch"],["d","Dinner"],["s","Snacks"]];
const MEAS = ["waist","chest","arms","hips","thighs","neck"];
const sel = (id, opts, val, attrs = "") => `<select id="${id}" ${attrs}>${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(val) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
const field = (label, inner, cls = "") => `<label class="field ${cls}"><span>${label}</span>${inner}</label>`;
const numIn = (id, val, attrs = "", ph = "") => `<input type="number" inputmode="decimal" id="${id}" value="${esc(val ?? "")}" placeholder="${esc(ph)}" ${attrs}>`;

/* ---------- Shared pieces ---------- */
export function header() {
  return `<div class="top"><div class="brand">Iron 75</div><div class="small muted" id="statusMsg">${esc(S.status)}</div></div>`;
}
export function dateBar() {
  const isT = S.view === todayK();
  return `<div class="card datebar"><button class="btn sm" data-act="prev" aria-label="Previous day">‹</button><div class="grow">${isT ? "Today · " : ""}${fmtDate(S.view)}</div>${isT ? "" : `<button class="btn sm" data-act="next" aria-label="Next day">›</button><button class="btn sm" data-act="gotoday">Today</button>`}</div>`;
}
function streakTiles() {
  return `<div class="streaks">${STREAKS.map(([id, l, fn]) => { const st = streak(fn); return `<div class="streak ${st.cur >= 3 ? "hot" : ""} ${st.todayDone ? "done" : ""}"><div class="label">${l}</div><b class="num">${st.cur}</b><small>best ${st.best}</small></div>`; }).join("")}</div><p class="small muted">Days in a row. A green outline means today is done; otherwise finish today to keep it alive.</p>`;
}
export function macroRow(key, val, target) {
  const n = NUT[key]; let cls = "", pct = target ? Math.min(100, val / target * 100) : 0;
  if (n.kind === "limit") cls = val > target ? "bad" : val > target * 0.9 ? "gold" : "";
  if (n.kind === "goal") cls = val >= target * 0.9 ? "ok" : "";
  const tag = n.kind === "limit" ? "limit" : n.kind === "goal" ? "goal" : "target";
  const unit = n.unit === "kcal" ? "" : " " + n.unit;
  return `<div class="macro"><span>${esc(n.label)}</span><div class="bar ${cls}"><i style="width:${pct}%"></i></div><span class="v">${val < 10 && val % 1 ? r1(val) : fmt(val)} / ${target ? (target < 10 ? r1(target) : fmt(target)) : "–"}${unit} <span class="muted small">${tag}</span></span></div>`;
}
function photoImg(p, thumb, alt) { const u = photoUrlSync(thumb && p.thumb_path ? p.thumb_path : p.path); return u ? `<img src="${esc(u)}" alt="${esc(alt)}" loading="lazy">` : `<span class="small muted">Loading…</span>`; }
export function lineChart(pts, label, unit, trend) {
  if (pts.length < 2) return `<p class="empty">Log ${esc(label.toLowerCase())} on at least two days to see a trend.</p>`;
  const W = 600, H = 180, pl = 46, pr = 60, pt = 14, pb = 26;
  const all = trend ? pts.concat(trend) : pts;
  const x0 = Math.min(...all.map(p => dayIdx(p.k))), x1 = Math.max(...all.map(p => dayIdx(p.k))), span = Math.max(1, x1 - x0);
  let lo = Math.min(...all.map(p => p.y)), hi = Math.max(...all.map(p => p.y)); if (hi - lo < 1) { hi += 1; lo -= 1; } const py = (hi - lo) * .12; lo -= py; hi += py;
  const X = k => pl + (dayIdx(k) - x0) / span * (W - pl - pr), Y = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const ticks = [lo + (hi - lo) * .15, (lo + hi) / 2, hi - (hi - lo) * .15], dec = (hi - lo) < 10 ? 1 : 0, ft = v => Math.abs(v) >= 10000 ? Math.round(v / 1000) + "k" : v.toFixed(dec);
  const main = trend || pts; const line = main.map((p, i) => (i ? "L" : "M") + X(p.k).toFixed(1) + " " + Y(p.y).toFixed(1)).join(" ");
  const L = main[main.length - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} chart">${ticks.map(t => `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${pl - 6}" y="${Y(t) + 4}" text-anchor="end">${ft(t)}</text>`).join("")}
  ${trend ? "" : `<path class="area" d="${line} L${X(L.k).toFixed(1)} ${H - pb} L${X(main[0].k).toFixed(1)} ${H - pb} Z"/>`}
  ${trend ? pts.map(p => `<circle class="rawdot" cx="${X(p.k)}" cy="${Y(p.y)}" r="2.5"/>`).join("") : ""}
  <path class="line" d="${line}"/>${trend ? "" : main.slice(0, -1).map(p => `<circle class="dot" cx="${X(p.k)}" cy="${Y(p.y)}" r="2.5"/>`).join("")}
  <circle class="end" cx="${X(L.k)}" cy="${Y(L.y)}" r="5"/><text class="endlbl" x="${X(L.k) + 9}" y="${Y(L.y) + 4}">${ft(L.y)}</text>
  <text x="${pl}" y="${H - 6}">${md(main[0].k)}</text><text x="${W - pr}" y="${H - 6}" text-anchor="end">${md(L.k)}</text></svg><p class="small muted">${esc(unit)}</p>`;
}
function barChart(pts, unit) {
  if (!pts.length) return `<p class="empty">Log a lifting session to see weekly volume.</p>`;
  const p2 = pts.slice(-10), W = 600, H = 170, pl = 46, pr = 10, pt = 14, pb = 26, max = Math.max(...p2.map(p => p.y)) * 1.15;
  const bw = (W - pl - pr) / p2.length, Y = v => pt + (1 - v / max) * (H - pt - pb), ft = v => v >= 10000 ? Math.round(v / 1000) + "k" : Math.round(v);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly volume">${[0.5, 1].map(f => `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${Y(max * f / 1.15)}" y2="${Y(max * f / 1.15)}"/><text x="${pl - 6}" y="${Y(max * f / 1.15) + 4}" text-anchor="end">${ft(max * f / 1.15)}</text>`).join("")}${p2.map((p, i) => `<rect class="barr" x="${pl + i * bw + bw * .18}" y="${Y(p.y)}" width="${bw * .64}" height="${H - pb - Y(p.y)}" rx="3"/><text x="${pl + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${md(p.k)}</text>`).join("")}</svg><p class="small muted">${esc(unit)}</p>`;
}
function isStandalone() { return navigator.standalone === true || matchMedia("(display-mode: standalone)").matches; }
function installCard() {
  let dismissed = false; try { dismissed = localStorage.getItem("iron75-install-dismissed") === "1"; } catch (e) {}
  if (isStandalone() || dismissed) return "";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return `<div class="card"><div class="row between"><h3>Put Iron 75 on your home screen</h3><button class="x" data-act="dismissInstall" aria-label="Dismiss">×</button></div><p class="small">${ios ? "In Safari, tap Share (the square with an arrow), then <b>Add to Home Screen</b> → <b>Add</b>." : "In Chrome, open the ⋮ menu and choose <b>Add to Home screen</b> or <b>Install app</b>."}</p></div>`;
}

/* ---------- Auth ---------- */
export function vAuth() {
  const msg = S.authMsg ? `<p class="note">${esc(S.authMsg)}</p>` : "";
  const hero = `<div class="hero-auth"><div class="daynum">Iron 75</div><p>Train, eat and track like it matters, for 75 days straight. Programs built for your equipment, a 13,000-food verified database, adaptive calorie targets, progress photos and streaks.</p></div>`;
  if (!configured) return hero + `<div class="card"><h2>Not connected yet</h2><p class="small">This copy of Iron 75 isn't connected to a Supabase database, so accounts and sync are off. The owner fills in <code>config.js</code> to turn them on (see SETUP.md).</p><button class="btn primary" data-act="localMode">Use on this device only</button></div>`;
  if (S.auth === "signup") return hero + `<form class="card" data-form="signup"><h2>Create your account</h2>${msg}
    ${field("Your first name", `<input type="text" id="au-name" autocomplete="given-name" required>`)}
    ${field("Email", `<input type="email" id="au-email" autocomplete="email" required>`)}
    ${field("Password (8+ characters)", `<input type="password" id="au-pass" autocomplete="new-password" minlength="8" required>`)}
    <button class="btn primary block" type="submit">Create account</button>
    <button class="btn block" type="button" data-act="auth" data-to="signin">I already have an account</button></form>`;
  if (S.auth === "forgot") return hero + `<form class="card" data-form="forgot"><h2>Reset your password</h2>${msg}
    ${field("Email", `<input type="email" id="au-email" autocomplete="email" required>`)}
    <button class="btn primary block" type="submit">Email me a reset link</button>
    <button class="btn block" type="button" data-act="auth" data-to="signin">Back to sign in</button></form>`;
  if (S.auth === "newpass") return hero + `<form class="card" data-form="newpass"><h2>Choose a new password</h2>${msg}
    ${field("New password (8+ characters)", `<input type="password" id="au-pass" autocomplete="new-password" minlength="8" required>`)}
    <button class="btn primary block" type="submit">Save password</button></form>`;
  if (S.auth === "check") return hero + `<div class="card"><h2>Check your email</h2><p>${esc(S.authMsg || "We sent you a link. Open it on this phone to finish.")}</p><button class="btn block" data-act="auth" data-to="signin">Back to sign in</button></div>`;
  return hero + `<form class="card" data-form="signin"><h2>Sign in</h2>${msg}
    ${field("Email", `<input type="email" id="au-email" autocomplete="email" required>`)}
    ${field("Password", `<input type="password" id="au-pass" autocomplete="current-password" required>`)}
    <button class="btn primary block" type="submit">Sign in</button>
    <div class="row between"><button class="btn sm" type="button" data-act="auth" data-to="signup">Create an account</button><button class="btn sm" type="button" data-act="auth" data-to="forgot">Forgot password?</button></div></form>`;
}

/* ---------- Onboarding ---------- */
export function vOnboard() {
  const s = settings(), a = s.about, g = s.gear, t = s.training, c = s.challenge, step = S.onboard;
  const dots = `<div class="steps">${[0,1,2,3,4,5].map(i => `<i class="${i <= step ? "on" : ""}"></i>`).join("")}</div>`;
  const nav = (next = "Continue") => `<div class="row between">${step ? `<button class="btn" data-act="obBack">Back</button>` : "<span></span>"}<button class="btn primary" data-act="obNext">${next}</button></div>`;
  let body = "";
  if (step === 0) body = `<h2>Welcome${D.displayName ? ", " + esc(D.displayName) : ""}</h2><p>Six quick steps and Iron 75 builds your training program, calorie and macro targets, and your 75-day challenge.</p>${field("What should we call you?", `<input type="text" id="ob-name" value="${esc(D.displayName)}" autocomplete="given-name">`)}${nav("Let's go")}`;
  if (step === 1) body = `<h2>About you</h2><p class="small muted">Used to estimate how many calories you burn. Iron 75 refines this from your real weight and food logs after 2–3 weeks.</p>
    <div class="grid2">${field("Sex (for the formula)", sel("ab-sex", [["","Choose"],["m","Male"],["f","Female"]], a.sex, 'data-ab="sex"'))}${field("Age", numIn("ab-age", a.age, 'data-ab="age"'))}
    ${field("Height (ft)", numIn("ab-ft", a.ft, 'data-ab="ft"', "5"))}${field("Height (in)", numIn("ab-inch", a.inch, 'data-ab="inch"', "10"))}
    ${field("Weight (lb)", numIn("ab-weight", a.weight, 'data-ab="weight"'))}${field("Goal weight (lb)", numIn("ab-goalWeight", a.goalWeight, 'data-ab="goalWeight"'))}</div>
    ${field("Daily activity", sel("ab-activity", ACTIVITY, a.activity, 'data-ab="activity"'))}${nav()}`;
  if (step === 2) body = `<h2>Your goal</h2>${field("Body weight goal", sel("ab-rate", GOAL_RATES, a.rate, 'data-ab="rate"'))}
    ${field("Training focus", sel("tr-goal", Object.entries(GOALS), t.goal, 'data-tr="goal"'))}
    ${field("Protein", sel("ab-proteinPerLb", [["0.8","0.8 g per lb of goal weight"],["1","1 g per lb (recommended)"],["1.2","1.2 g per lb (aggressive cut)"]], a.proteinPerLb, 'data-ab="proteinPerLb"'))}
    <p class="small muted">Recomp (lose 0.25% a week) builds muscle while slowly losing fat. Faster loss costs more strength.</p>${nav()}`;
  if (step === 3) body = `<h2>Your equipment</h2><p class="small muted">Pick a starting point, then tick exactly what you have. Your program only uses this equipment.</p>${equipmentEditor(g)}${nav()}`;
  if (step === 4) {
    const prog = generateProgram({ equipment: g.equipment, ...t });
    body = `<h2>Your training</h2>${trainingPrefs(t)}<h3 style="margin-top:6px">Preview: ${esc(prog.name)}</h3>${programDays(prog, true)}${nav()}`;
  }
  if (step === 5) body = `<h2>The 75-day challenge</h2><p>Every day: both workouts, eat right, drink your water, read 10 pages, and take two progress photos. You can change the rules any time in More.</p>
    <div class="grid2">${field("Start date", `<input type="date" id="ch-start" value="${esc(c.startDate)}">`)}${field("Length (days)", numIn("ch-length", c.length, 'min="7" max="365"'))}</div>
    <label class="switch"><input type="checkbox" id="ch-strict" ${c.strict ? "checked" : ""}><span><b>Strict mode.</b> Miss any item and you restart at Day 1, like 75 Hard. Streaks are tracked either way.</span></label>${nav("Start Day 1")}`;
  return `<div class="card">${dots}${body}</div>`;
}
export function equipmentEditor(g) {
  const own = new Set(g.equipment);
  return `${field("Start from a preset", sel("eq-preset", [["","Choose a preset…"], ...PRESETS.map(p => [p.id, p.name])], g.preset))}
  ${EQUIPMENT_GROUPS.map(([grp, items]) => `<div class="eqgrp"><div class="label">${grp}</div><div class="chips">${items.map(([id, l]) => `<button class="chip ${own.has(id) ? "on" : ""}" data-act="eqToggle" data-id="${id}" aria-pressed="${own.has(id)}">${esc(l)}</button>`).join("")}</div></div>`).join("")}
  ${own.has("dumbbells") ? `<div class="grid2">${field("Dumbbell type", sel("eq-dbKind", Object.entries(DB_KINDS).filter(([k]) => k !== "none").map(([k, v]) => [k, v.label]), g.dbKind))}${field("Heaviest dumbbell (lb)", numIn("eq-dbMax", g.dbMax))}</div>` : ""}
  ${own.has("barbell") ? `<div class="grid2">${field("Bar weight (lb)", numIn("eq-bar", g.bar))}${field("Plates you own (lb, comma separated)", `<input type="text" id="eq-plates" value="${esc((g.plates || []).join(", "))}">`)}</div>` : ""}
  <p class="small muted">${g.equipment.length} items selected · ${EXERCISES.filter(e => hasEq(e, g.equipment) && e.pattern !== "cond").length} exercises available.</p>`;
}
function trainingPrefs(t) {
  return `<div class="grid2">${field("Lifting days per week", sel("tr-days", [2,3,4,5,6].map(n => [n, n + " days"]), t.days, 'data-tr="days"'))}${field("Time per session", sel("tr-minutes", [[30,"30 min"],[45,"45 min"],[60,"60 min"],[75,"75 min"],[90,"90 min"]], t.minutes, 'data-tr="minutes"'))}
  ${field("Experience", sel("tr-level", [["beginner","Beginner (under 1 year)"],["intermediate","Intermediate (1–3 years)"],["advanced","Advanced (3+ years)"]], t.level, 'data-tr="level"'))}${field("Focus", sel("tr-goal2", Object.entries(GOALS), t.goal, 'data-tr="goal"'))}</div>`;
}
function programDays(prog, compact) {
  return prog.days.map(d => `<div class="pday"><div class="row between"><b>${esc(d.name)}</b><span class="small muted">${esc(d.sub)} · ${Object.entries(prog.schedule).filter(([, v]) => v === d.id).map(([k]) => DOW[k]).join(", ") || "not scheduled"}</span></div>
   ${d.kind === "lift" ? `<div class="tbl"><table><tbody>${d.items.map(it => `<tr><td>${esc(EX[it.ex] ? EX[it.ex].name : it.ex)}</td><td class="n">${it.sets}×${it.lo === it.hi ? it.lo : it.lo + "–" + it.hi}${EX[it.ex] && EX[it.ex].unit === "sec" ? "s" : ""}</td></tr>`).join("")}</tbody></table></div>${d.finisher && !compact ? `<p class="small muted">${esc(d.finisher)}</p>` : ""}` : `<ul class="plain small">${(d.checklist || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>`}</div>`).join("");
}

/* ---------- Today ---------- */
export function vToday() {
  const s = settings(), k = S.view, d = day(k), ch = challenge(), st = dayStatus(k), es = eatStatus(k);
  const pct = Math.min(100, Math.max(0, (ch.n - 1) / ch.length * 100)), viewN = diff(k, ch.start) + 1;
  const sess = sessionFor(k);
  let hero = ch.notStarted ? `<div class="daynum">0<small> /${ch.length}</small></div><p class="muted">Starts ${fmtDate(s.challenge.startDate)}</p>` : ch.finished ? `<div class="daynum">${ch.length}<small> /${ch.length}</small></div><span class="pill gold">Challenge complete</span>` : `<div class="daynum">Day ${ch.n}<small> /${ch.length}</small></div>`;
  const rules = s.challenge.rules.filter(r => r.on).map(r => {
    const on = ruleDone(r, k);
    if (r.id === "water") { const w = +d.water || 0, t = +s.challenge.water || 128; return `<div class="water ${on ? "on" : ""}"><div class="row between"><span><b>Water</b> <span class="mono">${w} / ${t} oz</span></span><span class="small muted">${(w / 128).toFixed(2)} gal</span></div><div class="bar ${on ? "ok" : ""}"><i style="width:${Math.min(100, w / t * 100)}%"></i></div><div class="row">${[8, 16, 32].map(n => `<button class="btn sm" data-act="water" data-n="${n}">+${n} oz</button>`).join("")}<button class="btn sm" data-act="water" data-n="-8" aria-label="Remove 8 ounces">−8</button></div></div>`; }
    if (r.id === "eat" && es.auto) { const sub = es.n ? `${fmt(es.tot.kcal)} / ${fmt(es.t.kcal)} kcal · ${Math.round(es.tot.p)} / ${es.t.p} g protein` : "Log your food on the Food tab"; return `<button class="check auto ${on ? "on" : ""}" data-tab="food"><span class="box"></span><span class="txt">${esc(r.label)}<span class="sub">Automatic · ${esc(sub)}</span></span></button>`; }
    if (r.id === "photos") { const n = (progSlot(k, "am") ? 1 : 0) + (progSlot(k, "pm") ? 1 : 0); return `<div class="check auto ${on ? "on" : ""}"><span class="box"></span><span class="txt">${esc(r.label)}<span class="sub">Automatic · ${n} of 2 taken (below)</span></span></div>`; }
    const w = workout(k); const sub = r.id === "eat" ? "Set up your profile in More to check this automatically" : r.id === "read" && +d.pages > 0 ? `${d.pages} pages logged` : r.id === "w1" && w && w.finished ? "Finished in Train" : "";
    return `<button class="check ${on ? "on" : ""}" data-act="habit" data-id="${esc(r.id)}" aria-pressed="${on}"><span class="box"></span><span class="txt">${esc(r.label)}${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</span></button>`;
  }).join("");
  const slot = (sl, lbl) => { const p = progSlot(k, sl); return p ? `<button class="slot filled" data-act="viewPhoto" data-id="${p.id}">${photoImg(p, true, lbl + " progress photo")}<span class="tag">${lbl}</span></button>` : `<button class="slot" data-act="addProgress" data-slot="${sl}"><span class="plus">+</span><span class="small"><b>${lbl}</b> photo</span><span class="small muted">Tap to take or choose</span></button>`; };
  const num = (key, lbl, step, ph) => field(lbl, `<input type="number" inputmode="decimal" step="${step}" id="f-${key}" data-f="${key}" value="${esc(d[key] ?? "")}" placeholder="${esc(ph ?? "")}">`);
  const scale = (key, lbl) => `<div class="field"><span>${lbl}</span><div class="scale">${[1, 2, 3, 4, 5].map(n => `<button data-act="scale" data-k="${key}" data-n="${n}" class="${+d[key] === n ? "on" : ""}">${n}</button>`).join("")}</div></div>`;
  const t = es.t, tot = es.tot, prop = proposedTargets(), applied = s.targets.applied;
  const checkin = prop && prop.ex.ready && (!s.targets.appliedAt || diff(todayK(), s.targets.appliedAt) >= 7) && (!applied || Math.abs(prop.t.kcal - applied.kcal) >= 50);
  return installCard() + (checkin ? `<div class="card hl"><div class="row between"><h3>Weekly check-in ready</h3><span class="pill blue">Coach</span></div><p class="small">Based on your last ${prop.ex.span} days, you burn about <b class="mono">${fmt(prop.ex.estimate)}</b> calories a day. Suggested target: <b class="mono">${fmt(prop.t.kcal)}</b> kcal and <b class="mono">${prop.t.p} g</b> protein.</p><button class="btn primary" data-act="openCoach">Review</button></div>` : "") + `
  <div class="card"><div class="row between" style="align-items:flex-end"><div class="grow">${hero}</div><div>${ch.strict ? `<span class="pill blue">Strict</span>` : `<span class="pill">Flexible</span>`}${ch.attempts > 1 && ch.strict ? ` <span class="pill">Attempt ${ch.attempts}</span>` : ""}</div></div>
  <div class="bar" aria-label="Challenge progress"><i style="width:${pct}%"></i></div>
  <p class="small muted">${ch.strict ? `This run started ${fmtDate(ch.start)}. Miss one item and you go back to Day 1.` : `${ch.missed} incomplete day${ch.missed === 1 ? "" : "s"} so far.`}</p></div>
  <div class="card"><h2>Streaks</h2>${streakTiles()}</div>
  ${dateBar()}
  <div class="card"><div class="row between"><h2>Daily rules</h2><span class="pill ${st.done ? "ok" : st.any ? "gold" : ""}">${st.n}/${st.total} done</span></div>${viewN >= 1 && viewN <= ch.length && k !== todayK() ? `<p class="small muted">Day ${viewN} of this run</p>` : ""}<div class="rules">${rules}</div></div>
  <div class="card"><div class="row between"><h2>Progress photos</h2><span class="pill ${progSlot(k, "am") && progSlot(k, "pm") ? "ok" : ""}">${(progSlot(k, "am") ? 1 : 0) + (progSlot(k, "pm") ? 1 : 0)}/2</span></div><div class="photos2">${slot("am", "Morning")}${slot("pm", "Evening")}</div><p class="small muted">Same spot, same light, same pose. Photos are private to your account.</p></div>
  <div class="card"><div class="row between"><h2>Food</h2>${t ? `<span class="pill ${es.ok ? "ok" : ""}">${es.ok ? "On target" : "In progress"}</span>` : ""}</div>
  ${t ? `<div class="kcal"><div><div class="big num">${fmt(Math.max(0, t.kcal - tot.kcal))}</div><div class="small muted">calories left of ${fmt(t.kcal)}</div></div><div style="text-align:right"><div class="rx num">${Math.round(tot.p)} / ${t.p} g</div><div class="small muted">protein</div></div></div><div class="bar ${tot.kcal > t.kcal * 1.05 ? "bad" : ""}"><i style="width:${Math.min(100, tot.kcal / t.kcal * 100)}%"></i></div>` : `<p class="small">Finish your profile in More to get calorie and macro targets.</p>`}
  <button class="btn primary" data-tab="food">Log food</button></div>
  <div class="card"><div class="row between"><h2>Training</h2>${sess ? `<span class="pill blue">${esc(sess.name)}</span>` : ""}</div><p class="small muted">${sess ? (sess.kind === "lift" ? `${sess.items.length} exercises · week ${programWeek(k)}${isDeload(k) ? " · deload" : ""}` : "Checklist session") : "Rest day"}</p><button class="btn primary" data-tab="train">Open the session</button></div>
  <div class="card"><h2>Body & recovery</h2><div class="grid3">${num("weight", "Morning weight (lb)", "0.1")}${num("sleep", "Sleep (hrs)", "0.25", "7.5")}${num("steps", "Steps", "100", "8000")}${num("pages", "Pages read", "1", "10")}${num("bodyfat", "Body fat % (optional)", "0.1")}${num("rhr", "Resting HR (optional)", "1")}</div>
  <div class="grid2">${scale("energy", "Energy")}${scale("mood", "Mood")}${scale("sore", "Soreness")}${scale("stress", "Stress")}${scale("hunger", "Hunger")}${scale("sleepq", "Sleep quality")}</div>
  ${field("Notes: wins, how you felt, anything that hurt", `<textarea id="f-notes" data-f="notes">${esc(d.notes || "")}</textarea>`)}
  <details ${d.meas ? "open" : ""}><summary>Measurements (weekly, same time of day)</summary><div class="grid3" style="margin-top:8px">${MEAS.map(m => field(m[0].toUpperCase() + m.slice(1) + " (in)", `<input type="number" step="0.1" inputmode="decimal" id="m-${m}" data-m="${m}" value="${esc(d.meas && d.meas[m] || "")}">`)).join("")}</div></details></div>
  ${calendar(ch)}`;
}
function calendar(ch) {
  if (ch.notStarted) return "";
  const today = todayK(); let cells = "";
  for (let i = 0; i < ch.length; i++) { const k = addDays(ch.start, i); let cls = ""; if (k <= today) { const st = dayStatus(k); cls = st.done ? "done" : k === today ? "" : st.any ? "part" : "miss"; } if (k === today) cls += " today"; cells += `<button class="${cls}" data-act="pick" data-k="${k}" ${k > today ? "disabled" : ""} aria-label="Day ${i + 1}, ${fmtDate(k)}">${i + 1}</button>`; }
  return `<div class="card"><h2>The ${ch.length}</h2><div class="cal">${cells}</div><div class="legend"><span><i style="background:var(--ok)"></i>Complete</span><span><i style="background:var(--gold-soft);outline:1px solid var(--gold)"></i>Partial</span><span><i style="background:var(--bad-soft)"></i>Missed</span></div></div>`;
}

/* ---------- Food ---------- */
export function vFood() {
  const k = S.view, list = foodOn(k), tot = dayTotals(k), t = targets(k), es = eatStatus(k), d = day(k), s = settings();
  let summary;
  if (!t) summary = `<div class="card"><h2>Set your targets</h2><p class="small">Add your age, height, sex and weight in More → <b>About you</b> and Iron 75 calculates calories, protein, carbs, fat and 30+ vitamin and mineral targets.</p><button class="btn primary" data-tab="more">Set up profile</button><div class="macro"><span>Calories</span><div class="bar"><i style="width:0"></i></div><span class="v">${fmt(tot.kcal)} kcal</span></div></div>`;
  else {
    const left = t.kcal - tot.kcal;
    summary = `<div class="card"><div class="kcal"><div><div class="big num">${fmt(Math.abs(left))}</div><div class="small ${left < 0 ? "down" : "muted"}">${left < 0 ? "calories over your limit" : "calories left"}</div></div><div style="text-align:right"><span class="pill ${es.ok ? "ok" : ""}">${es.ok ? "Eating right ✓" : "Not on target yet"}</span><div class="small muted" style="margin-top:4px">${fmt(tot.kcal)} eaten of ${fmt(t.kcal)}</div></div></div>
    <div class="macros4">${[["p","Protein"],["c","Carbs"],["f","Fat"],["fib","Fiber"]].map(([key, l]) => { const v = tot[key] || 0, tg = t[key] || 0; const pc = tg ? Math.min(100, v / tg * 100) : 0; return `<div class="ring"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.9" class="rbg"/><circle cx="18" cy="18" r="15.9" class="rfg ${key === "p" && v >= tg * 0.9 ? "ok" : ""}" stroke-dasharray="${pc} 100"/></svg><b class="num">${Math.round(v)}</b><small>/ ${tg} g</small><span class="label">${l}</span></div>`; }).join("")}</div>
    ${macroRow("sug", tot.sug || 0, t.sug)}${macroRow("sat", tot.sat || 0, t.sat)}${macroRow("na", tot.na || 0, t.na)}
    <div class="row"><button class="btn sm" data-act="openReport">Full nutrient report</button><button class="btn sm" data-act="openCoach">Coach & targets</button></div></div>`;
  }
  const meals = MEALS.map(([m, lbl]) => {
    const es2 = list.filter(e => e.meal === m); const kc = es2.reduce((a, e) => a + (+e.nutrients.kcal || 0), 0), pr = es2.reduce((a, e) => a + (+e.nutrients.p || 0), 0);
    const ph = photosOn(k, "meal").filter(p => p.meal === m);
    return `<div class="card meal"><div class="row between"><h3>${lbl}</h3><span class="mono small">${fmt(kc)} kcal · ${Math.round(pr)} g P</span></div>
    ${es2.map(e => `<div class="entry"><button class="nm" data-act="editEntry" data-id="${e.id}">${esc(e.name)}${e.brand ? ` <span class="muted">· ${esc(e.brand)}</span>` : ""}<div class="small muted">${esc(r1(e.amount))} × ${esc(e.unit)} · ${Math.round(e.nutrients.p || 0)}P ${Math.round(e.nutrients.c || 0)}C ${Math.round(e.nutrients.f || 0)}F</div></button><span class="kc">${fmt(e.nutrients.kcal || 0)}</span><button class="x" data-act="delFood" data-id="${e.id}" aria-label="Remove ${esc(e.name)}">×</button></div>`).join("")}
    ${ph.length ? `<div class="thumbs">${ph.map(p => `<button data-act="viewPhoto" data-id="${p.id}">${photoImg(p, true, lbl + " photo")}</button>`).join("")}</div>` : ""}
    <div class="row"><button class="btn sm primary" data-act="openAdd" data-meal="${m}">Add food</button><button class="btn sm" data-act="openScan" data-meal="${m}">Scan barcode</button><button class="btn sm" data-act="addMealPhoto" data-meal="${m}">Photo</button>${es2.length ? `<button class="btn sm" data-act="saveMeal" data-meal="${m}">Save as meal</button>` : `<button class="btn sm" data-act="copyMeal" data-meal="${m}">Copy yesterday</button>`}</div></div>`;
  }).join("");
  const w = +d.water || 0;
  return dateBar() + summary + meals + `<div class="card"><div class="row between"><h3>Water</h3><span class="mono small">${w} / ${s.challenge.water} oz</span></div><div class="row">${[8, 16, 32].map(n => `<button class="btn sm" data-act="water" data-n="${n}">+${n} oz</button>`).join("")}</div></div>`;
}
export function vReport() {
  const k = S.view, tot = dayTotals(k), t = targets(k) || {};
  const groups = [["Energy & macros", ["kcal","p","c","f"]], ["Carbs", ["fib","sug","asug"]], ["Fats", ["sat","mono","poly","trans","chol"]], ["Vitamins", ["vA","vC","vD","vE","vK","b1","b2","b3","b6","fol","b12","chol_n"]], ["Minerals", ["na","k","ca","fe","mg","phos","zn","se"]], ["Other", ["caf","alc","h2o"]]];
  const missing = foodOn(k).filter(e => Object.keys(e.nutrients).length < 12).length;
  return `<div class="card"><div class="row between"><h2>Nutrients · ${md(k)}</h2><button class="btn sm" data-act="closeModal">Close</button></div>
  ${missing ? `<p class="note small">${missing} logged item${missing === 1 ? "" : "s"} only have label data (no vitamin/mineral breakdown). USDA foods give the most complete picture.</p>` : ""}
  ${groups.map(([g, keys]) => `<div class="label" style="margin-top:6px">${g}</div>${keys.map(key => t[key] ? macroRow(key, tot[key] || 0, t[key]) : `<div class="macro"><span>${esc(NUT[key].label)}</span><span></span><span class="v">${r1(tot[key] || 0)} ${NUT[key].unit}</span></div>`).join("")}`).join("")}
  <p class="small muted">Targets are adult Dietary Reference Intakes for your age and sex. Sodium, sugar, saturated fat, cholesterol and caffeine are upper limits.</p></div>`;
}
export function vCoach() {
  const s = settings(), prop = proposedTargets(), cur = targets(todayK()), ex = expenditure();
  const tr = trendSeries(weightsMap()); const trPts = Object.keys(tr).sort().slice(-60).map(k => ({ k, y: Math.round(tr[k] * 10) / 10 })); const raw = Object.entries(weightsMap()).filter(([k]) => k >= (trPts[0] || {}).k).map(([k, y]) => ({ k, y })).sort((a, b) => a.k < b.k ? -1 : 1);
  return `<div class="card"><div class="row between"><h2>Coach & targets</h2><button class="btn sm" data-act="closeModal">Close</button></div>
  ${!profileReady(s) ? `<p>Fill in About you in More first.</p>` : `
  <div class="kv"><div><span class="small muted">You burn about</span><b>${fmt(ex.estimate)} kcal</b></div><div><span class="small muted">Formula estimate</span><b>${fmt(ex.formula)} kcal</b></div><div><span class="small muted">Data confidence</span><b>${Math.round(ex.confidence * 100)}%</b></div><div><span class="small muted">Avg intake (logged)</span><b>${ex.ready ? fmt(ex.avgIntake) : "–"}</b></div><div><span class="small muted">Trend change</span><b>${ex.ready ? (ex.trendChange >= 0 ? "+" : "") + r1(ex.trendChange) + " lb" : "–"}</b></div><div><span class="small muted">Days logged</span><b>${ex.loggedDays}/${ex.span}</b></div></div>
  <p class="small">${ex.ready ? `Over the last ${ex.span} days you averaged ${fmt(ex.avgIntake)} calories while your trend weight changed ${r1(ex.trendChange)} lb. Each pound is about 3,500 calories, so your real expenditure is about ${fmt(ex.dataOnly)} kcal. Blended with the formula by data confidence, that's ${fmt(ex.estimate)}.` : `Log food on most days and weigh in each morning. After about a week with 7+ logged days and 5+ weigh-ins, Iron 75 starts measuring what you actually burn instead of guessing.`}</p>
  ${trPts.length > 1 ? lineChart(raw, "Weight trend", "Dots are daily weigh-ins; the line is your smoothed trend weight.", trPts) : ""}
  ${prop ? `<div class="label">Suggested daily targets</div><div class="kv">${[["kcal","Calories",""],["p","Protein"," g"],["c","Carbs"," g"],["f","Fat"," g"],["fib","Fiber"," g"],["na","Sodium"," mg"]].map(([key, l, u]) => `<div><span class="small muted">${l}</span><b>${fmt(prop.t[key])}${u}</b>${cur && cur[key] !== prop.t[key] ? `<span class="small muted">now ${fmt(cur[key])}</span>` : ""}</div>`).join("")}</div>
  <button class="btn primary block" data-act="applyTargets">Use these targets</button>` : ""}
  <details ${s.targets.mode === "manual" ? "open" : ""}><summary>Set your own targets instead</summary>
  <label class="switch" style="margin-top:8px"><input type="checkbox" id="tg-manual" ${s.targets.mode === "manual" ? "checked" : ""}><span>Use my own numbers (overrides the coach)</span></label>
  <div class="grid3">${["kcal","p","c","f","fib","sug","na"].map(key => field(NUT[key].label + " (" + NUT[key].unit + ")", numIn("tg-" + key, s.targets.manual[key], `data-tg="${key}"`, cur ? Math.round(cur[key]) : ""))).join("")}</div></details>`}</div>`;
}

/* ---------- Food sheet ---------- */
const SRC = { usda: "USDA verified", usda_fndds: "USDA verified", usda_branded: "USDA branded", off: "Open Food Facts", custom: "My food", recipe: "My recipe", meal: "Saved meal", quick: "Quick add", recent: "Recent" };
export function itemRow(it, i, list) {
  const u = unitsFor(it); const did = defaultUnit(it); const def = u.find(x => x.id === did);
  const show = def ? computeNutrients(it, def.id === "g" ? 100 : 1, def.id) : { nutrients: {} };
  const lbl = def ? (def.id === "g" ? "100 g" : def.label) : "";
  return `<button class="result" data-act="pickItem" data-list="${list}" data-i="${i}"><span><span class="nm">${esc(it.name)}</span><span class="small muted" style="display:block">${it.brand ? esc(it.brand) + " · " : ""}${esc(lbl)} · <span class="src ${it.src}">${SRC[it.src] || it.src}</span></span></span><span class="kc">${fmt(show.nutrients.kcal || 0)} kcal<br><span class="muted">${r1(show.nutrients.p || 0)} g P</span></span></button>`;
}
export function vSheet() {
  const sh = S.sheet; if (!sh) return "";
  const mealName = (MEALS.find(m => m[0] === sh.meal) || [])[1] || "";
  let body = "";
  if (sh.sel) {
    const it = sh.sel.item, units = unitsFor(it), calc = computeNutrients(it, +sh.sel.amount || 0, sh.sel.unit);
    body = `<div class="card"><div><div class="ex-name">${esc(it.name)}</div><div class="small muted">${it.brand ? esc(it.brand) + " · " : ""}<span class="src ${it.src}">${SRC[it.src] || it.src}</span>${it.cat ? " · " + esc(it.cat) : ""}</div></div>
    <div class="row" style="align-items:flex-end">${field("Amount", `<input type="number" inputmode="decimal" step="0.25" id="amtInput" value="${esc(sh.sel.amount)}">`, "grow")}${field("Unit", sel("unitSel", units.map(u => [u.id, u.label + (u.g && u.id.startsWith("p:") ? ` (${r1(u.g)} g)` : "")]), sh.sel.unit), "grow")}</div>
    ${field("Meal", sel("mealSel", MEALS, sh.sel.meal || sh.meal))}
    <div id="selPreview">${previewHTML(calc)}</div>
    <button class="btn primary block" data-act="addSel">${sh.sel.editId ? "Save changes" : "Add to " + esc((MEALS.find(m => m[0] === (sh.sel.meal || sh.meal)) || [])[1])}</button>
    ${it.src === "custom" || it.src === "recipe" ? `<button class="btn danger block" data-act="delCustom" data-id="${esc(it.srcId)}">Delete this saved food</button>` : ""}
    <button class="btn block" data-act="backSel">Back</button></div>`;
  } else if (sh.mode === "scan") {
    body = `<div class="card"><p class="small">Point your camera at the barcode.</p><video id="scanVideo" playsinline muted class="scanvid"></video><p class="small muted" id="scanMsg">${esc(sh.scanMsg || "Starting camera…")}</p>
    <div class="row"><input type="text" inputmode="numeric" id="barcodeIn" placeholder="Or type the barcode number" class="grow" style="width:auto"><button class="btn" data-act="barcodeGo">Look up</button></div>
    <button class="btn block" data-act="scanPhoto">Take a photo of the barcode instead</button></div>`;
  } else if (sh.mode === "quick" || sh.mode === "create") {
    const c = sh.mode === "create";
    body = `<div class="card"><p class="small muted">${c ? "Save a food from its nutrition label. It appears in your search from now on." : "Log something once, like a restaurant meal with posted nutrition."}</p>
    ${field("Name", `<input type="text" id="q-name" placeholder="${c ? "e.g. Mom's chili" : "e.g. Chipotle bowl"}">`)}
    ${c ? `<div class="grid3">${field("Brand (optional)", `<input type="text" id="q-brand">`)}${field("Serving size", `<input type="text" id="q-serving" placeholder="1 cup">`)}${field("Serving weight g (optional)", numIn("q-g", ""))}</div>` : ""}
    <div class="grid3">${["kcal","p","c","f","fib","sug","asug","sat","na","chol","k","ca","fe","vD"].slice(0, c ? 14 : 4).map(key => field(NUT[key].label + " (" + NUT[key].unit + ")", numIn("q-" + key, ""))).join("")}</div>
    ${c ? field("Barcode (optional)", `<input type="text" inputmode="numeric" id="q-barcode">`) : ""}
    <p class="small down" id="qErr"></p><button class="btn primary block" data-act="${c ? "saveCustom" : "quickAdd"}">${c ? "Save and choose amount" : "Add to " + esc(mealName)}</button></div>`;
  } else {
    const online = sh.mode === "online";
    body = `<form class="row" data-form="foodsearch"><input type="search" id="foodSearch" placeholder="${online ? "Brands, restaurants, packaged foods" : "Search 13,000+ foods and your own"}" value="${esc(online ? sh.oq || "" : sh.q || "")}" class="grow" style="width:auto" enterkeyhint="search" autocomplete="off">${online ? `<button class="btn primary" type="submit">Search</button>` : ""}</form>
    <div id="sheetResults" class="results">${resultsHTML()}</div>`;
  }
  return `<div class="sheet" role="dialog" aria-modal="true" aria-label="Add food"><div class="sheet-head"><h2>${sh.sel && sh.sel.editId ? "Edit entry" : "Add to " + esc(mealName)}</h2><button class="btn sm" data-act="closeSheet">Done</button></div><div class="sheet-body">
  ${sh.sel ? "" : `<div class="seg">${[["search","Foods"],["online","Brands"],["scan","Scan"],["quick","Quick"],["create","New"]].map(([m, l]) => `<button data-act="mode" data-m="${m}" class="${sh.mode === m ? "on" : ""}">${l}</button>`).join("")}</div>`}${body}</div></div>`;
}
export function previewHTML(calc) {
  const n = calc.nutrients;
  return `<div class="kv">${[["kcal","Calories"],["p","Protein"],["c","Carbs"],["f","Fat"],["fib","Fiber"],["sug","Sugar"],["na","Sodium"],["sat","Sat fat"],["k","Potassium"]].map(([k, l]) => `<div><span class="small muted">${l}</span><b>${n[k] == null ? "–" : (k === "kcal" || k === "na" || k === "k" ? fmt(n[k]) : r1(n[k]))}${k === "kcal" || n[k] == null ? "" : " " + NUT[k].unit}</b></div>`).join("")}</div>${calc.grams ? `<p class="small muted">${r1(calc.grams)} g</p>` : ""}`;
}
export function resultsHTML() {
  const sh = S.sheet; if (!sh) return "";
  if (sh.mode === "online") {
    if (sh.oLoading) return `<p class="small muted">Searching Open Food Facts and the USDA branded database…</p>`;
    if (sh.oErr) return `<p class="empty">${esc(sh.oErr)}</p>`;
    if (!sh.oRes) return `<p class="small muted">Search millions of packaged and restaurant foods. Needs an internet connection.</p>`;
    return sh.oRes.length ? sh.oRes.map((it, i) => itemRow(it, i, "online")).join("") : `<p class="empty">No matches. Try fewer words, scan the barcode, or use Quick add.</p>`;
  }
  const L = sh.lists || {};
  let html = "";
  if (!foodDbReady()) html += `<p class="small muted">Loading the food database…</p>`;
  if (L.mine && L.mine.length) html += `<div class="label">My foods & meals</div>` + L.mine.map((it, i) => itemRow(it, i, "mine")).join("");
  if (L.recent && L.recent.length) html += `<div class="label">${sh.q ? "Logged before" : "Recent"}</div>` + L.recent.map((it, i) => itemRow(it, i, "recent")).join("");
  if (L.usda && L.usda.length) html += `<div class="label">USDA verified</div>` + L.usda.map((it, i) => itemRow(it, i, "usda")).join("");
  if (sh.q && !html.includes("result")) html += `<p class="empty">Nothing found. Try <b>Brands</b> for packaged foods, <b>Scan</b> a barcode, or <b>New</b> to add it.</p>`;
  if (!sh.q && !(L.recent && L.recent.length) && !(L.mine && L.mine.length)) html += `<p class="small muted">Search by name: "chicken breast", "greek yogurt", "burrito", "banana". Tip: include how it's cooked.</p>`;
  return html;
}

/* ---------- Train ---------- */
export function vTrain() {
  const k = S.view, p = program(), w = workout(k), wk = programWeek(k), dl = isDeload(k);
  const sess = sessionFor(k) || (w && w.items && w.items.length ? { id: "", name: "Extra session", sub: "Added exercises", kind: "lift", items: [] } : null);
  const opts = [["", "Rest day"], ...p.days.map(d => [d.id, d.name + " · " + d.sub])];
  const head = `<div class="card"><div class="row between"><div class="grow"><div class="label">${esc(p.name)} · week ${wk}</div><h2>${sess ? esc(sess.name) : "Rest day"} ${sess ? `<span class="muted">· ${esc(sess.sub)}</span>` : ""}</h2></div>${dl ? `<span class="pill gold">Deload</span>` : ""}</div>
  <div class="row">${field("Session for this day", sel("sessPick", opts, sess ? sess.id : ""), "grow")}<button class="btn" data-tab="program">Program</button></div>
  ${dl ? `<p class="note">Deload week: one fewer set, about 10% lighter. Recover now, set PRs next week.</p>` : ""}</div>`;
  if (!sess) return dateBar() + head + `<div class="card"><p>Rest day. Get your outdoor workout and steps in, and hit your food targets.</p><button class="btn" data-act="addEx">Add an exercise anyway</button></div>`;
  if (sess.kind !== "lift") {
    const C = (w && w.chk) || {};
    return dateBar() + head + `<div class="card"><div class="rules">${(sess.checklist || []).map((t, i) => { const on = !!C[i]; return `<button class="check ${on ? "on" : ""}" data-act="chk" data-i="${i}" aria-pressed="${on}"><span class="box"></span><span class="txt">${esc(t)}</span></button>`; }).join("")}</div>${finishBtn(w)}</div>`;
  }
  const items = w && w.items && w.items.length ? w.items : plannedItems(k, sess).map(it => ({ ex: it.ex, target: { sets: it.sets, lo: it.lo, hi: it.hi, rest: it.rest }, sets: [] }));
  const thisW = weekKeys(wkStart(k)), lastW = weekKeys(addDays(wkStart(k), -7));
  const gear = settings().gear;
  const cards = items.map((it, idx) => {
    const ex = EX[it.ex] || { name: it.ex, load: "bb", req: [], cue: "" }, tg = it.target;
    const a = advise({ ex: it.ex, ...tg }, k, dl);
    const lw = liftScore(it.ex, lastW), tw = liftScore(it.ex, thisW.filter(x => x !== k).concat(k));
    let wow = "";
    if (lw) { const cmp = tw ? (tw.sc > lw.sc * 1.005 ? `<span class="up">▲ ahead of last week</span>` : tw.sc < lw.sc * 0.995 ? `<span class="down">▼ behind last week</span>` : `<span class="flat">= even</span>`) : ""; wow = `<div class="small">Last week's best: <span class="mono">${lw.w}×${lw.r}</span>${tw ? ` · this week <span class="mono">${tw.w}×${tw.r}</span> ${cmp}` : ""}</div>`; }
    const n = Math.max(tg.sets, (it.sets || []).length);
    const wl = ex.load === "db" ? "lb each" : ex.load === "bw" ? "+lb" : "lb", rl = ex.unit === "sec" ? "Secs" : "Reps";
    let rows = `<span class="h">Set</span><span class="h">${ex.unit === "sec" ? "Load" : "Weight"} (${wl})</span><span class="h">${rl}</span><span class="h"></span>`;
    for (let i = 0; i < n; i++) { const x = (it.sets || [])[i] || {}; const pr = x.pr && x.pr.length;
      rows += `<span class="n ${pr ? "prn" : ""}">${pr ? "PR" : i + 1}</span><input type="number" inputmode="decimal" step="0.5" id="w-${idx}-${i}" data-wi="${idx}" data-si="${i}" data-p="w" value="${esc(x.w ?? "")}" placeholder="${a.w === "" ? "" : esc(a.w)}" aria-label="Set ${i + 1} weight"><input type="number" inputmode="numeric" id="r-${idx}-${i}" data-wi="${idx}" data-si="${i}" data-p="r" value="${esc(x.r ?? "")}" placeholder="${tg.lo === tg.hi ? tg.lo : tg.lo + "–" + tg.hi}" aria-label="Set ${i + 1} ${rl}"><button class="done-btn ${x.d ? "on" : ""}" data-act="setdone" data-wi="${idx}" data-si="${i}" aria-label="Mark set ${i + 1} done" aria-pressed="${!!x.d}">✓</button>`; }
    const alts = alternatives(it.ex, gear.equipment);
    return `<div class="ex"><div class="ex-head"><div class="grow"><a class="ex-name" href="${videoUrl(ex)}" target="_blank" rel="noopener">${esc(ex.name)}</a><div class="small muted">${esc(ex.muscles || "")}</div></div><div class="rx">${tg.sets}×${tg.lo === tg.hi ? tg.lo : tg.lo + "–" + tg.hi}${ex.unit === "sec" ? "s" : ""}${ex.per ? `<span class="small muted" style="font-family:var(--f-body);font-weight:500"> /${ex.per}</span>` : ""}</div></div>
    <div class="hint">${a.last ? `<span class="muted">Last time (${md(a.last.k)}):</span> <span class="mono">${esc(a.last.sets.map(x => (+x.w || 0) + "×" + x.r).join("  "))}</span><br>` : ""}<b>Today:</b> ${esc(a.text)}</div>${wow}
    <div class="sets">${rows}</div>
    <div class="row"><button class="btn sm" data-act="addset" data-wi="${idx}">Add set</button>${ex.load === "bb" ? `<button class="btn sm" data-act="plates" data-wi="${idx}">Plates</button>` : ""}<span class="small muted">Rest ${Math.round(tg.rest / 60 * 10) / 10} min</span></div>
    <details><summary>Form cues, swap, remove</summary><p class="small" style="margin-top:6px">${esc(ex.cue)}</p>
    ${alts.length ? `<div class="row" style="margin-top:6px">${field("Swap for", sel("swap-" + idx, [["", "Choose an alternative…"], ...alts.map(x => [x.id, x.name])], "", `data-swap="${idx}"`), "grow")}</div>` : ""}
    <div class="row" style="margin-top:6px"><a class="btn sm" href="${videoUrl(ex)}" target="_blank" rel="noopener">Watch form videos</a><button class="btn sm danger" data-act="removeEx" data-wi="${idx}">Remove from today</button></div></details></div>`;
  }).join("");
  const done = items.reduce((a, it) => a + (it.sets || []).filter(x => x.d).length, 0), total = items.reduce((a, it) => a + Math.max(it.target.sets, (it.sets || []).length), 0);
  return dateBar() + head + `<div class="card"><div class="row between"><span class="small muted">${done} of ${total} sets done${w && w.start ? ` · started ${new Date(w.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</span>${w && w.finished ? `<span class="pill ok">Finished</span>` : ""}</div>
  ${cards}
  ${sess.finisher ? `<p class="note">${esc(sess.finisher)}</p>` : ""}
  <button class="btn" data-act="addEx">Add exercise</button>
  ${field("Session notes", `<textarea id="f-wnotes" data-wn="1" placeholder="How it felt, anything that hurt, what to change">${esc((w && w.notes) || "")}</textarea>`)}
  ${finishBtn(w)}</div>`;
}
function finishBtn(w) {
  const h = (day(S.view).habits || {});
  return `<div class="grid2"><button class="btn ${w && w.finished ? "" : "primary"}" data-act="finish">${w && w.finished ? "Workout 1 done ✓" : "Finish workout"}</button><button class="btn ${h.w2 ? "" : "primary"}" data-act="habitT" data-id="w2">${h.w2 ? "Workout 2 done ✓" : "Outdoor workout done"}</button></div>`;
}

/* ---------- Program & routine builder ---------- */
export function vProgram() {
  const s = settings(), p = program(), mine = Object.values(D.routines);
  return `<div class="row"><button class="btn sm" data-tab="train">‹ Back to Train</button></div>
  <div class="card"><div class="label">Active program</div><h2>${esc(p.name)}</h2>
  <div class="week">${[1, 2, 3, 4, 5, 6, 0].map(i => { const d = p.days.find(x => x.id === p.schedule[i]); return `<div class="${d && d.kind === "lift" ? "lift" : ""}">${DOW[i]}<b>${d ? esc(d.name) : "Rest"}</b></div>`; }).join("")}</div>
  ${s.program.source === "generated" ? `<p class="small muted">Built from your ${s.gear.equipment.length} pieces of equipment, ${s.training.days} lifting days, ${s.training.minutes}-minute sessions, ${s.training.level} level. Every 4th week is a deload; rep targets shift lower each 4-week block on main lifts.</p>` : `<p class="small muted">Your custom routine.</p>`}
  <div class="row">${s.program.source === "generated" ? `<button class="btn primary" data-act="customize">Customize this program</button>` : `<button class="btn primary" data-act="editRoutine" data-id="${esc(s.program.routineId)}">Edit routine</button><button class="btn" data-act="useGenerated">Switch to generated program</button>`}<button class="btn" data-act="newRoutine">New blank routine</button></div></div>
  ${s.program.source === "generated" ? `<div class="card"><h3>Program settings</h3>${trainingPrefs(s.training)}<button class="btn sm" data-act="gotoEquipment">Change equipment (${s.gear.equipment.length} items)</button></div>` : ""}
  <div class="card">${programDays(p)}</div>
  ${mine.length ? `<div class="card"><h3>My routines</h3>${mine.map(r => `<div class="row between rrow"><span><b>${esc(r.name)}</b>${s.program.source === "routine" && s.program.routineId === r.id ? ` <span class="pill ok">Active</span>` : ""}</span><span class="row">${s.program.source === "routine" && s.program.routineId === r.id ? "" : `<button class="btn sm" data-act="activateRoutine" data-id="${r.id}">Use</button>`}<button class="btn sm" data-act="editRoutine" data-id="${r.id}">Edit</button></span></div>`).join("")}</div>` : ""}`;
}
export function vRoutine() {
  const r = S.routineEdit; if (!r) return "";
  const days = r.data.days;
  return `<div class="row between"><button class="btn sm" data-act="cancelRoutine">Cancel</button><button class="btn sm primary" data-act="saveRoutine">Save routine</button></div>
  <div class="card">${field("Routine name", `<input type="text" id="rt-name" value="${esc(r.name)}">`)}</div>
  ${days.map((d, di) => `<div class="card"><div class="row" style="align-items:flex-end">${field("Day name", `<input type="text" id="rd-name-${di}" data-rd="${di}" data-k="name" value="${esc(d.name)}">`, "grow")}${field("Type", sel("rd-kind-" + di, [["lift","Lifting"],["chk","Checklist (cardio, mobility)"]], d.kind, `data-rdk="${di}"`))}<button class="btn sm danger" data-act="delDay" data-di="${di}">Delete day</button></div>
   ${d.kind === "lift" ? `${(d.items || []).map((it, ii) => { const ex = EX[it.ex] || { name: it.ex }; return `<div class="ritem"><div class="row between"><b class="grow">${esc(ex.name)}</b><span class="row"><button class="btn sm" data-act="mvItem" data-di="${di}" data-ii="${ii}" data-d="-1" aria-label="Move up">▲</button><button class="btn sm" data-act="mvItem" data-di="${di}" data-ii="${ii}" data-d="1" aria-label="Move down">▼</button><button class="btn sm danger" data-act="rmItem" data-di="${di}" data-ii="${ii}" aria-label="Remove">✕</button></span></div>
     <div class="grid4">${field("Sets", numIn(`ri-${di}-${ii}-sets`, it.sets, `data-ri="${di}:${ii}:sets"`))}${field("Reps from", numIn(`ri-${di}-${ii}-lo`, it.lo, `data-ri="${di}:${ii}:lo"`))}${field("Reps to", numIn(`ri-${di}-${ii}-hi`, it.hi, `data-ri="${di}:${ii}:hi"`))}${field("Rest (s)", numIn(`ri-${di}-${ii}-rest`, it.rest, `data-ri="${di}:${ii}:rest"`))}</div></div>`; }).join("")}
     <button class="btn" data-act="addExRoutine" data-di="${di}">Add exercise</button>
     ${field("Finisher (optional)", `<input type="text" id="rd-fin-${di}" data-rd="${di}" data-k="finisher" value="${esc(d.finisher || "")}">`)}` :
     field("Checklist, one item per line", `<textarea id="rd-chk-${di}" data-rdc="${di}" rows="5">${esc((d.checklist || []).join("\n"))}</textarea>`)}</div>`).join("")}
  <button class="btn block" data-act="addDay">Add a day</button>
  <div class="card"><h3>Weekly schedule</h3><div class="grid2">${[1, 2, 3, 4, 5, 6, 0].map(i => field(DOW[i], sel("rs-" + i, [["", "Rest"], ...days.map(d => [d.id, d.name])], r.data.schedule[i] || "", `data-rs="${i}"`))).join("")}</div></div>
  ${r.id && D.routines[r.id] ? `<button class="btn danger block" data-act="deleteRoutine">Delete this routine</button>` : ""}`;
}
export function vPicker() {
  const pk = S.picker; if (!pk) return "";
  const eq = settings().gear.equipment, q = (pk.q || "").toLowerCase();
  const list = EXERCISES.filter(e => (!pk.onlyMine || hasEq(e, eq)) && (!pk.pattern || e.pattern === pk.pattern) && (!q || e.name.toLowerCase().includes(q) || (e.muscles || "").includes(q)));
  return `<div class="sheet" role="dialog" aria-modal="true" aria-label="Choose an exercise"><div class="sheet-head"><h2>Add exercise</h2><button class="btn sm" data-act="closePicker">Close</button></div><div class="sheet-body">
  <input type="search" id="pkSearch" placeholder="Search exercises or muscles" value="${esc(pk.q || "")}" autocomplete="off">
  <div class="row">${field("Movement", sel("pkPattern", [["", "All movements"], ...Object.entries(PATTERN_LABEL)], pk.pattern), "grow")}<label class="switch" style="align-items:center"><input type="checkbox" id="pkMine" ${pk.onlyMine ? "checked" : ""}><span class="small">Only my equipment</span></label></div>
  <div id="pkList" class="results">${pickerList(list, eq)}</div></div></div>`;
}
export function pickerList(list, eq) {
  return list.length ? list.map(e => `<button class="result" data-act="pickEx" data-id="${e.id}"><span><span class="nm">${esc(e.name)}</span><span class="small muted" style="display:block">${esc(PATTERN_LABEL[e.pattern])} · ${esc(e.muscles)}${hasEq(e, eq) ? "" : " · needs " + esc(e.req.map(r => r.split("|").map(x => EQUIPMENT_LABEL[x] || x).join(" or ")).join(", "))}</span></span></button>`).join("") : `<p class="empty">No exercises match.</p>`;
}
export function vPlates() {
  const m = S.modal; const g = settings().gear;
  const total = +m.total || 0; const res = platesFor(total, +g.bar || 45, (g.plates || []).map(Number).filter(x => x > 0));
  return `<div class="card"><div class="row between"><h2>Plate math</h2><button class="btn sm" data-act="closeModal">Close</button></div>
  ${field("Total weight (lb)", numIn("plateTotal", total))}
  <p>${total <= (+g.bar || 45) ? `Just the bar (${g.bar} lb).` : res ? `Each side: <b class="mono">${res.join(" + ")}</b>` : `Can't make ${total} lb exactly with your plates (${(g.plates || []).join(", ")}).`}</p>
  <p class="small muted">Bar ${g.bar} lb. Edit your bar and plates in More → Equipment.</p></div>`;
}

/* ---------- Progress ---------- */
export function vProgress() {
  const v = verdict(), st = v.stats, wc = weekCompare(), today = todayK();
  const wm = weightsMap(); const tr = trendSeries(wm);
  const raw = Object.keys(wm).sort().map(k => ({ k, y: wm[k] })); const trPts = Object.keys(tr).sort().map(k => ({ k, y: Math.round(tr[k] * 10) / 10 }));
  const logged = exercisesLogged(); const exSel = S.exChart && logged.includes(S.exChart) ? S.exChart : (logged.find(x => ["back_squat","bench_press","deadlift"].includes(x)) || logged[0]);
  const exPts = exSel ? Object.keys(D.workouts).sort().map(k => { const b = liftScore(exSel, [k]); return b && b.sc ? { k, y: Math.round(b.sc) } : null; }).filter(Boolean) : [];
  const prs = logged.map(id => { const b = liftScore(id, Object.keys(D.workouts)); return b ? { id, ...b } : null; }).filter(Boolean).sort((a, b) => b.sc - a.sc);
  const msets = setsPerMuscle(wkStart(today)), mlast = setsPerMuscle(addDays(wkStart(today), -7));
  const groups = ["Chest","Back","Shoulders","Quads","Hamstrings & glutes","Arms","Calves","Core"];
  const prog = Object.values(D.photos).filter(p => p.kind === "progress").sort((a, b) => a.date === b.date ? (a.slot < b.slot ? -1 : 1) : a.date < b.date ? -1 : 1);
  const pa = prog.find(p => p.id === S.cmpA) || prog[0], pb = prog.find(p => p.id === S.cmpB) || prog[prog.length - 1];
  const popt = s2 => prog.map(p => [p.id, md(p.date) + " " + (p.slot === "am" ? "morning" : "evening")]);
  const s = settings(); const from = [addDays(today, -27), s.challenge.startDate].sort()[1], span = Math.max(0, diff(today, from) + 1);
  const bars = s.challenge.rules.filter(r => r.on).map(r => { let c = 0; for (let i = 0; i < span; i++) if (ruleDone(r, addDays(from, i))) c++; const p = span ? Math.round(c / span * 100) : 0; return `<div class="hbar"><span>${esc(r.label.split(":")[0])}</span><div class="bar"><i style="width:${p}%"></i></div><span class="mono">${p}%</span></div>`; }).join("");
  const t = targets(today); const last7 = []; for (let i = 0; i < 7; i++) { const k = addDays(today, -i); if (foodOn(k).length) last7.push(dayTotals(k)); }
  const avgN = key => last7.length ? last7.reduce((a, x) => a + (x[key] || 0), 0) / last7.length : 0;
  const measRows = Object.keys(D.days).filter(k => D.days[k].meas && MEAS.some(m => D.days[k].meas[m])).sort().reverse();
  return `<div class="card verdict ${v.cls}"><div class="label">Are you building?</div><div class="head">${esc(v.head)}</div><p>${esc(v.body)}</p>
  <div class="kv"><div><span class="small muted">Lifts up</span><b>${st.n ? st.up + " of " + st.n : "–"}</b></div><div><span class="small muted">Avg strength</span><b class="${st.avg > 1 ? "up" : st.avg < -1 ? "down" : ""}">${st.n ? (st.avg >= 0 ? "+" : "") + st.avg.toFixed(1) + "%" : "–"}</b></div><div><span class="small muted">Weight trend</span><b>${st.wt === null ? "–" : (st.wt >= 0 ? "+" : "") + st.wt.toFixed(1) + " lb/wk"}</b></div><div><span class="small muted">Waist (6 wk)</span><b>${st.waist ? (st.waist.d >= 0 ? "+" : "") + st.waist.d.toFixed(1) + " in" : "–"}</b></div><div><span class="small muted">Protein days</span><b>${st.pDays ? st.pHit + " of " + st.pDays : "–"}</b></div><div><span class="small muted">Workouts</span><b>${Object.values(D.workouts).filter(w => w.finished).length}</b></div></div></div>
  <div class="card"><h2>Streaks</h2>${streakTiles()}</div>
  <div class="card"><h2>Week over week</h2>${wc ? `<p class="small muted">Best set in the week of ${fmtDate(wc.A)}${wc.B ? ` vs the week of ${fmtDate(wc.B)}. <b class="up">${wc.up} up</b>, <b class="down">${wc.down} down</b> of ${wc.both} lifts done both weeks.` : ". Next week you'll see the comparison."}</p>
   <div class="tbl"><table><thead><tr><th>Lift</th><th class="r">Prev</th><th class="r">This</th><th class="r">Change</th></tr></thead><tbody>${wc.rows.map(r => `<tr><td>${esc((EX[r.id] || { name: r.id }).name)}</td><td class="n">${r.b ? r.b.w + "×" + r.b.r : "–"}</td><td class="n">${r.a ? r.a.w + "×" + r.a.r : "–"}</td><td class="n ${r.cls}">${r.cls === "up" ? "▲ " : r.cls === "down" ? "▼ " : ""}${esc(r.ch)}</td></tr>`).join("")}</tbody></table></div><p class="small muted">Change uses estimated 1-rep max, so 225×8 beats 235×5.</p>` : `<p class="empty">Log a lifting session in Train to start comparing weeks.</p>`}</div>
  <div class="card"><h2>Weekly sets per muscle</h2><p class="small muted">Hard sets this week (last week). 10–20 per muscle per week is the growth zone.</p>${groups.map(g => { const n = msets[g] || 0; return `<div class="hbar"><span>${g}</span><div class="bar ${n >= 10 ? "ok" : ""}"><i style="width:${Math.min(100, n / 20 * 100)}%"></i></div><span class="mono">${n} (${mlast[g] || 0})</span></div>`; }).join("")}</div>
  <div class="card"><h2>Strength</h2>${logged.length ? `${sel("exChart", logged.map(id => [id, (EX[id] || { name: id }).name]), exSel)}${lineChart(exPts, "Estimated max", "Estimated 1-rep max (lb) from your best set each session")}` : `<p class="empty">Log lifts to see strength charts.</p>`}</div>
  <div class="card"><h2>Personal records</h2>${prs.length ? `<div class="tbl"><table><thead><tr><th>Lift</th><th class="r">Best set</th><th class="r">Est. 1RM</th><th class="r">Date</th></tr></thead><tbody>${prs.slice(0, 20).map(p => `<tr><td>${esc((EX[p.id] || { name: p.id }).name)}</td><td class="n">${p.w}×${p.r}</td><td class="n">${EX[p.id] && (EX[p.id].load === "bw" || EX[p.id].unit === "sec") ? "–" : fmt(p.sc)}</td><td class="n">${md(p.k)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="empty">Your PRs will show up here.</p>`}</div>
  <div class="card"><h2>Weekly volume</h2>${barChart(weeklyVolume(), "Total pounds lifted (weight × reps) per week, loaded lifts only.")}</div>
  <div class="card"><h2>Body weight</h2>${lineChart(raw, "Body weight", "Dots are weigh-ins; the line is your smoothed trend, which ignores daily water swings.", trPts.length > 1 ? trPts : null)}</div>
  <div class="card"><h2>Progress photos</h2>${prog.length ? `${prog.length > 1 ? `<div class="compare"><figure>${sel("cmpA", popt(), pa.id)}${photoImg(pa, false, "Earlier photo")}</figure><figure>${sel("cmpB", popt(), pb.id)}${photoImg(pb, false, "Later photo")}</figure></div>` : ""}<div class="gallery">${prog.slice().reverse().map(p => `<button data-act="viewPhoto" data-id="${p.id}">${photoImg(p, true, "Progress photo " + md(p.date))}<span>${md(p.date)} ${p.slot === "am" ? "AM" : "PM"}</span></button>`).join("")}</div>` : `<p class="empty">Take your morning and evening photos on Today. Compare any two side by side here.</p>`}</div>
  <div class="card"><h2>Nutrition, last 7 days</h2>${last7.length ? `${["kcal","p","c","f","fib","sug","na","k","ca","fe","vD","mg"].map(key => t && t[key] ? macroRow(key, avgN(key), t[key]) : "").join("")}<p class="small muted">Daily average over the ${last7.length} day${last7.length === 1 ? "" : "s"} you logged food.</p>` : `<p class="empty">Log food to see your averages.</p>`}</div>
  <div class="card"><h2>Rule consistency</h2><p class="small muted">Since ${fmtDate(from)} (${span} day${span === 1 ? "" : "s"})</p>${span ? bars : `<p class="empty">Starts on day 1.</p>`}</div>
  <div class="card"><h2>Measurements</h2>${measRows.length ? `<div class="tbl"><table><thead><tr><th>Date</th>${MEAS.map(m => `<th class="r">${m}</th>`).join("")}</tr></thead><tbody>${measRows.map(k => `<tr><td>${md(k)}</td>${MEAS.map(m => `<td class="n">${esc(D.days[k].meas[m] || "–")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : `<p class="empty">Add measurements under Body & recovery on Today.</p>`}</div>`;
}

/* ---------- More ---------- */
export function vMore() {
  const s = settings(), a = s.about;
  const ruleRows = s.challenge.rules.map((r, i) => `<div class="rule-edit"><input type="checkbox" id="ron-${i}" data-ruleon="${i}" ${r.on ? "checked" : ""} aria-label="Use this rule"><input type="text" id="rl-${i}" data-rl="${i}" value="${esc(r.label)}" aria-label="Rule text">${BUILTIN_RULES.has(r.id) ? "<span></span>" : `<button class="btn sm danger" data-act="ruledel" data-i="${i}">Remove</button>`}</div>`).join("");
  return installCard() + `<div class="card"><h2>Account</h2><p class="small">${D.mode === "cloud" ? `Signed in as <b>${esc(D.email)}</b>. Your data syncs to your account and is private to you.` : "Device-only mode: your data stays in this browser."}</p>
  ${field("Name", `<input type="text" id="acc-name" value="${esc(D.displayName)}">`)}
  <div class="row"><button class="btn" data-act="share">Invite friends</button>${D.mode === "cloud" ? `<button class="btn" data-act="syncNow">Sync now</button>` : ""}<button class="btn" data-act="signOut">Sign out</button></div></div>
  <div class="card" id="sec-about"><h2>About you</h2><div class="grid2">${field("Sex (for the formula)", sel("ab-sex", [["","Choose"],["m","Male"],["f","Female"]], a.sex, 'data-ab="sex"'))}${field("Age", numIn("ab-age", a.age, 'data-ab="age"'))}${field("Height (ft)", numIn("ab-ft", a.ft, 'data-ab="ft"'))}${field("Height (in)", numIn("ab-inch", a.inch, 'data-ab="inch"'))}${field("Starting weight (lb)", numIn("ab-weight", a.weight, 'data-ab="weight"'))}${field("Goal weight (lb)", numIn("ab-goalWeight", a.goalWeight, 'data-ab="goalWeight"'))}</div>
  ${field("Daily activity", sel("ab-activity", ACTIVITY, a.activity, 'data-ab="activity"'))}${field("Body weight goal", sel("ab-rate", GOAL_RATES, a.rate, 'data-ab="rate"'))}${field("Protein", sel("ab-proteinPerLb", [["0.8","0.8 g per lb of goal weight"],["1","1 g per lb"],["1.2","1.2 g per lb"]], a.proteinPerLb, 'data-ab="proteinPerLb"'))}
  <button class="btn" data-act="openCoach">Coach & targets</button></div>
  <div class="card" id="sec-eq"><h2>Equipment</h2>${equipmentEditor(s.gear)}</div>
  <div class="card"><h2>Training</h2>${trainingPrefs(s.training)}<button class="btn" data-tab="program">View program & routines</button></div>
  <div class="card"><h2>Challenge</h2><div class="grid2">${field("Start date", `<input type="date" id="ch-start" value="${esc(s.challenge.startDate)}">`)}${field("Length (days)", numIn("ch-length", s.challenge.length))}${field("Water target (oz)", numIn("ch-water", s.challenge.water))}</div>
  <label class="switch"><input type="checkbox" id="ch-strict" ${s.challenge.strict ? "checked" : ""}><span><b>Strict mode.</b> Miss any item and the count resets to Day 1.</span></label>
  <button class="btn danger sm" data-act="restart">Restart from today</button></div>
  <div class="card"><h2>Daily rules</h2><p class="small muted">Eating, water, photos and Workout 1 check themselves off from what you log.</p>${ruleRows}<div class="row"><input type="text" id="newRule" placeholder="e.g. 10 min of stretching before bed" class="grow" style="width:auto"><button class="btn" data-act="ruleadd">Add rule</button></div></div>
  <div class="card"><h2>Your data</h2><p class="small">Download everything you've logged as a file (photos stay in your account).</p><div class="row"><button class="btn" data-act="exportData">Download my data</button>${D.mode === "cloud" ? `<button class="btn danger" data-act="deleteAccount">Delete my account</button>` : ""}</div></div>
  <div class="card"><h2>About Iron 75</h2><p class="small muted">Food data: USDA FoodData Central (SR Legacy, FNDDS), Open Food Facts (ODbL) and USDA Branded Foods. Calorie coaching uses your logged intake and smoothed weight trend. Not medical advice. Talk to a doctor before starting an aggressive diet or training plan.</p></div>`;
}
export function vConfirm() {
  const c = S.confirm; if (!c) return "";
  return `<div class="card"><h2>${esc(c.title)}</h2><p>${esc(c.body)}</p>${c.typed ? field(`Type ${esc(c.typed)} to confirm`, `<input type="text" id="confirmTyped" autocomplete="off">`) : ""}<div class="row"><button class="btn" data-act="confirmNo">Cancel</button><button class="btn danger" data-act="confirmYes">${esc(c.yes)}</button></div></div>`;
}
export function vViewer() {
  const p = S.viewer && D.photos[S.viewer.id]; if (!p) return "";
  const lbl = p.kind === "progress" ? (p.slot === "am" ? "Morning" : "Evening") + " progress photo" : "Meal photo";
  const u = photoUrlSync(p.path) || photoUrlSync(p.thumb_path);
  return `<div class="vbar"><span>${esc(lbl)} · ${fmtDate(p.date)}</span><button class="btn sm" data-act="closeViewer">Close</button></div>${u ? `<img src="${esc(u)}" alt="${esc(lbl)}">` : `<p style="color:#fff;padding:20px">Loading…</p>`}<div class="vbar bottom">${S.viewer.confirm ? `<span>Delete this photo for good?</span><span class="row"><button class="btn sm" data-act="vNo">Keep</button><button class="btn sm danger" data-act="vDel">Delete</button></span>` : `<span></span><button class="btn sm" data-act="vAsk">Delete photo</button>`}</div>`;
}
