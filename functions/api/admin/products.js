import { json, bad, rowToProduct, clean, slug, CATS, SHOE_CATS } from "../../../lib/shared.js";
const SHOE = ["40","41","42","43","44","45","46"], APP = ["S","M","L","XL","XXL"];

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare("SELECT * FROM products ORDER BY hidden ASC, feat DESC, added DESC").all();
  return json(results.map(rowToProduct));
}

function readProduct(b, old = {}) {
  const cat = CATS.includes(b.cat) ? b.cat : (old.cat || "sneakers");
  const price = Number(b.price ?? old.price);
  if (!(price >= 1)) throw new Error("Price must be a number");
  const list = v => (Array.isArray(v) ? v : String(v || "").split(",")).map(x => clean(x, 10)).filter(Boolean);
  const sizes = b.sizes !== undefined ? list(b.sizes) : (old.sizes || (SHOE_CATS.includes(cat) ? SHOE : APP));
  const imgs = b.img !== undefined ? (Array.isArray(b.img) ? b.img : []).map(x => clean(x, 300)).filter(Boolean).slice(0, 12) : (old.img || []);
  return {
    name: clean(b.name ?? old.name, 120), brand: clean(b.brand ?? old.brand, 60), cat, price,
    was: Math.max(0, Number(b.was ?? old.was) || 0), sizes, out: (b.out !== undefined ? list(b.out) : (old.out || [])).filter(s => sizes.includes(s)),
    stock: Math.max(0, parseInt(b.stock ?? old.stock) || 0), tag: ["", "new"].includes(b.tag) ? b.tag : (old.tag || ""),
    color: clean(b.color ?? old.color, 80), desc: clean(b.desc ?? old.desc, 600), img: imgs, cut: old.cut || "",
    feat: parseInt(b.feat ?? old.feat) || 0, hidden: b.hidden !== undefined ? !!b.hidden : !!old.hidden,
  };
}
const write = (env, id, p, added) => env.DB.prepare(`INSERT INTO products (id,name,brand,cat,price,was,sizes,out_sizes,stock,tag,color,descr,imgs,cut,feat,added,hidden,updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
  ON CONFLICT(id) DO UPDATE SET name=excluded.name,brand=excluded.brand,cat=excluded.cat,price=excluded.price,was=excluded.was,sizes=excluded.sizes,
  out_sizes=excluded.out_sizes,stock=excluded.stock,tag=excluded.tag,color=excluded.color,descr=excluded.descr,imgs=excluded.imgs,feat=excluded.feat,hidden=excluded.hidden,updated_at=datetime('now')`)
  .bind(id, p.name, p.brand, p.cat, p.price, p.was, JSON.stringify(p.sizes), JSON.stringify(p.out), p.stock, p.tag, p.color, p.desc, JSON.stringify(p.img), p.cut, p.feat, added, p.hidden ? 1 : 0).run();

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return bad("Invalid request"); }
  try {
    const p = readProduct(b); if (!p.name) return bad("Add a product name");
    if (!p.img.length) return bad("Add at least one photo");
    const id = slug(p.name) + "-" + Date.now().toString(36);
    const { results } = await env.DB.prepare("SELECT MAX(added) AS m FROM products").all();
    await write(env, id, { ...p, feat: p.feat || 20 }, (results[0].m || 0) + 1);
    return json({ id }, 201);
  } catch (e) { return bad(e.message); }
}

export async function onRequestPut({ request, env }) {
  let b; try { b = await request.json(); } catch { return bad("Invalid request"); }
  const row = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(String(b.id)).first();
  if (!row) return bad("Product not found", 404);
  try { const old = rowToProduct(row); await write(env, row.id, readProduct(b, old), row.added); return json({ ok: true }); }
  catch (e) { return bad(e.message); }
}

export async function onRequestDelete({ request, env }) {
  const id = new URL(request.url).searchParams.get("id");
  await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
  return json({ ok: true });
}
