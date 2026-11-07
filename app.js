/* Iron 75: events, sign-in, onboarding and startup. */
import * as store from "./store.js";
import { D } from "./store.js";
import { S, settings, setSettings, day, editDay, workout, editWorkout, foodOn, addFood, updateFood, removeFood, sessionFor, plannedItems, prTypes, proposedTargets, program } from "./core.js";
import * as V from "./views.js";
import { EX, PRESETS, alternatives, generateProgram, EXERCISES, hasEq } from "./library.js";
import { loadFoodDb, searchLocal, offSearch, fdcSearch, lookupBarcode, unitsFor, computeNutrients, defaultUnit, customToItem, startScanner, decodeImageFile } from "./food.js";
import { NUT_KEYS } from "./nutrition.js";
import { todayK, addDays, uuid, clone, esc, fmt, r1, diff } from "./util.js";

const $ = id => document.getElementById(id);
let session = null;

/* ================= Rendering ================= */
const TABS = [["today", "Today"], ["food", "Food"], ["train", "Train"], ["progress", "Progress"], ["more", "More"]];
let needsRender = false;
export function render() {
  const app = $("app"), tabs = $("tabsNav");
  if (!session) { tabs.hidden = true; app.innerHTML = V.vAuth(); renderOverlays(); return; }
  if (!settings().onboarded) { tabs.hidden = true; app.innerHTML = V.header() + V.vOnboard(); renderOverlays(); return; }
  tabs.hidden = false;
  const active = S.tab === "program" || S.tab === "routine" ? "train" : S.tab;
  $("tabs").innerHTML = TABS.map(([id, l]) => `<button class="tab ${active === id ? "on" : ""}" data-tab="${id}" aria-current="${active === id ? "page" : "false"}">${l}</button>`).join("");
  const view = { today: V.vToday, food: V.vFood, train: V.vTrain, progress: V.vProgress, more: V.vMore, program: V.vProgram, routine: V.vRoutine }[S.tab] || V.vToday;
  app.innerHTML = V.header() + view();
  renderOverlays();
  ensurePhotoUrls();
}
function renderOverlays() {
  const sh = $("sheet");
  const html = S.picker ? V.vPicker() : S.sheet ? V.vSheet() : "";
  sh.hidden = !html; if (html) { sh.innerHTML = html; } else sh.innerHTML = "";
  const m = $("modal");
  const mh = S.confirm ? V.vConfirm() : S.modal ? (S.modal.type === "report" ? V.vReport() : S.modal.type === "coach" ? V.vCoach() : S.modal.type === "plates" ? V.vPlates() : "") : "";
  m.hidden = !mh; m.innerHTML = mh ? `<div class="modal-inner">${mh}</div>` : "";
  const v = $("viewer"); const vh = S.viewer ? V.vViewer() : ""; v.hidden = !vh; v.innerHTML = vh;
}
function softRender() { const a = document.activeElement; if (a && a.matches && a.matches("input,textarea,select") && $("app").contains(a)) { needsRender = true; return; } render(); }
document.addEventListener("focusout", () => { if (!needsRender) return; setTimeout(() => { const a = document.activeElement; if (!(a && a.matches && a.matches("input,textarea,select"))) { needsRender = false; render(); } }, 80); });
store.onChange(() => softRender());
store.onStatus(t => { S.status = t; const el = $("statusMsg"); if (el) el.textContent = t; });
let urlBusy = false;
function ensurePhotoUrls() {
  if (urlBusy) return;
  const ps = Object.values(D.photos); const paths = ps.map(p => p.thumb_path || p.path);
  if (S.viewer && D.photos[S.viewer.id]) paths.push(D.photos[S.viewer.id].path);
  if (S.tab === "progress") ps.filter(p => p.kind === "progress").forEach(p => paths.push(p.path));
  urlBusy = true;
  store.resolvePhotoUrls(paths).then(ch => { urlBusy = false; if (ch) softRender(); }).catch(() => { urlBusy = false; });
}
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3200); }

/* ================= Startup ================= */
async function startSession(sess) {
  session = sess; S.tab = "today"; S.view = todayK();
  await store.start(sess);
  render();
}
async function boot() {
  render();
  try {
    await store.onAuthEvent((ev, s) => {
      if (ev === "PASSWORD_RECOVERY") { S.auth = "newpass"; S.authMsg = ""; session = null; render(); return; }
      if ((ev === "SIGNED_IN" || ev === "INITIAL_SESSION") && s && S.auth !== "newpass" && (!session || session.user.id !== s.user.id)) startSession({ mode: "cloud", user: s.user });
      if (ev === "SIGNED_OUT") { session = null; render(); }
    });
    const sess = await store.currentSession();
    if (sess && S.auth !== "newpass" && !session) await startSession(sess); else render();
  } catch (e) { console.error(e); S.authMsg = "Couldn't reach the server. Check your connection and reload."; render(); }
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && session) { if (S.view !== todayK() && S.lastSeen === S.view) S.view = todayK(); S.lastSeen = todayK(); if (D.mode === "cloud" && Date.now() - D.syncedAt > 60000) store.pull(false); } });
S.lastSeen = todayK();

