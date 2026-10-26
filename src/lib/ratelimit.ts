import { createHash } from "node:crypto";
/**
 * Failure counters for rate limits.
 * With UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN set, counts live in Redis, so they survive restarts and are shared by every server.
 * Without them, counts live in this server's memory (fine for local development, not for production with more than one instance).
 * If Redis cannot be reached, the call falls back to memory and logs it, so a Redis outage never locks customers out or takes the site down.
 */
const WINDOW = 15 * 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

const conf = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/+$/, ""), token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token ? { url, token } : null;
};
// Keys contain emails and addresses, so only a hash of each key is sent to Redis.
const rkey = (k: string) => "rl:" + createHash("sha256").update(k).digest("hex").slice(0, 32);

let warned = false;
async function redis(cmds: (string | number)[][]): Promise<unknown[] | null> {
  const c = conf();
  if (!c) {
    if (process.env.NODE_ENV === "production" && !warned) { warned = true; console.warn("Rate limits are using server memory. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to share them across servers."); }
    return null;
  }
  try {
    const r = await fetch(`${c.url}/pipeline`, { method: "POST", headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" }, body: JSON.stringify(cmds), signal: AbortSignal.timeout(2000) });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const out = (await r.json()) as { result?: unknown; error?: string }[];
    const bad = out.find((x) => x.error);
    if (bad) throw new Error(bad.error);
    return out.map((x) => x.result);
  } catch (e) {
    console.error("rate limit store unavailable, using memory:", e instanceof Error ? e.message : "unknown error");
    return null;
  }
}

export async function tooMany(key: string, max = 5, now = Date.now()): Promise<boolean> {
  const r = await redis([["GET", rkey(key)]]);
  if (r) return Number(r[0] ?? 0) >= max;
  const e = hits.get(key);
  return !!e && e.resetAt > now && e.count >= max;
}
export async function recordFailure(key: string, now = Date.now()): Promise<void> {
  // INCR, then start the 15-minute window only when the counter is new (EXPIRE ... NX), so repeated failures do not extend it.
  if (await redis([["INCR", rkey(key)], ["EXPIRE", rkey(key), WINDOW / 1000, "NX"]])) return;
  const e = hits.get(key);
  if (!e || e.resetAt <= now) hits.set(key, { count: 1, resetAt: now + WINDOW }); else e.count++;
  if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
}
export async function clearFailures(key: string): Promise<void> {
  hits.delete(key);
  await redis([["DEL", rkey(key)]]);
}
