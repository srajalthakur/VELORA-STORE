import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { expireStaleOrders, releaseOrder, reserve, StockError } from "@/lib/orders";
import { priceCart, PricingError } from "@/lib/pricing";
import { createRazorpayOrder } from "@/lib/razorpay";
import { currentUser } from "@/lib/session";
import { Details, savedToDetails } from "@/lib/shipto";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The delivery fields are optional here because a signed-in customer may send addressId instead. They are checked in full below.
const Body = z.object({
  email: z.string().trim().email().max(200),
  express: z.boolean().default(false),
  coupon: z.string().trim().max(32).optional(),
  lines: z.array(z.object({ variantId: z.string().min(1), qty: z.number().int().min(1).max(20) })).min(1).max(30),
  addressId: z.string().min(1).max(60).optional(),
}).extend(Details.partial().shape);
const isUnique = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

export async function POST(req: Request) {
  const key = req.headers.get("idempotency-key");
  if (!key || key.length < 16 || key.length > 100) return NextResponse.json({ error: "Send an Idempotency-Key header (16-100 characters), one per checkout attempt." }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid details", issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  // A signed-in customer's order is linked to their account. Guests can still check out; their order has no account.
  const user = await currentUser().catch(() => null);

  let typed: unknown = { name: b.name, phone: b.phone, addr: b.addr, city: b.city, state: b.state, pin: b.pin };
  if (b.addressId) {
    if (!user) return NextResponse.json({ error: "Sign in to use a saved address" }, { status: 401 });
    // The lookup includes the signed-in user's id, so another customer's address id finds nothing.
    const saved = await prisma.address.findFirst({ where: { id: b.addressId, userId: user.id } });
    if (!saved) return NextResponse.json({ error: "That saved address was not found" }, { status: 422 });
    typed = savedToDetails(saved);
  }
  const details = Details.safeParse(typed);
  if (!details.success) {
    if (b.addressId) return NextResponse.json({ error: "That saved address is incomplete. Edit it in your account, or type the address instead." }, { status: 422 });
    return NextResponse.json({ error: "Invalid details", issues: details.error.flatten().fieldErrors }, { status: 422 });
  }
  const d = details.data;

  let freshOrderId: string | null = null;
  try {
    const include = { payments: true } as const;
    let order = await prisma.order.findUnique({ where: { idempotencyKey: key }, include });
    if (!order) {
      await expireStaleOrders(prisma).catch(() => {});
      const variants = await prisma.productVariant.findMany({ where: { id: { in: b.lines.map((l) => l.variantId) } }, include: { inventory: true, product: { select: { name: true, active: true } } } });
      const coupon = b.coupon ? await prisma.coupon.findUnique({ where: { code: b.coupon.toUpperCase() } }) : null;
      const priced = priceCart({
        lines: b.lines, express: b.express, coupon,
        variants: variants.map((v) => ({ id: v.id, name: `${v.product.name} (${v.name})`, pricePaise: v.pricePaise, stock: Math.max(0, (v.inventory?.onHand ?? 0) - (v.inventory?.reserved ?? 0)), active: v.active && v.product.active })),
      });
      try {
        order = await prisma.$transaction(async (tx) => {
          await reserve(tx, priced.items);
          return tx.order.create({
            data: {
              number: `VEL-${randomBytes(4).toString("hex").toUpperCase()}`, idempotencyKey: key, userId: user?.id ?? null, email: b.email, phone: d.phone,
              shipTo: { name: d.name, phone: d.phone, addr: d.addr, city: d.city, state: d.state, pin: d.pin, country: "IN" },
              subtotalPaise: priced.subtotalPaise, discountPaise: priced.discountPaise, shippingPaise: priced.shippingPaise, taxPaise: priced.taxPaise, totalPaise: priced.totalPaise, couponCode: priced.couponApplied,
              items: { create: priced.items.map((i) => ({ variantId: i.variantId, name: i.name, unitPaise: i.unitPaise, qty: i.qty })) },
            },
            include,
          });
        });
        freshOrderId = order.id;
      } catch (e) {
        if (!isUnique(e)) throw e;
        order = await prisma.order.findUnique({ where: { idempotencyKey: key }, include });
        if (!order) throw e;
      }
    }
    if (order.status !== "PENDING") return NextResponse.json({ error: "This checkout was already completed or cancelled. Please start a new one." }, { status: 409 });
    const e = env();
    let providerOrderId = order.payments[0]?.providerOrderId;
    if (!providerOrderId) {
      const rz = await createRazorpayOrder({ keyId: e.RAZORPAY_KEY_ID, keySecret: e.RAZORPAY_KEY_SECRET }, order.totalPaise, order.number);
      await prisma.payment.create({ data: { orderId: order.id, providerOrderId: rz.id, amountPaise: order.totalPaise } });
      providerOrderId = rz.id;
    }
    return NextResponse.json({ orderNumber: order.number, providerOrderId, amountPaise: order.totalPaise, currency: "INR", keyId: e.RAZORPAY_KEY_ID }, { status: 201 });
  } catch (err) {
    if (freshOrderId) await prisma.$transaction((tx) => releaseOrder(tx, freshOrderId!)).catch(() => {});
    if (err instanceof PricingError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "INSUFFICIENT_STOCK" || err.code === "UNAVAILABLE" ? 409 : 422 });
    if (err instanceof StockError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error("checkout failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "We couldn't start your payment. Please try again." }, { status: 500 });
  }
}