/* ================= Forms (sign in etc.) ================= */
document.addEventListener("submit", async e => {
  const f = e.target.closest("form[data-form]"); if (!f) return; e.preventDefault();
  const kind = f.dataset.form, v = id => ($(id) ? $(id).value.trim() : "");
  if (kind === "foodsearch") { if (S.sheet && S.sheet.mode === "online") onlineSearch(v("foodSearch")); return; }
  const btn = f.querySelector("button[type=submit]"); if (btn) btn.disabled = true;
  try {
    if (kind === "signin") await store.signIn(v("au-email"), $("au-pass").value);
    if (kind === "signup") {
      const r = await store.signUp(v("au-email"), $("au-pass").value, v("au-name"));
      if (!r.session) { S.auth = "check"; S.authMsg = `We sent a confirmation link to ${v("au-email")}. Open it on this phone, then come back and sign in.`; }
    }
    if (kind === "forgot") { await store.sendReset(v("au-email")); S.auth = "check"; S.authMsg = `If ${v("au-email")} has an account, a reset link is on its way.`; }
    if (kind === "newpass") { await store.setPassword($("au-pass").value); S.auth = "signin"; S.authMsg = ""; const s2 = await store.currentSession(); if (s2) await startSession(s2); }
  } catch (err) { S.authMsg = friendlyAuth(err); }
  render();
});
function friendlyAuth(err) {
  const m = (err && err.message) || "";
  if (/Invalid login/i.test(m)) return "That email and password don't match. Try again or reset your password.";
  if (/already registered|already been registered/i.test(m)) return "That email already has an account. Sign in instead.";
  if (/Email not confirmed/i.test(m)) return "Confirm your email first: open the link we sent you.";
  if (/rate limit/i.test(m)) return "Too many emails sent. Wait a few minutes and try again.";
  if (/Password/i.test(m)) return m;
  return m || "Something went wrong. Check your connection and try again.";
}

