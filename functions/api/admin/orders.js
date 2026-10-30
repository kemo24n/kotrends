import { json, bad, STATUSES } from "../../../lib/shared.js";
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url), status = url.searchParams.get("status");
  const q = status && STATUSES.includes(status)
    ? env.DB.prepare("SELECT * FROM orders WHERE status = ? ORDER BY id DESC LIMIT 300").bind(status)
    : env.DB.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 300");
  const { results } = await q.all();
  const stats = await env.DB.prepare(`SELECT
     COUNT(*) AS orders,
     SUM(CASE WHEN status!='Cancelled' THEN total ELSE 0 END) AS revenue,
     SUM(CASE WHEN status IN ('New','Confirmed','Out for delivery') THEN 1 ELSE 0 END) AS open,
     SUM(CASE WHEN date(created_at)=date('now') THEN 1 ELSE 0 END) AS today
     FROM orders`).first();
  const low = await env.DB.prepare("SELECT COUNT(*) AS n FROM products WHERE hidden=0 AND stock<=3").first();
  return json({ orders: results.map(o => ({ ...o, items: JSON.parse(o.items) })), stats: { ...stats, low: low.n } });
}
export async function onRequestPatch({ request, env }) {
  let b; try { b = await request.json(); } catch { return bad("Invalid request"); }
  if (!STATUSES.includes(b.status)) return bad("Unknown status");
  const o = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(+b.id).first();
  if (!o) return bad("Order not found", 404);
  const stmts = [env.DB.prepare("UPDATE orders SET status = ? WHERE id = ?").bind(b.status, o.id)];
  // Cancelling puts the pieces back in stock once; reopening a cancelled order takes them out again.
  const items = JSON.parse(o.items);
  if (b.status === "Cancelled" && !o.restocked) {
    items.forEach(l => stmts.push(env.DB.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(l.qty, l.id)));
    stmts.push(env.DB.prepare("UPDATE orders SET restocked = 1 WHERE id = ?").bind(o.id));
  } else if (b.status !== "Cancelled" && o.restocked) {
    items.forEach(l => stmts.push(env.DB.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?").bind(l.qty, l.id)));
    stmts.push(env.DB.prepare("UPDATE orders SET restocked = 0 WHERE id = ?").bind(o.id));
  }
  await env.DB.batch(stmts);
  return json({ ok: true });
}
