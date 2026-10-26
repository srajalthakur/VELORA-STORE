import { describe, expect, it } from "vitest";
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
  it("blocks after 5 failures, expires after the window, and resets on success", () => {
    const t = 1_000_000;
    for (let i = 0; i < 4; i++) recordFailure("k", t); expect(tooMany("k", 5, t)).toBe(false);
    recordFailure("k", t); expect(tooMany("k", 5, t)).toBe(true); expect(tooMany("other", 5, t)).toBe(false);
    expect(tooMany("k", 5, t + 16 * 60_000)).toBe(false);
    clearFailures("k"); expect(tooMany("k", 5, t)).toBe(false);
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
