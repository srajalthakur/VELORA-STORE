import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { adminOnly, sameOrigin } from "@/lib/http";
import { TrackingInput } from "@/lib/tracking";
export const dynamic = "force-dynamic";

/** Correct the courier or tracking number of an order that has already shipped (for example after a typo). The customer is not emailed again. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = await adminOnly();
  if ("res" in a) return a.res;
  const t = TrackingInput.safeParse(await req.json().catch(() => null));
  if (!t.success) return NextResponse.json({ error: t.error.issues[0]?.message ?? "Check the tracking details" }, { status: 422 });
  const { id } = await params;
  const o = await prisma.order.findUnique({ where: { id }, select: { status: true, carrier: true, trackingNumber: true } });
  if (!o) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (o.status !== "SHIPPED" && o.status !== "DELIVERED") return NextResponse.json({ error: "Tracking can only be changed once an order has shipped" }, { status: 409 });
  await prisma.order.update({ where: { id }, data: { carrier: t.data.carrier, trackingNumber: t.data.trackingNumber, trackingUrl: t.data.trackingUrl ?? null } });
  await audit(a.user, "order.tracking", { type: "Order", id }, { from: { carrier: o.carrier, trackingNumber: o.trackingNumber }, to: { carrier: t.data.carrier, trackingNumber: t.data.trackingNumber } });
  return NextResponse.json({ ok: true });
}
