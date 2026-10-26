import { NextResponse } from "next/server";
import { z } from "zod";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { adminOnly, sameOrigin } from "@/lib/http";
import { sendMail, appUrl } from "@/lib/mail";
import { canMove } from "@/lib/orderflow";
import { TrackingInput } from "@/lib/tracking";
export const dynamic = "force-dynamic";
// Marking an order shipped also needs the courier and tracking number, so the customer can follow the parcel.
const Body = z.object({ status: z.enum(["PROCESSING", "SHIPPED", "DELIVERED"]), carrier: z.string().optional(), trackingNumber: z.string().optional(), trackingUrl: z.string().optional() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = await adminOnly();
  if ("res" in a) return a.res;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid status" }, { status: 422 });
  const { id } = await params;
  const o = await prisma.order.findUnique({ where: { id }, select: { status: true, number: true, email: true } });
  if (!o) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!canMove(o.status, p.data.status)) return NextResponse.json({ error: `An order that is ${o.status.toLowerCase()} cannot be marked ${p.data.status.toLowerCase()}` }, { status: 409 });

  const now = new Date();
  const data: Prisma.OrderUpdateManyMutationInput = { status: p.data.status as OrderStatus };
  let track: TrackingInput | null = null;
  if (p.data.status === "PROCESSING") data.processingAt = now;
  if (p.data.status === "DELIVERED") data.deliveredAt = now;
  if (p.data.status === "SHIPPED") {
    const t = TrackingInput.safeParse({ carrier: p.data.carrier ?? "", trackingNumber: p.data.trackingNumber ?? "", trackingUrl: p.data.trackingUrl });
    if (!t.success) return NextResponse.json({ error: t.error.issues[0]?.message ?? "Enter the courier and tracking number" }, { status: 422 });
    track = t.data;
    data.shippedAt = now; data.carrier = t.data.carrier; data.trackingNumber = t.data.trackingNumber; data.trackingUrl = t.data.trackingUrl ?? null;
  }
  const r = await prisma.order.updateMany({ where: { id, status: o.status }, data });
  if (r.count !== 1) return NextResponse.json({ error: "This order was just changed. Refresh and try again." }, { status: 409 });
  await audit(a.user, "order.status", { type: "Order", id }, { from: o.status, to: p.data.status, ...(track ? { carrier: track.carrier, trackingNumber: track.trackingNumber } : {}) });

  // Tell the customer. A failed email never undoes the shipment; the admin is told so they can follow up.
  let emailed = true;
  if (track && o.email) {
    const lines = [`Good news: your VELORA order ${o.number} has shipped.`, "", `Courier: ${track.carrier}`, `Tracking number: ${track.trackingNumber}`];
    if (track.trackingUrl) lines.push(`Track your parcel: ${track.trackingUrl}`);
    lines.push("", `You can also check the status any time: ${appUrl()}/track`);
    emailed = await sendMail(o.email, `Your VELORA order ${o.number} has shipped`, lines.join("\n")).then(() => true, (e) => { console.error("shipped email failed:", o.number, e instanceof Error ? e.message : "unknown error"); return false; });
  }
  return NextResponse.json({ ok: true, status: p.data.status, emailed });
}
