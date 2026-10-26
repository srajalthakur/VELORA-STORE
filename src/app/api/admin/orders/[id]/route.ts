import { NextResponse } from "next/server";
import { z } from "zod";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { adminOnly, sameOrigin } from "@/lib/http";
import { canMove } from "@/lib/orderflow";
export const dynamic = "force-dynamic";
const Body = z.object({ status: z.enum(["PROCESSING", "SHIPPED", "DELIVERED"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = await adminOnly();
  if ("res" in a) return a.res;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid status" }, { status: 422 });
  const { id } = await params;
  const o = await prisma.order.findUnique({ where: { id }, select: { status: true } });
  if (!o) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!canMove(o.status, p.data.status)) return NextResponse.json({ error: `An order that is ${o.status.toLowerCase()} cannot be marked ${p.data.status.toLowerCase()}` }, { status: 409 });
  const r = await prisma.order.updateMany({ where: { id, status: o.status }, data: { status: p.data.status as OrderStatus } });
  if (r.count !== 1) return NextResponse.json({ error: "This order was just changed. Refresh and try again." }, { status: 409 });
  await audit(a.user, "order.status", { type: "Order", id }, { from: o.status, to: p.data.status });
  return NextResponse.json({ ok: true, status: p.data.status });
}
