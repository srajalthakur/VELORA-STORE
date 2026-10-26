import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AmountMismatchError, settle, UnknownOrderError } from "@/lib/orders";
import { fetchRazorpayPayment, verifyPaymentSignature } from "@/lib/razorpay";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const Body = z.object({ razorpay_order_id: z.string().min(1), razorpay_payment_id: z.string().min(1), razorpay_signature: z.string().min(1) });

/** Called by the browser after Razorpay Checkout. The browser's word is never enough: we check the signature AND ask Razorpay for the payment. */
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig } = p.data;
  const e = env();
  if (!verifyPaymentSignature(orderId, paymentId, sig, e.RAZORPAY_KEY_SECRET)) return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
  try {
    const rp = await fetchRazorpayPayment({ keyId: e.RAZORPAY_KEY_ID, keySecret: e.RAZORPAY_KEY_SECRET }, paymentId);
    if (rp.order_id !== orderId || rp.currency !== "INR") return NextResponse.json({ error: "Payment does not match this order" }, { status: 409 });
    if (rp.status === "captured") {
      const r = await prisma.$transaction((tx) => settle(tx, orderId, paymentId, rp.amount));
      if (r.needsRefund) {
        console.error("REFUND REQUIRED: payment received for an expired order", r.number, paymentId);
        return NextResponse.json({ status: "REFUND_REQUIRED", message: "We received your payment, but this item is no longer available. You will be refunded in full." }, { status: 409 });
      }
      return NextResponse.json({ status: "CONFIRMED", orderNumber: r.number });
    }
    if (rp.status === "authorized") return NextResponse.json({ status: "PENDING", message: "Payment authorised. Your order is confirmed once the payment is captured." }, { status: 202 });
    return NextResponse.json({ status: "FAILED" }, { status: 402 });
  } catch (err) {
    if (err instanceof UnknownOrderError) return NextResponse.json({ error: "Unknown order" }, { status: 404 });
    if (err instanceof AmountMismatchError) { console.error("amount mismatch:", err.message); return NextResponse.json({ error: "Payment amount does not match this order" }, { status: 409 }); }
    console.error("verify failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Could not verify payment. If you were charged, your order will be confirmed automatically." }, { status: 502 });
  }
}