/* ================= Clicks ================= */
document.addEventListener("click", async e => {
  const tb = e.target.closest("[data-tab]");
  if (tb && !e.target.closest("#sheet")) { S.tab = tb.dataset.tab; S.modal = null; render(); window.scrollTo(0, 0); return; }
  if (e.target.id === "sheet") { closeSheet(); return; }
  if (e.target.id === "modal") { S.modal = null; S.confirm = null; render(); return; }
  const b = e.target.closest("[data-act]"); if (!b) return;
  const a = b.dataset.act, k = S.view;
  switch (a) {
    /* auth & onboarding */
    case "auth": S.auth = b.dataset.to; S.authMsg = ""; render(); break;
    case "localMode": store.useLocalMode(); await startSession({ mode: "local", user: { id: "local", email: "" } }); break;
    case "obBack": S.onboard = Math.max(0, S.onboard - 1); render(); window.scrollTo(0, 0); break;
    case "obNext": obNext(); break;
    case "dismissInstall": try { localStorage.setItem("iron75-install-dismissed", "1"); } catch (x) {} render(); break;
    /* navigation */
    case "prev": S.view = addDays(S.view, -1); render(); break;
    case "next": if (S.view < todayK()) S.view = addDays(S.view, 1); render(); break;
    case "gotoday": S.view = todayK(); render(); break;
    case "pick": S.view = b.dataset.k; render(); window.scrollTo(0, 0); break;
    /* today */
    case "habit": case "habitT": editDay(k, d => { d.habits = d.habits || {}; d.habits[b.dataset.id] = !d.habits[b.dataset.id]; }); render(); break;
    case "water": editDay(k, d => { d.water = Math.max(0, (+d.water || 0) + (+b.dataset.n)); }); render(); break;
    case "scale": editDay(k, d => { d[b.dataset.k] = +d[b.dataset.k] === +b.dataset.n ? null : +b.dataset.n; }); render(); break;
    case "addProgress": openPhotoPicker({ kind: "progress", slot: b.dataset.slot, date: k }); break;
    case "addMealPhoto": openPhotoPicker({ kind: "meal", meal: b.dataset.meal, date: k }); break;
    case "viewPhoto": S.viewer = { id: b.dataset.id }; render(); break;
    case "closeViewer": S.viewer = null; render(); break;
    case "vAsk": S.viewer.confirm = true; render(); break;
    case "vNo": S.viewer.confirm = false; render(); break;
    case "vDel": { const p = D.photos[S.viewer.id]; S.viewer = null; try { await store.deletePhoto(p); toast("Photo deleted"); } catch (x) { toast("Couldn't delete: " + x.message); } render(); break; }
    /* food */
    case "openAdd": openSheet(b.dataset.meal, "search"); break;
    case "openScan": openSheet(b.dataset.meal, "scan"); break;
    case "closeSheet": closeSheet(); break;
    case "mode": stopScan(); S.sheet.mode = b.dataset.m; S.sheet.sel = null; render(); if (S.sheet.mode === "scan") beginScan(); else if (S.sheet.mode === "search") updateLists(); break;
    case "pickItem": { const it = (S.sheet.lists[b.dataset.list] || (b.dataset.list === "online" ? S.sheet.oRes : []) || [])[+b.dataset.i]; if (it) selectItem(it); break; }
    case "backSel": S.sheet.sel = null; render(); break;
    case "addSel": commitSel(); break;
    case "editEntry": { const en = foodOn(k).find(x => x.id === b.dataset.id); if (en) editEntry(en); break; }
    case "delFood": removeFood(b.dataset.id); render(); break;
    case "delCustom": store.deleteCustom(b.dataset.id); S.sheet.sel = null; updateLists(); render(); toast("Deleted"); break;
    case "quickAdd": case "saveCustom": saveQuick(a === "saveCustom"); break;
    case "barcodeGo": handleCode($("barcodeIn").value); break;
    case "scanPhoto": { S.photoCtx = { kind: "barcode" }; const i = $("photoInput"); i.value = ""; i.click(); break; }
    case "saveMeal": saveMeal(b.dataset.meal); break;
    case "copyMeal": { const y = foodOn(addDays(k, -1)).filter(x => x.meal === b.dataset.meal); if (!y.length) { toast("Nothing logged for that meal yesterday."); break; } for (const en of y) addFood({ ...clone(en), id: undefined, date: k }); render(); toast(`Copied ${y.length} item${y.length === 1 ? "" : "s"}`); break; }
    case "openReport": S.modal = { type: "report" }; render(); break;
    case "openCoach": S.modal = { type: "coach" }; render(); break;
    case "closeModal": S.modal = null; render(); break;
    case "applyTargets": { const p = proposedTargets(); if (!p) break; setSettings(s => { s.targets.applied = { kcal: p.t.kcal, p: p.t.p, c: p.t.c, f: p.t.f, fib: p.t.fib, sug: p.t.sug, asug: p.t.asug, sat: p.t.sat }; s.targets.appliedAt = todayK(); s.targets.mode = "auto"; }); S.modal = null; render(); toast("Targets updated"); break; }
    /* training */
    case "setdone": setDone(+b.dataset.wi, +b.dataset.si); break;
    case "addset": ensureWorkout(k); editWorkout(k, w => { w.items[+b.dataset.wi].sets = w.items[+b.dataset.wi].sets || []; const it = w.items[+b.dataset.wi]; while (it.sets.length < it.target.sets) it.sets.push({}); it.sets.push({}); }); render(); break;
    case "removeEx": ensureWorkout(k); editWorkout(k, w => { w.items.splice(+b.dataset.wi, 1); }); render(); break;
    case "addEx": S.picker = { target: "today", q: "", pattern: "", onlyMine: true }; render(); break;
    case "addExRoutine": S.picker = { target: "routine", di: +b.dataset.di, q: "", pattern: "", onlyMine: true }; render(); break;
    case "closePicker": S.picker = null; render(); break;
    case "pickEx": pickExercise(b.dataset.id); break;
    case "plates": { const it = (workout(k) || { items: [] }).items[+b.dataset.wi]; const last = it && (it.sets || []).find(x => +x.w > 0); S.modal = { type: "plates", total: last ? last.w : (+settings().gear.bar || 45) }; render(); break; }
    case "chk": ensureWorkout(k); editWorkout(k, w => { w.chk = w.chk || {}; w.chk[b.dataset.i] = !w.chk[b.dataset.i]; }); render(); break;
    case "finish": finishWorkout(); break;
    /* program */
    case "customize": { const p = program(); S.routineEdit = { id: "", name: "My " + p.name.split(" · ")[0], data: clone({ days: p.days, schedule: p.schedule, deloadEvery: p.deloadEvery }) }; S.tab = "routine"; render(); window.scrollTo(0, 0); break; }
    case "newRoutine": S.routineEdit = { id: "", name: "My routine", data: { days: [{ id: "d1", name: "Day 1", sub: "", kind: "lift", items: [] }], schedule: { 0: "", 1: "d1", 2: "", 3: "", 4: "", 5: "", 6: "" }, deloadEvery: 4 } }; S.tab = "routine"; render(); break;
    case "editRoutine": { const r = D.routines[b.dataset.id]; if (r) { S.routineEdit = { id: r.id, name: r.name, data: clone(r.data) }; S.tab = "routine"; render(); window.scrollTo(0, 0); } break; }
    case "cancelRoutine": S.routineEdit = null; S.tab = "program"; render(); break;
    case "saveRoutine": { const r = S.routineEdit; r.name = ($("rt-name").value || "My routine").trim(); const id = r.id || uuid(); store.saveRoutine({ id, name: r.name, data: r.data }); setSettings(s => { s.program = { ...s.program, source: "routine", routineId: id }; }); S.routineEdit = null; S.tab = "program"; render(); toast("Routine saved and active"); break; }
    case "deleteRoutine": S.confirm = { title: "Delete this routine?", body: "Your logged workouts stay. If it's your active program, you'll switch back to the generated one.", yes: "Delete", run: () => { const id = S.routineEdit.id; store.deleteRoutine(id); setSettings(s => { if (s.program.routineId === id) s.program = { ...s.program, source: "generated", routineId: "" }; }); S.routineEdit = null; S.tab = "program"; } }; render(); break;
    case "activateRoutine": setSettings(s => { s.program = { ...s.program, source: "routine", routineId: b.dataset.id }; }); render(); toast("Routine is now your program"); break;
    case "useGenerated": setSettings(s => { s.program = { ...s.program, source: "generated", routineId: "" }; }); render(); break;
    case "gotoEquipment": S.tab = "more"; render(); setTimeout(() => { const el = $("sec-eq"); if (el) el.scrollIntoView(); }, 30); break;
    case "addDay": { const r = S.routineEdit; const id = "d" + (Date.now() % 1e6); r.data.days.push({ id, name: "Day " + (r.data.days.length + 1), sub: "", kind: "lift", items: [] }); render(); break; }
    case "delDay": { const r = S.routineEdit; const d = r.data.days.splice(+b.dataset.di, 1)[0]; for (const i in r.data.schedule) if (r.data.schedule[i] === d.id) r.data.schedule[i] = ""; render(); break; }
    case "mvItem": { const it = S.routineEdit.data.days[+b.dataset.di].items; const i = +b.dataset.ii, j = i + +b.dataset.d; if (j >= 0 && j < it.length) [it[i], it[j]] = [it[j], it[i]]; render(); break; }
    case "rmItem": S.routineEdit.data.days[+b.dataset.di].items.splice(+b.dataset.ii, 1); render(); break;
    /* equipment */
    case "eqToggle": setSettings(s => { const set = new Set(s.gear.equipment); set.has(b.dataset.id) ? set.delete(b.dataset.id) : set.add(b.dataset.id); s.gear.equipment = [...set]; s.gear.preset = ""; }); render(); break;
    /* more */
    case "ruledel": setSettings(s => { s.challenge.rules.splice(+b.dataset.i, 1); }); render(); break;
    case "ruleadd": { const v = $("newRule").value.trim(); if (!v) break; setSettings(s => { s.challenge.rules.push({ id: "c" + uuid().slice(0, 8), label: v, on: true }); }); render(); break; }
    case "restart": S.confirm = { title: "Restart at Day 1?", body: "The challenge count starts over today. Your logs, photos and streak history stay.", yes: "Restart", run: () => setSettings(s => { s.challenge.startDate = todayK(); s.challenge.started = true; }) }; render(); break;
    case "confirmNo": S.confirm = null; render(); break;
    case "confirmYes": { const c = S.confirm; if (c.typed && ($("confirmTyped").value || "").trim().toUpperCase() !== c.typed) { toast(`Type ${c.typed} to confirm.`); break; } S.confirm = null; try { await c.run(); } catch (x) { toast(x.message || "That didn't work."); } render(); break; }
    case "share": shareApp(); break;
    case "syncNow": await store.flush(); await store.pull(true); toast("Synced"); break;
    case "signOut": await store.signOut(); session = null; S.auth = "signin"; S.authMsg = ""; render(); break;
    case "exportData": exportData(); break;
    case "deleteAccount": S.confirm = { title: "Delete your account?", body: "This permanently deletes your account, logs, workouts and photos. It can't be undone.", yes: "Delete everything", typed: "DELETE", run: async () => { await store.deleteAccount(); session = null; S.auth = "signin"; S.authMsg = "Your account was deleted."; } }; render(); break;
    case "t30": TM.end = Math.max(TM.end, Date.now()) + 30000; if (!TM.int) TM.int = setInterval(tick, 250); tick(); break;
    case "tstop": TM.end = 0; clearInterval(TM.int); TM.int = null; tick(); break;
  }
});

