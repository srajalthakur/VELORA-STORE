export class PricingError extends Error {
  constructor(public code: "EMPTY" | "BAD_QTY" | "UNKNOWN_VARIANT" | "UNAVAILABLE" | "INSUFFICIENT_STOCK", msg: string) { super(msg); }
}
export type Variant = { id: string; name: string; pricePaise: number; stock: number; active: boolean };
export type CouponT = { code: string; percentOff: number; minSubtotalPaise: number; active: boolean; expiresAt: Date | null } | null;
export const FREE_SHIPPING_PAISE = 5_000_000, STANDARD_SHIPPING_PAISE = 150_000, EXPRESS_SHIPPING_PAISE = 250_000, GST_PERCENT = 18;

/** Prices come only from `variants` (loaded from the database), never from the client. Money is integer paise; prices include GST. */
export function priceCart(i: { lines: { variantId: string; qty: number }[]; variants: Variant[]; coupon?: CouponT; express?: boolean; now?: Date }) {
  if (!i.lines.length) throw new PricingError("EMPTY", "Your bag is empty");
  const merged = new Map<string, number>();
  for (const l of i.lines) {
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > 20) throw new PricingError("BAD_QTY", "Invalid quantity");
    merged.set(l.variantId, (merged.get(l.variantId) ?? 0) + l.qty);
  }
  const items = [...merged].map(([id, qty]) => {
    const v = i.variants.find((x) => x.id === id);
    if (!v) throw new PricingError("UNKNOWN_VARIANT", "A product in your bag no longer exists");
    if (!v.active) throw new PricingError("UNAVAILABLE", `${v.name} is no longer available`);
    if (qty > v.stock) throw new PricingError("INSUFFICIENT_STOCK", `Only ${v.stock} of ${v.name} remaining`);
    return { variantId: id, name: v.name, unitPaise: v.pricePaise, qty, lineTotalPaise: v.pricePaise * qty };
  });
  const subtotalPaise = items.reduce((s, x) => s + x.lineTotalPaise, 0);
  const c = i.coupon, now = i.now ?? new Date();
  const ok = !!c && c.active && (!c.expiresAt || c.expiresAt > now) && subtotalPaise >= c.minSubtotalPaise;
  const discountPaise = ok ? Math.round((subtotalPaise * c!.percentOff) / 100) : 0;
  const net = subtotalPaise - discountPaise;
  const shippingPaise = i.express ? EXPRESS_SHIPPING_PAISE : net >= FREE_SHIPPING_PAISE ? 0 : STANDARD_SHIPPING_PAISE;
  const taxPaise = Math.round((net * GST_PERCENT) / (100 + GST_PERCENT));
  return { items, subtotalPaise, discountPaise, shippingPaise, taxPaise, totalPaise: net + shippingPaise, couponApplied: ok ? c!.code : null };
}
