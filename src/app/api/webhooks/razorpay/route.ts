import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AmountMismatchError, markRefunded, settle, UnknownOrderError } from "@/lib/orders";
import { verifyWebhookSignature } from "@/lib/razorpay";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text(); // the exact bytes Razorpay signed
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  const eventId = req.headers.get("x-razorpay-event-id");
  if (!sig || !verifyWebhookSignature(raw, sig, env().RAZORPAY_WEBHOOK_SECRET)) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  if (!eventId) return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  let ev: any;
  try { ev = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const duplicate = await prisma.$transaction(async (tx) => {
      // Recording the event id and handling the event are one transaction. A repeat delivery inserts nothing (count 0) and is skipped,
      // and any other database error is a real failure, not a "duplicate".
      const seen = await tx.webhookEvent.createMany({ data: [{ id: eventId, type: String(ev.event) }], skipDuplicates: true });
      if (seen.count === 0) return true;
      const pay = ev.payload?.payment?.entity;
      try {
        if ((ev.event === "payment.captured" || ev.event === "order.paid") && pay?.order_id && pay?.id) {
          const r = await settle(tx, pay.order_id, pay.id, pay.amount);
          if (r.needsRefund) console.error("REFUND REQUIRED: payment received for an expired order", r.number, pay.id);
        } else if (ev.event === "refund.processed" && ev.payload?.refund?.entity?.payment_id) await markRefunded(tx, ev.payload.refund.entity.payment_id);
        // payment.failed is intentionally ignored: Razorpay lets the customer retry on the same order.
      } catch (e) {
        if (e instanceof UnknownOrderError || e instanceof AmountMismatchError) console.error("webhook ignored:", e.message);
        else throw e;
      }
      return false;
    });
    return NextResponse.json(duplicate ? { ok: true, duplicate: true } : { ok: true });
  } catch (e) {
    console.error("webhook failed:", e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "Processing failed" }, { status: 500 }); // Razorpay will retry
  }
}