/* ================= Inputs ================= */
document.addEventListener("input", e => {
  const el = e.target, ds = el.dataset, k = S.view;
  if (el.id === "foodSearch") { if (S.sheet.mode === "search") { S.sheet.q = el.value; updateListsDebounced(); } else S.sheet.oq = el.value; return; }
  if (el.id === "amtInput") { S.sheet.sel.amount = el.value; updatePreview(); return; }
  if (el.id === "pkSearch") { S.picker.q = el.value; const eq = settings().gear.equipment, q = el.value.toLowerCase(); $("pkList").innerHTML = V.pickerList(EXERCISES.filter(x => (!S.picker.onlyMine || hasEq(x, eq)) && (!S.picker.pattern || x.pattern === S.picker.pattern) && (!q || x.name.toLowerCase().includes(q) || x.muscles.includes(q))), eq); return; }
  if (el.id === "plateTotal") { S.modal.total = el.value; return; }
  if (ds.f) { editDay(k, d => { d[ds.f] = el.value; }); needsRender = true; }
  else if (ds.m) editDay(k, d => { d.meas = d.meas || {}; d.meas[ds.m] = el.value; });
  else if (ds.wi !== undefined && ds.p) { ensureWorkout(k); editWorkout(k, w => { const it = w.items[+ds.wi]; it.sets = it.sets || []; while (it.sets.length <= +ds.si) it.sets.push({}); it.sets[+ds.si][ds.p] = el.value; }); }
  else if (ds.wn) { ensureWorkout(k); editWorkout(k, w => { w.notes = el.value; }); }
  else if (ds.ab && el.tagName === "INPUT") setSettings(s => { s.about[ds.ab] = el.value; });
  else if (ds.tg) setSettings(s => { s.targets.manual[ds.tg] = el.value; });
  else if (ds.rl !== undefined) setSettings(s => { s.challenge.rules[+ds.rl].label = el.value; });
  else if (ds.rd !== undefined) S.routineEdit.data.days[+ds.rd][ds.k] = el.value;
  else if (ds.rdc !== undefined) S.routineEdit.data.days[+ds.rdc].checklist = el.value.split("\n").map(x => x.trim()).filter(Boolean);
  else if (ds.ri) { const [di, ii, f] = ds.ri.split(":"); S.routineEdit.data.days[+di].items[+ii][f] = +el.value || 0; }
});
document.addEventListener("change", async e => {
  const el = e.target, ds = el.dataset, k = S.view;
  if (el.id === "photoInput") { const f = el.files && el.files[0]; if (f && S.photoCtx) handlePhoto(f, S.photoCtx); return; }
  if (el.id === "unitSel") { const sel = S.sheet.sel; const units = unitsFor(sel.item); const from = units.find(u => u.id === sel.unit), to = units.find(u => u.id === el.value); if (from && to && from.g && to.g) sel.amount = r1((+sel.amount || 0) * from.g / to.g) || 1; sel.unit = el.value; render(); return; }
  if (el.id === "mealSel") { S.sheet.sel.meal = el.value; return; }
  if (el.id === "pkPattern") { S.picker.pattern = el.value; render(); return; }
  if (el.id === "pkMine") { S.picker.onlyMine = el.checked; render(); return; }
  if (el.id === "plateTotal") { S.modal.total = el.value; render(); return; }
  if (el.id === "exChart") { S.exChart = el.value; render(); return; }
  if (el.id === "cmpA" || el.id === "cmpB") { S[el.id] = el.value; render(); return; }
  if (el.id === "sessPick") { editWorkout(k, w => { const logged = (w.items || []).some(it => (it.sets || []).some(x => +x.r > 0)); w.sessionId = el.value || "__rest"; if (!logged) w.items = []; }); render(); return; }
  if (ds.swap !== undefined && el.value) { ensureWorkout(k); editWorkout(k, w => { const it = w.items[+ds.swap]; it.ex = el.value; it.sets = []; const ex = EX[el.value]; if (ex && ex.reps) { it.target.lo = ex.reps[0]; it.target.hi = ex.reps[1]; } }); render(); return; }
  if (ds.ab && el.tagName === "SELECT") { setSettings(s => { s.about[ds.ab] = el.value; }); render(); return; }
  if (ds.ab) { needsRender = true; return; }
  if (ds.tr) { setSettings(s => { s.training[ds.tr] = ["days", "minutes"].includes(ds.tr) ? +el.value : el.value; }); render(); return; }
  if (el.id === "eq-preset" && el.value) { const p = PRESETS.find(x => x.id === el.value); setSettings(s => { s.gear.preset = p.id; s.gear.equipment = [...p.eq]; s.gear.dbKind = p.dbKind === "none" ? s.gear.dbKind : p.dbKind; s.gear.dbMax = p.dbMax || s.gear.dbMax; }); render(); return; }
  if (el.id === "eq-dbKind") { setSettings(s => { s.gear.dbKind = el.value; }); render(); return; }
  if (el.id === "eq-dbMax") { setSettings(s => { s.gear.dbMax = +el.value || 50; }); return; }
  if (el.id === "eq-bar") { setSettings(s => { s.gear.bar = +el.value || 45; }); return; }
  if (el.id === "eq-plates") { setSettings(s => { s.gear.plates = el.value.split(/[,\s]+/).map(Number).filter(x => x > 0); }); return; }
  if (el.id === "ch-start" && el.value) { setSettings(s => { s.challenge.startDate = el.value; }); softRender(); return; }
  if (el.id === "ch-length") { setSettings(s => { s.challenge.length = Math.min(365, Math.max(7, +el.value || 75)); }); softRender(); return; }
  if (el.id === "ch-water") { setSettings(s => { s.challenge.water = +el.value || 128; }); return; }
  if (el.id === "ch-strict") { setSettings(s => { s.challenge.strict = el.checked; }); render(); return; }
  if (el.id === "tg-manual") { setSettings(s => { s.targets.mode = el.checked ? "manual" : "auto"; }); render(); return; }
  if (ds.ruleon !== undefined) { setSettings(s => { s.challenge.rules[+ds.ruleon].on = el.checked; }); render(); return; }
  if (el.id === "acc-name") { D.displayName = el.value.trim(); store.saveProfile(); return; }
  if (ds.rdk !== undefined) { const d = S.routineEdit.data.days[+ds.rdk]; d.kind = el.value; d.items = d.items || []; d.checklist = d.checklist || []; render(); return; }
  if (ds.rs !== undefined) { S.routineEdit.data.schedule[ds.rs] = el.value; return; }
});

