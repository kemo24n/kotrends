import { json, rowToProduct } from "../../lib/shared.js";
// Public catalogue: visible products only.
export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare("SELECT * FROM products WHERE hidden = 0 ORDER BY feat DESC, added DESC").all();
  return json(results.map(rowToProduct), 200, { "cache-control": "public, max-age=30" });
}
