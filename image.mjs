import safe from "../../lib/safe.js";

const json = (body, status) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async (req) => {
  const q = new URL(req.url).searchParams;
  const url = q.get("url");
  if (!url) return json({ error: "Parameter url wajib diisi" }, 400);
  try {
    const headers = { accept: "image/avif,image/webp,image/*,*/*;q=0.8" };
    if (q.get("ref")) headers.referer = q.get("ref");
    const { res: r, buf } = await safe.safeFetch(url, { headers, maxBytes: 5 * 1024 * 1024 });
    if (!r.ok) return json({ error: "Server gambar membalas status " + r.status }, 502);
    const type = r.headers.get("content-type") || "application/octet-stream";
    if (!/^image\//i.test(type)) return json({ error: "Bukan file gambar" }, 415);
    const file = String(q.get("name") || new URL(url).pathname.split("/").pop() || "image").replace(/[^\w.\-]+/g, "_");
    const h = { "content-type": type, "cache-control": "public, max-age=3600" };
    if (q.get("dl")) h["content-disposition"] = `attachment; filename="${file}"`;
    return new Response(buf, { status: 200, headers: h });
  } catch (e) {
    return json({ error: e.message || "Gagal mengambil gambar" }, e.code === 413 ? 413 : 502);
  }
};

export const config = { path: "/api/image" };
