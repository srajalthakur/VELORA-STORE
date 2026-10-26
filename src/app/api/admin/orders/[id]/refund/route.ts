import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { adminOnly, sameOrigin } from "@/lib/http";
import { canRefund } from "@/lib/orderflow";
import { markRefunded } from "@/lib/orders";
import { refundRazorpayPayment } from "@/lib/razorpay";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Full refund. Razorpay refunds start as "pending"; the order becomes REFUNDED when Razorpay confirms (webhook refund.processed) or at once if it answers "processed". */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = await adminOnly();
  if ("res" in a) return a.res;
  const { id } = await params;
  const o = await prisma.order.findUnique({ where: { id }, include: { payments: true } });
  if (!o) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const pay = o.payments.find((p) => p.status === "CAPTURED" && p.providerPaymentId);
  if (!pay || !pay.providerPaymentId || !canRefund(o)) return NextResponse.json({ error: "There is no captured payment to refund on this order" }, { status: 409 });
  const e = env(), paymentId = pay.providerPaymentId;
  try {
    const r = await refundRazorpayPayment({ keyId: e.RAZORPAY_KEY_ID, keySecret: e.RAZORPAY_KEY_SECRET }, paymentId, pay.amountPaise, `refund-${pay.id}`);
    if (r.status === "processed") await prisma.$transaction((tx) => markRefunded(tx, paymentId));
    console.log("refund requested:", o.number, r.status, "by", a.user.email);
    return NextResponse.json({ ok: true, refundId: r.id, status: r.status });
  } catch (err) {
    console.error("refund failed:", o.number, err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: err instanceof Error ? err.message : "Refund failed" }, { status: 502 });
  }
}
