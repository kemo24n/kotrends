import { json, bad, samePassword, makeSession, cookie } from "../../../lib/shared.js";
const WINDOW = 15 * 60 * 1000, MAX = 8;
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return bad("Invalid request"); }
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const since = Date.now() - WINDOW;
  try {
    const r = await env.DB.prepare("SELECT COUNT(*) n FROM login_fails WHERE ip=? AND at>?").bind(ip, since).first();
    if ((r?.n || 0) >= MAX) return bad("Too many wrong tries. Wait 15 minutes and try again.", 429);
    if (!(await samePassword(env, b.password))) {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO login_fails (ip, at) VALUES (?, ?)").bind(ip, Date.now()),
        env.DB.prepare("DELETE FROM login_fails WHERE at<?").bind(since),
      ]);
      await new Promise(res => setTimeout(res, 600));
      return bad("Wrong password", 401);
    }
    await env.DB.prepare("DELETE FROM login_fails WHERE ip=?").bind(ip).run();
    return json({ ok: true }, 200, { "set-cookie": cookie(await makeSession(env), 30 * 86400) });
  } catch (e) { return bad(e.message, 500); }
}
export async function onRequestDelete() {
  return json({ ok: true }, 200, { "set-cookie": cookie("", 0) });
}
