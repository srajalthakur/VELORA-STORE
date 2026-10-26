// In-memory failure counter. Fine for one server; use a shared store (Redis/Upstash) when running several instances.
const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW = 15 * 60_000;
export const tooMany = (key: string, max = 5, now = Date.now()) => { const e = hits.get(key); return !!e && e.resetAt > now && e.count >= max; };
export function recordFailure(key: string, now = Date.now()) {
  const e = hits.get(key);
  if (!e || e.resetAt <= now) hits.set(key, { count: 1, resetAt: now + WINDOW }); else e.count++;
  if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
}
export const clearFailures = (key: string) => void hits.delete(key);
