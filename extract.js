// Ekstraksi URL gambar dari HTML mentah (tanpa dependency)
const EXT = "png|jpe?g|webp|gif|avif|bmp|svg";
const EXT_RE = new RegExp("\\.(?:" + EXT + ")(?:[?#].*)?$", "i");

function decode(s) {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/g, "/")
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/");
}

function attr(tag, name) {
  const m = tag.match(new RegExp("\\s" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i"));
  return m ? decode(m[1] ?? m[2] ?? m[3] ?? "") : "";
}

// ambil kandidat resolusi terbesar dari srcset
function bestFromSrcset(srcset) {
  let best = null;
  let bestScore = -1;
  for (const part of srcset.split(/,(?=\s*\S+\s+\d)|,\s+(?=https?:|\/)/)) {
    const [u, d] = part.trim().split(/\s+/);
    if (!u) continue;
    const score = d ? parseFloat(d) || 1 : 1;
    if (score >= bestScore) {
      best = u;
      bestScore = score;
    }
  }
  return best;
}

function sectionOf(pathname) {
  const dirs = pathname.split("/").filter(Boolean).slice(0, -1);
  for (let i = dirs.length - 1; i >= 0; i--) {
    if (!/^\d+$/.test(dirs[i]) && !/^date_\d+$/.test(dirs[i])) return decodeURIComponent(dirs[i]);
  }
  return "lainnya";
}

function extractImages(html, baseUrl) {
  const found = new Map();

  const add = (raw, source, alt = "") => {
    if (!raw || /^data:|^blob:|^javascript:/i.test(raw.trim())) return;
    let u;
    try {
      u = new URL(decode(raw.trim()), baseUrl);
    } catch {
      return;
    }
    if (!/^https?:$/.test(u.protocol)) return;
    if (!EXT_RE.test(u.pathname + u.search)) return;
    const href = u.href.split("#")[0];
    const prev = found.get(href);
    if (prev) {
      if (!prev.alt && alt) prev.alt = alt;
      return;
    }
    const file = decodeURIComponent(u.pathname.split("/").pop() || "image");
    const lower = u.pathname.toLowerCase();
    found.set(href, {
      url: href,
      file,
      ext: (file.match(/\.([a-z0-9]+)$/i) || [, ""])[1].toLowerCase(),
      alt,
      section: sectionOf(u.pathname),
      source,
      isIcon: /\.svg$/i.test(u.pathname) || /\/(icons?|logo|sprite|favicon|statics?)\//.test(lower),
    });
  };

  // 1) <img>
  for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
    const alt = attr(tag, "alt");
    for (const n of ["src", "data-src", "data-original", "data-lazy-src", "data-lazy", "data-img", "data-image"]) {
      add(attr(tag, n), "img", alt);
    }
    for (const n of ["srcset", "data-srcset"]) {
      const s = attr(tag, n);
      if (s) add(bestFromSrcset(s), "img-srcset", alt);
    }
  }

  // 2) <source> di <picture>
  for (const tag of html.match(/<source\b[^>]*>/gi) || []) {
    const s = attr(tag, "srcset") || attr(tag, "data-srcset");
    if (s) add(bestFromSrcset(s), "picture");
  }

  // 3) meta og:image / twitter:image / link image
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const key = attr(tag, "property") || attr(tag, "name");
    if (/^(og:image(:url)?|twitter:image(:src)?)$/i.test(key)) add(attr(tag, "content"), "meta");
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if (/image_src|preload/i.test(attr(tag, "rel")) && /image/i.test(attr(tag, "as") || "image")) add(attr(tag, "href"), "link");
  }

  // 4) CSS background-image / url(...)
  const cssRe = /url\(\s*['"]?([^'")]+?)['"]?\s*\)/gi;
  let m;
  while ((m = cssRe.exec(html))) add(m[1], "css");

  // 5) URL gambar di dalam script/JSON (gambar yang dimuat lewat JS)
  const decoded = decode(html);
  const absRe = new RegExp("https?:\\/\\/[^\\s\"'<>\\\\)]+?\\.(?:" + EXT + ")(?:\\?[^\\s\"'<>\\\\)]*)?", "gi");
  while ((m = absRe.exec(decoded))) add(m[0], "script");
  const relRe = new RegExp("[\"'(]((?:\\/|\\.\\.?\\/)[^\"'()\\s<>]+?\\.(?:" + EXT + ")(?:\\?[^\"'()\\s<>]*)?)[\"')]", "gi");
  while ((m = relRe.exec(decoded))) add(m[1], "script");

  return [...found.values()];
}

module.exports = { extractImages };
