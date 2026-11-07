/* Data layer: Supabase (accounts + sync) with an on-device cache and an offline write queue.
   Falls back to a device-only mode when Supabase isn't configured or the person chooses it. */
import { CONFIG } from "./config.js";

export const configured = !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
let sb = null;
export async function client() {
  if (!configured) return null;
  if (!sb) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
    sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  }
  return sb;
}

/* ---------- IndexedDB ---------- */
const IDB = {
  db: null,
  open() { return new Promise((res, rej) => { const r = indexedDB.open("iron75-v3", 1); r.onupgradeneeded = () => { const d = r.result; d.createObjectStore("cache"); d.createObjectStore("queue"); d.createObjectStore("blobs"); }; r.onsuccess = () => { this.db = r.result; res(); }; r.onerror = () => rej(r.error); }); },
  req(s, m, fn) { return new Promise((res, rej) => { const t = this.db.transaction(s, m); const q = fn(t.objectStore(s)); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); },
  get(s, k) { return this.req(s, "readonly", o => o.get(k)); },
  put(s, k, v) { return this.req(s, "readwrite", o => o.put(v, k)); },
  del(s, k) { return this.req(s, "readwrite", o => o.delete(k)); },
  keys(s) { return this.req(s, "readonly", o => o.getAllKeys()); },
  all(s) { return this.req(s, "readonly", o => o.getAll()); }
};
let idbReady = null;
const ready = () => idbReady || (idbReady = IDB.open());

/* ---------- State container shared with the app ---------- */
export const D = { mode: "none", uid: null, email: "", displayName: "", profile: {}, days: {}, workouts: {}, food: {}, custom: {}, routines: {}, photos: {}, syncedAt: 0 };
let listeners = []; export function onChange(fn) { listeners.push(fn); }
let statusFn = () => {}; export function onStatus(fn) { statusFn = fn; }
const emit = () => listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } });

function snapshot() { return { profile: D.profile, displayName: D.displayName, email: D.email, days: D.days, workouts: D.workouts, food: D.food, custom: D.custom, routines: D.routines, photos: D.photos, savedAt: Date.now() }; }
let cacheT; function saveCache() { clearTimeout(cacheT); cacheT = setTimeout(() => { if (D.uid) IDB.put("cache", D.uid, snapshot()).catch(() => {}); }, 600); }
function applySnapshot(s) { if (!s) return; Object.assign(D, { profile: s.profile || {}, displayName: s.displayName || "", email: s.email || D.email, days: s.days || {}, workouts: s.workouts || {}, food: s.food || {}, custom: s.custom || {}, routines: s.routines || {}, photos: s.photos || {} }); }