/* ================= Onboarding ================= */
function obNext() {
  const s = settings(), st = S.onboard;
  if (st === 0) { const n = ($("ob-name").value || "").trim(); if (n) { D.displayName = n; store.saveProfile(); } }
  if (st === 1) { const a = s.about; if (!a.sex || !+a.age || !+a.ft || !+a.weight) { toast("Fill in sex, age, height and weight so your targets are accurate."); return; } }
  if (st === 3 && !s.gear.equipment.length) { toast("Pick at least one piece of equipment, or the Bodyweight preset."); return; }
  if (st === 5) {
    const start = $("ch-start").value || todayK(), len = Math.min(365, Math.max(7, +$("ch-length").value || 75)), strict = $("ch-strict").checked;
    setSettings(x => { x.onboarded = true; x.challenge = { ...x.challenge, started: true, startDate: start, length: len, strict }; x.program = { ...x.program, startDate: start }; });
    S.tab = "today"; render(); window.scrollTo(0, 0); toast("You're set. Day 1 starts now."); return;
  }
  S.onboard = st + 1; render(); window.scrollTo(0, 0);
}

/* ================= Food ================= */
function openSheet(meal, mode) { S.sheet = { meal, date: S.view, mode, q: "", lists: {} }; render(); if (mode === "scan") beginScan(); else { updateLists(); setTimeout(() => { const i = $("foodSearch"); if (i) i.focus(); }, 60); } loadFoodDb().then(() => { if (S.sheet && S.sheet.mode === "search") updateLists(); }).catch(() => toast("Couldn't load the food database. Check your connection.")); }
function closeSheet() { stopScan(); S.sheet = null; render(); }
function basisToItem(b, en) { return { key: b.key, src: b.src, srcId: b.srcId, name: b.name, brand: b.brand || "", per100: b.per100 || null, perServing: b.perServing || null, serving: b.serving, grams: b.grams || null, portions: b.portions || [], lastAmount: en && en.amount, lastUnit: b.unitId }; }
function recentItems() {
  const seen = new Map(), freq = {};
  const ks = Object.keys(D.food).sort().reverse().slice(0, 60);
  for (const k of ks) for (const en of D.food[k]) { if (!en.basis) continue; freq[en.basis.key] = (freq[en.basis.key] || 0) + 1; if (!seen.has(en.basis.key)) seen.set(en.basis.key, basisToItem(en.basis, en)); }
  return { list: [...seen.values()].sort((a, b) => (freq[b.key] || 0) - (freq[a.key] || 0)), freq };
}
function updateLists() {
  const sh = S.sheet; if (!sh) return;
  const q = (sh.q || "").toLowerCase().trim(), words = q.split(/\s+/).filter(Boolean), m = n => words.every(w => n.toLowerCase().includes(w));
  const { list, freq } = recentItems();
  const mine = Object.values(D.custom).map(c => c.kind === "meal" ? { ...customToItem(c), src: "meal" } : customToItem(c));
  sh.lists = { mine: q ? mine.filter(x => m(x.name + " " + (x.brand || ""))) : mine.slice(0, 20), recent: q ? list.filter(x => m(x.name + " " + (x.brand || ""))).slice(0, 8) : list.slice(0, 15) };
  const have = new Set(sh.lists.recent.map(x => x.key));
  sh.lists.usda = q ? searchLocal(q, freq).filter(x => !have.has(x.key)).slice(0, 40) : [];
  const el = $("sheetResults"); if (el) el.innerHTML = V.resultsHTML();
}
let ulT; function updateListsDebounced() { clearTimeout(ulT); ulT = setTimeout(updateLists, 120); }
async function onlineSearch(q) {
  const sh = S.sheet; if (!q) return; sh.oq = q; sh.oLoading = true; sh.oErr = ""; const el = $("sheetResults"); if (el) el.innerHTML = V.resultsHTML();
  const [a, b] = await Promise.allSettled([offSearch(q), fdcSearch(q)]);
  const A = a.status === "fulfilled" ? a.value : [], B = b.status === "fulfilled" ? b.value : [];
  const out = []; for (let i = 0; i < Math.max(A.length, B.length); i++) { if (B[i]) out.push(B[i]); if (A[i]) out.push(A[i]); }
  if (S.sheet !== sh) return;
  sh.oLoading = false; sh.oRes = out;
  if (!out.length && a.status === "rejected" && b.status === "rejected") sh.oErr = b.reason && b.reason.message === "rate" ? "The shared USDA key is busy and Open Food Facts didn't answer. Try again in a minute." : "Couldn't reach the online food databases. Check your connection.";
  const el2 = $("sheetResults"); if (el2) el2.innerHTML = V.resultsHTML();
}
function selectItem(it) {
  stopScan();
  const unit = it.lastUnit && unitsFor(it).some(u => u.id === it.lastUnit) ? it.lastUnit : defaultUnit(it);
  const amount = it.lastAmount || (unit === "g" ? 100 : 1);
  S.sheet.sel = { item: it, amount, unit, meal: S.sheet.meal };
  render();
}
function updatePreview() { const sel = S.sheet.sel; const el = $("selPreview"); if (el) el.innerHTML = V.previewHTML(computeNutrients(sel.item, +sel.amount || 0, sel.unit)); }
function commitSel() {
  const sh = S.sheet, sel = sh.sel, it = sel.item, amt = +sel.amount;
  if (!(amt > 0)) { toast("Enter an amount."); return; }
  const meal = sel.meal || sh.meal;
  if (it.src === "meal" && it.custom && it.custom.ingredients) {
    for (const ing of it.custom.ingredients) { const n = {}; for (const key in ing.nutrients) n[key] = ing.nutrients[key] * amt; addFood({ ...clone(ing), id: undefined, date: sh.date, meal, amount: r1(ing.amount * amt), grams: ing.grams ? ing.grams * amt : null, nutrients: n }); }
    S.sheet = null; render(); toast(`Added ${it.name}`); return;
  }
  const calc = computeNutrients(it, amt, sel.unit);
  const basis = { key: it.key, src: it.src, srcId: it.srcId, name: it.name, brand: it.brand || "", per100: it.per100 || null, perServing: it.perServing || null, serving: it.serving || "", grams: it.grams || null, portions: it.portions || [], unitId: sel.unit };
  const entry = { date: sh.date, meal, name: it.name, brand: it.brand || "", source: it.src, sourceId: it.srcId, amount: amt, unit: calc.unitLabel, grams: calc.grams, nutrients: calc.nutrients, basis };
  if (sel.editId) { const old = foodOn(sh.date).find(x => x.id === sel.editId); updateFood({ ...old, ...entry, id: sel.editId }); toast("Updated"); }
  else { addFood(entry); toast(`Added ${it.name}`); }
  S.sheet = null; render();
}
function editEntry(en) {
  if (!en.basis) { toast("This entry can only be deleted."); return; }
  S.sheet = { meal: en.meal, date: en.date, mode: "search", q: "", lists: {}, sel: { item: basisToItem(en.basis, en), amount: en.amount, unit: en.basis.unitId || defaultUnit(basisToItem(en.basis)), meal: en.meal, editId: en.id } };
  render();
}
function saveQuick(custom) {
  const g = id => ($(id) ? $(id).value.trim() : ""), err = $("qErr");
  const name = g("q-name"), n = {}; for (const key of NUT_KEYS) { const v = g("q-" + key); if (v !== "" && !isNaN(+v)) n[key] = +v; }
  if (!name) { err.textContent = "Give it a name."; return; }
  if (!(n.kcal >= 0) || g("q-kcal") === "") { err.textContent = "Enter the calories."; return; }
  if (!custom) { addFood({ date: S.sheet.date, meal: S.sheet.meal, name, source: "quick", amount: 1, unit: "entry", grams: null, nutrients: n, basis: null }); S.sheet = null; render(); toast("Added"); return; }
  const row = { id: uuid(), kind: "food", name, brand: g("q-brand") || null, barcode: g("q-barcode") || null, serving: g("q-serving") || "1 serving", grams: +g("q-g") || null, nutrients: n };
  store.saveCustom(row); selectItem(customToItem(row));
}
function saveMeal(meal) {
  const list = foodOn(S.view).filter(x => x.meal === meal); if (!list.length) return;
  const label = (V.MEALS.find(m => m[0] === meal) || [])[1];
  const n = {}; for (const en of list) for (const key in en.nutrients) n[key] = (n[key] || 0) + (+en.nutrients[key] || 0);
  const name = `${label}: ${list.slice(0, 3).map(x => x.name.split(",")[0]).join(", ")}${list.length > 3 ? "…" : ""}`;
  store.saveCustom({ id: uuid(), kind: "meal", name, serving: "1 meal", grams: null, nutrients: n, ingredients: list.map(x => ({ name: x.name, brand: x.brand, source: x.source, sourceId: x.sourceId, amount: x.amount, unit: x.unit, grams: x.grams, nutrients: x.nutrients, basis: x.basis })) });
  toast("Saved. Find it under My foods & meals.");
}
/* barcode */
let scanCtl = null;
async function beginScan() {
  const v = $("scanVideo"); if (!v) return;
  try { scanCtl = await startScanner(v, code => handleCode(code)); const m = $("scanMsg"); if (m) m.textContent = "Scanning…"; }
  catch (e) { const m = $("scanMsg"); if (m) m.textContent = "Camera unavailable. Allow camera access, type the number, or take a photo of the barcode."; }
}
function stopScan() { try { scanCtl && scanCtl.stop(); } catch (e) {} scanCtl = null; }
async function handleCode(code) {
  code = String(code || "").replace(/\D/g, ""); if (code.length < 6) { toast("That doesn't look like a barcode."); return; }
  stopScan(); const m = $("scanMsg"); if (m) m.textContent = `Looking up ${code}…`;
  const mine = Object.values(D.custom).find(c => c.barcode && c.barcode.replace(/^0+/, "") === code.replace(/^0+/, ""));
  if (mine) { selectItem(customToItem(mine)); return; }
  const it = await lookupBarcode(code).catch(() => null);
  if (it) { selectItem(it); return; }
  S.sheet.mode = "create"; render(); const bc = $("q-barcode"); if (bc) bc.value = code; toast("Not in the databases yet. Add it from the label and it's saved for next time.");
}

