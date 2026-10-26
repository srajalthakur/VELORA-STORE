/**
 * The visitor's address, for rate limits. X-Forwarded-For is a list that every proxy appends to, and anything before the proxies
 * you run is written by the visitor and can be faked. So we count back from the END of the list by the number of proxies you trust:
 *   TRUSTED_PROXY_HOPS=0 (default)  ignore the header; everyone shares one bucket (fine for local development)
 *   TRUSTED_PROXY_HOPS=1            one proxy in front (Vercel, Cloudflare Tunnel, a single Nginx)
 */
export function clientIp(req: Request): string {
  const hops = Math.max(0, Math.floor(Number(process.env.TRUSTED_PROXY_HOPS ?? "0")) || 0);
  if (hops === 0) return "local";
  const list = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list[list.length - hops] ?? "unknown";
}
