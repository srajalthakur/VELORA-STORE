import { describe, expect, it } from "vitest";
import { priceCart, PricingError } from "./pricing";
const v = (id: string, pricePaise: number, stock = 5, active = true) => ({ id, name: id, pricePaise, stock, active });
const c = { code: "VELORA10", percentOff: 10, minSubtotalPaise: 0, active: true, expiresAt: null };
describe("priceCart", () => {
  it("uses server prices, merges duplicate lines, charges standard shipping", () => {
    const r = priceCart({ lines: [{ variantId: "a", qty: 1 }, { variantId: "a", qty: 1 }], variants: [v("a", 100_000)] });
    expect(r.items).toHaveLength(1); expect(r.subtotalPaise).toBe(200_000); expect(r.shippingPaise).toBe(150_000); expect(r.totalPaise).toBe(350_000);
  });
  it("treats GST as included in the price", () => {
    const r = priceCart({ lines: [{ variantId: "a", qty: 1 }], variants: [v("a", 118_000)] });
    expect(r.taxPaise).toBe(18_000); expect(r.totalPaise).toBe(118_000 + 150_000);
  });
  it("applies a valid coupon and ignores expired or inactive ones", () => {
    const l = [{ variantId: "a", qty: 1 }], vs = [v("a", 1_000_000)];
    expect(priceCart({ lines: l, variants: vs, coupon: c }).discountPaise).toBe(100_000);
    expect(priceCart({ lines: l, variants: vs, coupon: { ...c, expiresAt: new Date(0) } }).couponApplied).toBeNull();
    expect(priceCart({ lines: l, variants: vs, coupon: { ...c, active: false } }).discountPaise).toBe(0);
  });
  it("gives free standard shipping at the threshold, never for express", () => {
    const l = [{ variantId: "a", qty: 1 }], vs = [v("a", 5_000_000)];
    expect(priceCart({ lines: l, variants: vs }).shippingPaise).toBe(0);
    expect(priceCart({ lines: l, variants: vs, express: true }).shippingPaise).toBe(250_000);
  });
  it("rejects unknown, inactive, oversold and malformed lines", () => {
    const err = (lines: any[], vs = [v("a", 1000, 2)]) => { try { priceCart({ lines, variants: vs }); } catch (e) { return (e as PricingError).code; } };
    expect(err([{ variantId: "zz", qty: 1 }])).toBe("UNKNOWN_VARIANT");
    expect(err([{ variantId: "a", qty: 3 }])).toBe("INSUFFICIENT_STOCK");
    expect(err([{ variantId: "a", qty: 1 }], [v("a", 1000, 2, false)])).toBe("UNAVAILABLE");
    expect(err([{ variantId: "a", qty: 0 }])).toBe("BAD_QTY");
    expect(err([])).toBe("EMPTY");
  });
});
