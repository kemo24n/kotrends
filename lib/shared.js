// Shared helpers for the KO Trends API (Cloudflare Pages Functions + D1 + R2)
export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
export const bad = (msg, status = 400) => json({ error: msg }, status);

export const SHOE_CATS = ["sneakers", "hoops", "slides"];
export const CATS = ["sneakers", "hoops", "jerseys", "football", "tees", "bottoms", "slides"];
export const STATUSES = ["New", "Confirmed", "Out for delivery", "Delivered", "Cancelled"];
export const CODES = { KO10: 10 };

export function rowToProduct(r) {
  return {
    id: r.id, name: r.name, brand: r.brand, cat: r.cat, price: r.price, was: r.was,
    sizes: JSON.parse(r.sizes || "[]"), out: JSON.parse(r.out_sizes || "[]"), stock: r.stock,
    tag: r.tag, color: r.color, desc: r.descr, img: JSON.parse(r.imgs || "[]"), cut: r.cut,
    feat: r.feat, added: r.added, hidden: !!r.hidden,
  };
}

const enc = new TextEncoder();
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}
export function secretOf(env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 16) throw new Error("SESSION_SECRET is not set");
  return env.SESSION_SECRET;
}
export async function makeSession(env, days = 30) {
  const exp = Date.now() + days * 864e5;
  return `${exp}.${await hmac(secretOf(env), "ko-admin:" + exp)}`;
}
export async function checkSession(request, env) {
  const m = (request.headers.get("cookie") || "").match(/(?:^|;\s*)ko_admin=([^;]+)/);
  if (!m) return false;
  const [exp, sig] = decodeURIComponent(m[1]).split(".");
  if (!exp || !sig || +exp < Date.now()) return false;
  const good = await hmac(secretOf(env), "ko-admin:" + exp);
  return safeEqual(good, sig);
}
export function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export async function samePassword(env, given) {
  if (!env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD is not set");
  const s = secretOf(env);
  return safeEqual(await hmac(s, String(given || "")), await hmac(s, env.ADMIN_PASSWORD));
}
export const cookie = (value, maxAge) =>
  `ko_admin=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

export function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";
}
export const money = n => "$" + (Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
export const clean = (v, max = 300) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
