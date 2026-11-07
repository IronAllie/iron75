export const pad = n => String(n).padStart(2, "0");
export const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
export const parseK = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
export const dayIdx = k => { const [y, m, d] = k.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
export const addDays = (k, n) => { const d = parseK(k); d.setDate(d.getDate() + n); return ymd(d); };
export const diff = (a, b) => dayIdx(a) - dayIdx(b);
export const todayK = () => ymd(new Date());
export const fmtDate = k => parseK(k).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
export const md = k => { const d = parseK(k); return (d.getMonth() + 1) + "/" + d.getDate(); };
export const wkStart = k => { const d = parseK(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const r1 = n => Math.round(n * 10) / 10;
export const fmt = n => (isFinite(n) ? Math.round(n) : 0).toLocaleString();
export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }));
export const clone = o => JSON.parse(JSON.stringify(o ?? null));
export const e1rm = (w, r) => w * (1 + r / 30);
export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
