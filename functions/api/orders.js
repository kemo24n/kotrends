import { json, bad, clean, CODES, money } from "../../lib/shared.js";
// Place an order. Prices, discounts, delivery and stock are all computed here from the database,
// so nothing the browser sends can change what the customer pays.
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return bad("Invalid request"); }
  const phone = clean(b.phone, 40);
  if ((phone.match(/\d/g) || []).length < 8) return bad("Phone number needs at least 8 digits");
  const country = b.country === "SY" ? "SY" : "LB";
  const payment = { cod: "Cash on delivery", whish: "Whish Money", sham: "Sham Cash" }[b.pay] || "Cash on delivery";
  const items = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
  if (!items.length) return bad("Your bag is empty");

  const ids = [...new Set(items.map(i => String(i.id)))];
  const ph = ids.map(() => "?").join(",");
  const { results } = await env.DB.prepare(`SELECT * FROM products WHERE id IN (${ph}) AND hidden = 0`).bind(...ids).all();
  const byId = Object.fromEntries(results.map(r => [r.id, r]));

  const need = {}; const lines = [];
  for (const it of items) {
    const p = byId[String(it.id)]; if (!p) return bad("A product in your bag is no longer available");
    const qty = Math.max(1, Math.min(10, parseInt(it.qty) || 1));
    const sizes = JSON.parse(p.sizes), out = JSON.parse(p.out_sizes);
    let size = clean(it.size, 10);
    if (size !== "?" && (!sizes.includes(size) || out.includes(size))) return bad(`Size ${size} of ${p.name} is not available`);
    need[p.id] = (need[p.id] || 0) + qty;
    lines.push({ id: p.id, name: p.name, size, qty, price: p.price, fit: clean(it.fit, 60) });
  }
  for (const id in need) if (byId[id].stock < need[id]) return bad(`Only ${byId[id].stock} left of ${byId[id].name}`, 409);

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  let discount = count >= 3 ? subtotal * 0.1 : 0, promo = "";
  const code = clean(b.promo, 20).toUpperCase();
  if (CODES[code] && subtotal * CODES[code] / 100 > discount) { discount = subtotal * CODES[code] / 100; promo = code; }
  discount = Math.round(discount * 100) / 100;
  const after = subtotal - discount;
  const delivery = after >= 100 ? 0 : country === "SY" ? 5 : 4;
  const total = Math.round((after + delivery) * 100) / 100;

  const stmts = [
    env.DB.prepare(`INSERT INTO orders (name, phone, country, city, address, notes, payment, items, subtotal, discount, delivery, total, promo)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(clean(b.name, 80), phone, country, clean(b.city, 60), clean(b.address, 300), clean(b.notes, 300),
      payment, JSON.stringify(lines), subtotal, discount, delivery, total, promo),
    ...Object.entries(need).map(([id, q]) => env.DB.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?").bind(q, id)),
  ];
  const res = await env.DB.batch(stmts);
  const oid = res[0].meta.last_row_id;
  const orderCode = "KO-" + (1000 + oid);
  await env.DB.prepare("UPDATE orders SET code = ? WHERE id = ?").bind(orderCode, oid).run();
  return json({ code: orderCode, lines, subtotal, discount, delivery, total, promo, payment, country }, 201);
}