/* ---------- Auth ---------- */
export async function currentSession() {
  await ready();
  const c = await client();
  if (c) { const { data } = await c.auth.getSession(); if (data.session) return { mode: "cloud", user: data.session.user }; }
  try { if (localStorage.getItem("iron75-local") === "1") return { mode: "local", user: { id: "local", email: "" } }; } catch (e) {}
  return null;
}
export async function onAuthEvent(fn) { const c = await client(); if (c) c.auth.onAuthStateChange((ev, session) => fn(ev, session)); }
export async function signUp(email, password, name) {
  const c = await client();
  const { data, error } = await c.auth.signUp({ email, password, options: { data: { display_name: name }, emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error; return data;
}
export async function signIn(email, password) { const c = await client(); const { data, error } = await c.auth.signInWithPassword({ email, password }); if (error) throw error; return data; }
export async function sendReset(email) { const c = await client(); const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); if (error) throw error; }
export async function setPassword(pw) { const c = await client(); const { error } = await c.auth.updateUser({ password: pw }); if (error) throw error; }
export async function signOut() {
  if (D.mode === "cloud") { await flush(); const c = await client(); await c.auth.signOut(); }
  try { localStorage.removeItem("iron75-local"); } catch (e) {}
  Object.assign(D, { mode: "none", uid: null, profile: {}, days: {}, workouts: {}, food: {}, custom: {}, routines: {}, photos: {} });
}
export function useLocalMode() { try { localStorage.setItem("iron75-local", "1"); } catch (e) {} }

/* ---------- Loading ---------- */
async function fetchAll(c, table, filter) {
  const out = []; let from = 0; const size = 1000;
  for (;;) {
    let q = c.from(table).select("*").range(from, from + size - 1);
    if (filter) q = filter(q);
    const { data, error } = await q; if (error) throw error;
    out.push(...data); if (data.length < size) break; from += size;
  }
  return out;
}
export async function start(sess) {
  await ready();
  D.mode = sess.mode; D.uid = sess.user.id; D.email = sess.user.email || "";
  applySnapshot(await IDB.get("cache", D.uid).catch(() => null));
  emit();
  if (D.mode === "cloud") { await pull(true); flush(); }
}
export async function pull(full) {
  if (D.mode !== "cloud") return;
  const c = await client();
  try {
    statusFn("Syncing…");
    const since = full ? null : new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10);
    const f = q => (since ? q.gte("date", since) : q);
    const [prof, days, wos, food, custom, routines, photos] = await Promise.all([
      c.from("profiles").select("*").eq("id", D.uid).maybeSingle(),
      fetchAll(c, "day_logs", f), fetchAll(c, "workouts", f), fetchAll(c, "food_entries", f),
      fetchAll(c, "custom_foods"), fetchAll(c, "routines"), fetchAll(c, "photos")
    ]);
    const pending = new Set((await IDB.keys("queue")).map(String));
    if (prof.data && !pending.has("profiles|" + D.uid)) { D.profile = prof.data.settings || {}; D.displayName = prof.data.display_name || ""; }
    if (full) { D.days = {}; D.workouts = {}; D.food = {}; }
    else { for (const k of Object.keys(D.food)) if (k >= since) delete D.food[k]; }
    for (const r of days) if (!pending.has("day_logs|" + r.date)) D.days[r.date] = r.data;
    for (const r of wos) if (!pending.has("workouts|" + r.date)) D.workouts[r.date] = r.data;
    for (const r of food) { (D.food[r.date] = D.food[r.date] || []).push(rowToEntry(r)); }
    D.custom = Object.fromEntries(custom.map(r => [r.id, r]));
    D.routines = Object.fromEntries(routines.map(r => [r.id, r]));
    D.photos = Object.fromEntries(photos.map(r => [r.id, r]));
    // keep queued (unsynced) food writes visible
    for (const q of await IDB.all("queue")) if (q.table === "food_entries") {
      const list = Object.values(D.food).flat();
      if (q.op === "upsert" && !list.some(e => e.id === q.row.id)) (D.food[q.row.date] = D.food[q.row.date] || []).push(rowToEntry(q.row));
      if (q.op === "delete") for (const k in D.food) D.food[k] = D.food[k].filter(e => e.id !== q.pk);
    }
    D.syncedAt = Date.now(); saveCache(); statusFn("Synced"); emit();
  } catch (e) { console.error(e); statusFn(navigator.onLine ? "Couldn't sync: " + (e.message || "server error") : "Offline. Changes will sync later."); }
}
export function rowToEntry(r) { return { id: r.id, date: r.date, meal: r.meal, name: r.name, brand: r.brand || "", source: r.source, sourceId: r.source_id, amount: +r.amount, unit: r.unit, grams: r.grams == null ? null : +r.grams, nutrients: r.nutrients || {}, basis: r.basis || null, created_at: r.created_at }; }

/* ---------- Writes ---------- */
const PK = { profiles: r => r.id, day_logs: r => r.date, workouts: r => r.date, food_entries: r => r.id, custom_foods: r => r.id, routines: r => r.id, photos: r => r.id };
async function enqueue(table, op, row, pk) {
  if (D.mode !== "cloud") return;
  await IDB.put("queue", table + "|" + pk, { table, op, row, pk, t: Date.now() });
  scheduleFlush();
}
let flushT, flushing = false;
function scheduleFlush() { clearTimeout(flushT); flushT = setTimeout(flush, 500); }
export async function flush() {
  if (D.mode !== "cloud" || flushing) return; flushing = true;
  try {
    const c = await client(); const keys = await IDB.keys("queue");
    if (keys.length) statusFn("Saving…");
    for (const k of keys) {
      const q = await IDB.get("queue", k); if (!q) continue;
      let error;
      if (q.op === "upsert") ({ error } = await c.from(q.table).upsert(q.row));
      else ({ error } = await c.from(q.table).delete().eq(q.table === "day_logs" || q.table === "workouts" ? "date" : "id", q.pk).eq(q.table === "profiles" ? "id" : "user_id", D.uid));
      if (error) {
        if (/fetch|network|Failed/i.test(error.message || "")) { statusFn("Offline. Changes will sync later."); break; }
        console.error(q, error); statusFn("A change couldn't be saved: " + error.message);
      }
      const now = await IDB.get("queue", k);
      if (now && now.t === q.t) await IDB.del("queue", k);
    }
    const left = (await IDB.keys("queue")).length;
    if (!left && keys.length) statusFn("Saved");
  } catch (e) { statusFn("Offline. Changes will sync later."); }
  finally { flushing = false; }
}
window.addEventListener("online", () => { flush(); pull(false); });

export function saveProfile() { saveCache(); return enqueue("profiles", "upsert", { id: D.uid, display_name: D.displayName, settings: D.profile }, D.uid); }
export function saveDay(date) { saveCache(); return enqueue("day_logs", "upsert", { user_id: D.uid, date, data: D.days[date] || {} }, date); }
export function saveWorkout(date) { saveCache(); const w = D.workouts[date]; return w ? enqueue("workouts", "upsert", { user_id: D.uid, date, data: w }, date) : enqueue("workouts", "delete", null, date); }
export function saveFood(e) {
  saveCache();
  return enqueue("food_entries", "upsert", { id: e.id, user_id: D.uid, date: e.date, meal: e.meal, name: e.name, brand: e.brand || null, source: e.source || null, source_id: e.sourceId || null, amount: e.amount, unit: e.unit, grams: e.grams, nutrients: e.nutrients, basis: e.basis || null }, e.id);
}
export function deleteFood(id) { saveCache(); return enqueue("food_entries", "delete", null, id); }
export function saveCustom(row) { D.custom[row.id] = row; saveCache(); return enqueue("custom_foods", "upsert", { ...row, user_id: D.uid }, row.id); }
export function deleteCustom(id) { delete D.custom[id]; saveCache(); return enqueue("custom_foods", "delete", null, id); }
export function saveRoutine(row) { D.routines[row.id] = row; saveCache(); return enqueue("routines", "upsert", { id: row.id, user_id: D.uid, name: row.name, data: row.data }, row.id); }
export function deleteRoutine(id) { delete D.routines[id]; saveCache(); return enqueue("routines", "delete", null, id); }
export function pendingCount() { return IDB.keys("queue").then(k => k.length).catch(() => 0); }

/* ---------- Photos ---------- */
const urlCache = {};
export async function addPhoto(meta, full, thumb) {
  const base = `${D.uid}/${meta.date}/${meta.id}`;
  const row = { id: meta.id, user_id: D.uid, date: meta.date, kind: meta.kind, slot: meta.slot || null, meal: meta.meal || null, path: base + ".jpg", thumb_path: base + "_t.jpg", created_at: new Date().toISOString() };
  if (D.mode === "cloud") {
    const c = await client();
    const up1 = await c.storage.from("photos").upload(row.path, full, { contentType: "image/jpeg", upsert: true }); if (up1.error) throw up1.error;
    const up2 = await c.storage.from("photos").upload(row.thumb_path, thumb, { contentType: "image/jpeg", upsert: true }); if (up2.error) throw up2.error;
    const { error } = await c.from("photos").insert(row); if (error) throw error;
  } else { await IDB.put("blobs", row.path, full); await IDB.put("blobs", row.thumb_path, thumb); }
  urlCache[row.path] = { url: URL.createObjectURL(full), exp: Infinity }; urlCache[row.thumb_path] = { url: URL.createObjectURL(thumb), exp: Infinity };
  D.photos[row.id] = row; saveCache(); emit(); return row;
}
export async function deletePhoto(row) {
  if (D.mode === "cloud") {
    const c = await client();
    await c.storage.from("photos").remove([row.path, row.thumb_path].filter(Boolean));
    const { error } = await c.from("photos").delete().eq("id", row.id); if (error) throw error;
  } else { await IDB.del("blobs", row.path); if (row.thumb_path) await IDB.del("blobs", row.thumb_path); }
  delete D.photos[row.id]; saveCache(); emit();
}
export function photoUrlSync(path) { const c = urlCache[path]; return c && c.exp > Date.now() ? c.url : ""; }
export async function resolvePhotoUrls(paths) {
  const need = paths.filter(p => p && !photoUrlSync(p));
  if (!need.length) return false;
  if (D.mode === "cloud") {
    const c = await client();
    for (let i = 0; i < need.length; i += 100) {
      const { data } = await c.storage.from("photos").createSignedUrls(need.slice(i, i + 100), 3600);
      for (const d of data || []) if (d.signedUrl) urlCache[d.path] = { url: d.signedUrl, exp: Date.now() + 3500e3 };
    }
  } else {
    for (const p of need) { const b = await IDB.get("blobs", p); if (b) urlCache[p] = { url: URL.createObjectURL(b), exp: Infinity }; }
  }
  return true;
}

/* ---------- Account ---------- */
export async function deleteAccount() {
  if (D.mode === "cloud") {
    const c = await client();
    const paths = Object.values(D.photos).flatMap(p => [p.path, p.thumb_path]).filter(Boolean);
    for (let i = 0; i < paths.length; i += 100) await c.storage.from("photos").remove(paths.slice(i, i + 100));
    const { error } = await c.rpc("delete_my_account"); if (error) throw error;
    await c.auth.signOut();
  }
  await IDB.del("cache", D.uid).catch(() => {});
  for (const k of await IDB.keys("queue")) await IDB.del("queue", k);
  try { localStorage.removeItem("iron75-local"); } catch (e) {}
}
export function exportAll() { return { app: "iron75", version: 3, exported: new Date().toISOString(), ...snapshot() }; }
export function touch() { saveCache(); }
