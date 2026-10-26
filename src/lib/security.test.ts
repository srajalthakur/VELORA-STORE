import { afterEach, describe, expect, it, vi } from "vitest";
import { canMove, canRefund, needsRefund, nextStatus } from "./orderflow";
import { clearFailures, recordFailure, tooMany } from "./ratelimit";
import { hashToken, newToken } from "./token";
describe("session tokens", () => {
  it("are random, and only a one-way hash would be stored", () => {
    const a = newToken(), b = newToken();
    expect(a).not.toBe(b); expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(a)).toBe(hashToken(a)); expect(hashToken(a)).not.toBe(a); expect(hashToken(a)).not.toBe(hashToken(b));
  });
});
describe("login rate limit", () => {
  it("blocks after 5 failures, expires after the window, and resets on success", async () => {
    const t = 1_000_000;
    for (let i = 0; i < 4; i++) await recordFailure("k", t); expect(await tooMany("k", 5, t)).toBe(false);
    await recordFailure("k", t); expect(await tooMany("k", 5, t)).toBe(true); expect(await tooMany("other", 5, t)).toBe(false);
    expect(await tooMany("k", 5, t + 16 * 60_000)).toBe(false);
    await clearFailures("k"); expect(await tooMany("k", 5, t)).toBe(false);
  });
});
describe("shared rate limit store", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("counts in Redis, sends only a hashed key, and starts the window once", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io/"); vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    const sent: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => { const cmds = JSON.parse(init.body); sent.push({ url, auth: init.headers.Authorization, cmds }); return new Response(JSON.stringify(cmds.map((c: string[]) => ({ result: c[0] === "GET" ? "5" : 1 })))); }));
    await recordFailure("login|me@example.com");
    expect(sent[0].url).toBe("https://example.upstash.io/pipeline"); expect(sent[0].auth).toBe("Bearer tok");
    expect(sent[0].cmds.map((c: string[]) => c[0])).toEqual(["INCR", "EXPIRE"]); expect(sent[0].cmds[1].slice(2)).toEqual([900, "NX"]);
    expect(JSON.stringify(sent[0].cmds)).not.toContain("me@example.com");
    expect(await tooMany("login|me@example.com", 5)).toBe(true); expect(await tooMany("login|me@example.com", 6)).toBe(false);
  });
  it("falls back to memory when Redis is down, instead of failing", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io"); vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const t = 5_000_000;
    for (let i = 0; i < 3; i++) await recordFailure("fallback-key", t);
    expect(await tooMany("fallback-key", 3, t)).toBe(true); expect(await tooMany("fallback-key", 4, t)).toBe(false);
    quiet.mockRestore();
  });
});
describe("order workflow", () => {
  it("only moves forward one step at a time", () => {
    expect(nextStatus("CONFIRMED")).toBe("PROCESSING"); expect(nextStatus("DELIVERED")).toBeNull(); expect(nextStatus("PENDING")).toBeNull();
    expect(canMove("CONFIRMED", "PROCESSING")).toBe(true); expect(canMove("CONFIRMED", "DELIVERED")).toBe(false);
    expect(canMove("PENDING", "SHIPPED")).toBe(false); expect(canMove("DELIVERED", "PROCESSING")).toBe(false);
  });
  it("allows refunds only for captured payments, and flags paid-but-cancelled orders", () => {
    const paid = { status: "CONFIRMED", payments: [{ status: "CAPTURED" }] };
    expect(canRefund(paid)).toBe(true); expect(canRefund({ status: "CONFIRMED", payments: [{ status: "CREATED" }] })).toBe(false);
    expect(canRefund({ status: "REFUNDED", payments: [{ status: "REFUNDED" }] })).toBe(false); expect(canRefund({ status: "PENDING", payments: [{ status: "CAPTURED" }] })).toBe(false);
    expect(needsRefund({ status: "CANCELLED", payments: [{ status: "CAPTURED" }] })).toBe(true); expect(needsRefund(paid)).toBe(false);
  });
});
