import { json, bad } from "../../../lib/shared.js";
const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
// Owner uploads a product photo; it is stored in R2 and served from /media/<key>.
export async function onRequestPost({ request, env }) {
  const form = await request.formData().catch(() => null);
  const file = form && form.get("file");
  if (!file || typeof file === "string") return bad("No photo received");
  const ext = TYPES[file.type]; if (!ext) return bad("Use a JPG, PNG or WEBP photo");
  if (file.size > 6 * 1024 * 1024) return bad("Photo is bigger than 6 MB");
  const key = `p/${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" } });
  return json({ url: `/media/${key}` }, 201);
}
