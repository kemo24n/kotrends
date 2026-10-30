import { bad, checkSession } from "../../../lib/shared.js";
// Every /api/admin/* route needs a valid owner session, except login.
export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  if (url.pathname === "/api/admin/login") return ctx.next();
  try { if (!(await checkSession(ctx.request, ctx.env))) return bad("Please log in", 401); }
  catch (e) { return bad(e.message, 500); }
  return ctx.next();
}
