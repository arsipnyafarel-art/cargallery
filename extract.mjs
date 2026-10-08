import safe from "../../lib/safe.js";
import ex from "../../lib/extract.js";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async (req) => {
  const target = new URL(req.url).searchParams.get("url") || "";
  if (!target) return json({ error: "Parameter url wajib diisi" }, 400);
  try {
    const { res: r, buf, finalUrl } = await safe.safeFetch(target, {
      headers: { accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
      maxBytes: 8 * 1024 * 1024,
    });
    if (!r.ok) return json({ error: "Situs membalas status " + r.status }, 502);
    const html = buf.toString("utf8");
    const images = ex.extractImages(html, finalUrl);
    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [, ""])[1].trim();
    return json({ page: finalUrl, title, count: images.length, images });
  } catch (e) {
    return json({ error: e.message || "Gagal mengambil halaman" }, e.code === 413 ? 413 : 502);
  }
};

export const config = { path: "/api/extract" };