/* ================= Training ================= */
function ensureWorkout(k) {
  const w = workout(k);
  if (w && w.items && w.items.length) return;
  const sess = sessionFor(k);
  editWorkout(k, x => {
    x.sessionId = x.sessionId || (sess && sess.id) || "";
    if (!x.items || !x.items.length) x.items = sess && sess.kind === "lift" ? plannedItems(k, sess).map(it => ({ ex: it.ex, target: { sets: it.sets, lo: it.lo, hi: it.hi, rest: it.rest }, sets: [] })) : [];
    x.start = x.start || Date.now();
  });
}
function setDone(wi, si) {
  const k = S.view; ensureWorkout(k); let on = false, prs = [], rest = 90;
  editWorkout(k, w => {
    const it = w.items[wi]; it.sets = it.sets || []; while (it.sets.length <= si) it.sets.push({});
    const x = it.sets[si]; x.d = !x.d; on = x.d; rest = it.target.rest || 90;
    if (on) {
      const a = (document.getElementById(`w-${wi}-${si}`) || {}).placeholder;
      if ((x.w === undefined || x.w === "") && a) x.w = a;
      if (x.r === undefined || x.r === "") x.r = it.target.hi;
      prs = prTypes(it.ex, x, k); x.pr = prs;
    } else x.pr = [];
  });
  if (on) { startTimer(rest); if (prs.length) toast("New PR! " + prs.join(", ")); }
  render();
}
function pickExercise(id) {
  const pk = S.picker; const ex = EX[id]; if (!ex) return;
  const tgt = { sets: 3, lo: ex.reps ? ex.reps[0] : (ex.tier === 1 ? 5 : ex.tier === 2 ? 8 : 10), hi: ex.reps ? ex.reps[1] : (ex.tier === 1 ? 8 : ex.tier === 2 ? 12 : 15), rest: ex.tier === 1 ? 150 : ex.tier === 2 ? 105 : 60 };
  if (pk.target === "today") { ensureWorkout(S.view); editWorkout(S.view, w => { w.items.push({ ex: id, target: tgt, sets: [] }); }); }
  else S.routineEdit.data.days[pk.di].items.push({ ex: id, ...tgt });
  S.picker = null; render(); toast(`Added ${ex.name}`);
}
function finishWorkout() {
  const k = S.view; ensureWorkout(k); let sets = 0, vol = 0, prs = 0, mins = 0;
  editWorkout(k, w => {
    w.finished = !w.finished; w.end = w.finished ? Date.now() : null;
    for (const it of w.items || []) for (const x of it.sets || []) if (+x.r > 0 && x.d) { sets++; vol += (+x.w || 0) * (+x.r || 0); if (x.pr && x.pr.length) prs++; }
    mins = w.start && w.end ? Math.round((w.end - w.start) / 60000) : 0;
  });
  const w = workout(k);
  if (w.finished) toast(`Workout done: ${sets} set${sets === 1 ? "" : "s"}, ${fmt(vol)} lb moved${prs ? `, ${prs} PR${prs === 1 ? "" : "s"}` : ""}${mins ? `, ${mins} min` : ""}.`);
  render();
}
const TM = { end: 0, int: null };
function startTimer(sec) { TM.end = Date.now() + sec * 1000; clearInterval(TM.int); TM.int = setInterval(tick, 250); tick(); }
function tick() {
  const el = $("timer"); if (!TM.end) { el.hidden = true; return; }
  const left = Math.max(0, Math.round((TM.end - Date.now()) / 1000)); el.hidden = false;
  el.innerHTML = `<div><span>${left ? "Rest " + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0") : "Go. Next set."}</span><button data-act="t30">+30s</button><button data-act="tstop">${left ? "Skip" : "Close"}</button></div>`;
  if (!left && TM.int) { clearInterval(TM.int); TM.int = null; try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {} }
}

