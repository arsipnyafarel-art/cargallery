// Helper keamanan: cegah server dipakai untuk mengakses jaringan internal (SSRF)
const dns = require("dns").promises;
const net = require("net");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("::ffff:");
  }
  return true;
}

async function assertPublicUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Link tidak valid");
  }
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Hanya link http/https");
  if (process.env.ALLOW_PRIVATE === "1") return u; // khusus testing lokal
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local")) throw new Error("Alamat tidak diizinkan");
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("Alamat tidak diizinkan");
  return u;
}

// fetch dengan validasi di setiap redirect, timeout, dan batas ukuran
async function safeFetch(raw, { headers = {}, maxBytes = 8 * 1024 * 1024, timeout = 15000 } = {}) {
  let url = raw;
  for (let hop = 0; hop < 4; hop++) {
    const u = await assertPublicUrl(url);
    const res = await fetch(u.href, {
      headers: { "user-agent": UA, "accept-language": "id,en;q=0.8", ...headers },
      redirect: "manual",
      signal: AbortSignal.timeout(timeout),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location"), u).href;
      continue;
    }
    const len = Number(res.headers.get("content-length") || 0);
    if (len > maxBytes) throw Object.assign(new Error("File terlalu besar"), { code: 413 });
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw Object.assign(new Error("File terlalu besar"), { code: 413 });
    return { res, buf, finalUrl: u.href };
  }
  throw new Error("Terlalu banyak redirect");
}

module.exports = { assertPublicUrl, safeFetch, UA };
