import { describe, expect, it } from "vitest";
import { safeTrackingUrl, timeline, TrackingInput } from "./tracking";

const base = { createdAt: "2026-10-20T05:00:00.000Z" };
describe("timeline", () => {
  it("shows a shipped order with the dates that were recorded", () => {
    const t = timeline({ ...base, status: "SHIPPED", confirmedAt: "2026-10-20T05:05:00.000Z", processingAt: "2026-10-21T05:00:00.000Z", shippedAt: "2026-10-22T05:00:00.000Z" });
    expect(t.steps.map((s) => s.done)).toEqual([true, true, true, true, false]);
    expect(t.steps[3].at).toBe("2026-10-22T05:00:00.000Z");
    expect(t.terminal).toBeNull();
  });
  it("marks earlier steps done for older orders that have no dates", () => {
    const t = timeline({ ...base, status: "DELIVERED" });
    expect(t.steps.every((s) => s.done)).toBe(true);
    expect(t.steps[4].at).toBeNull();
  });
  it("waits for payment on a pending order", () => {
    const t = timeline({ ...base, status: "PENDING" });
    expect(t.awaitingPayment).toBe(true);
    expect(t.steps.map((s) => s.done)).toEqual([true, false, false, false, false]);
  });
  it("shows only what really happened for a cancelled order", () => {
    const t = timeline({ ...base, status: "CANCELLED" });
    expect(t.terminal).toBe("CANCELLED");
    expect(t.steps.map((s) => s.done)).toEqual([true, false, false, false, false]);
  });
  it("keeps recorded steps on a refunded order", () => {
    const t = timeline({ ...base, status: "REFUNDED", confirmedAt: "2026-10-20T05:05:00.000Z", shippedAt: "2026-10-22T05:00:00.000Z" });
    expect(t.terminal).toBe("REFUNDED");
    expect(t.steps.map((s) => s.done)).toEqual([true, true, false, true, false]);
  });
});

describe("tracking input", () => {
  it("accepts a courier and number, with the link optional", () => {
    expect(TrackingInput.safeParse({ carrier: "Delhivery", trackingNumber: "DL 1234-5678" }).success).toBe(true);
    const p = TrackingInput.parse({ carrier: "Blue Dart", trackingNumber: "ABC123", trackingUrl: "" });
    expect(p.trackingUrl).toBeUndefined();
  });
  it("rejects links that are not https", () => {
    expect(TrackingInput.safeParse({ carrier: "X Courier", trackingNumber: "ABC123", trackingUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(TrackingInput.safeParse({ carrier: "X Courier", trackingNumber: "ABC123", trackingUrl: "http://example.com/t" }).success).toBe(false);
    expect(TrackingInput.safeParse({ carrier: "X Courier", trackingNumber: "ABC123", trackingUrl: "https://example.com/t/ABC123" }).success).toBe(true);
  });
  it("rejects odd characters in the tracking number", () => {
    expect(TrackingInput.safeParse({ carrier: "X Courier", trackingNumber: "<script>" }).success).toBe(false);
  });
  it("only returns https links for display", () => {
    expect(safeTrackingUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeTrackingUrl("javascript:alert(1)")).toBeNull();
    expect(safeTrackingUrl(null)).toBeNull();
  });
});