/* ================= Photos ================= */
function openPhotoPicker(ctx) { S.photoCtx = ctx; const i = $("photoInput"); i.value = ""; i.click(); }
async function loadImage(file) {
  if (window.createImageBitmap) { try { const b = await createImageBitmap(file, { imageOrientation: "from-image" }); return { src: b, w: b.width, h: b.height, done: () => b.close && b.close() }; } catch (e) {} }
  const url = URL.createObjectURL(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That file isn't an image we can read.")); i.src = url; });
  return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}
async function resize(file, max, q) {
  const im = await loadImage(file);
  const sc = Math.min(1, max / Math.max(im.w, im.h));
  const c = document.createElement("canvas"); c.width = Math.round(im.w * sc); c.height = Math.round(im.h * sc);
  c.getContext("2d").drawImage(im.src, 0, 0, c.width, c.height); im.done();
  return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("Couldn't process the photo.")), "image/jpeg", q));
}
async function handlePhoto(file, ctx) {
  if (ctx.kind === "barcode") { try { const code = await decodeImageFile(file); handleCode(code); } catch (e) { toast("Couldn't read a barcode in that photo. Try again closer, or type the number."); } return; }
  toast("Saving photo…");
  try {
    const full = await resize(file, 1600, 0.82), thumb = await resize(file, 480, 0.75);
    if (ctx.kind === "progress") { const old = Object.values(D.photos).find(p => p.date === ctx.date && p.kind === "progress" && p.slot === ctx.slot); if (old) await store.deletePhoto(old).catch(() => {}); }
    await store.addPhoto({ id: uuid(), ...ctx }, full, thumb);
    toast("Photo saved"); render();
  } catch (e) { console.error(e); toast(navigator.onLine ? "Couldn't save the photo: " + (e.message || "error") : "You're offline. Photos need a connection to upload."); }
}

/* ================= Sharing & export ================= */
async function shareApp() {
  const url = location.origin + location.pathname;
  const text = "I'm doing a 75-day challenge with Iron 75: training built for your gym, food tracking, progress photos and streaks. Make your own free account:";
  try { if (navigator.share) { await navigator.share({ title: "Iron 75", text, url }); return; } } catch (e) { if (e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(text + " " + url); toast("Invite link copied"); } catch (e) { toast(url); }
}
function exportData() {
  const blob = new Blob([JSON.stringify(store.exportAll(), null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `iron75-${todayK()}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

boot();
window.__iron75 = { S, D, render, store };
