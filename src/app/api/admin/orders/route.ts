import { NextResponse } from "next/server";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { adminOnly } from "@/lib/http";
import { canRefund, needsRefund, nextStatus } from "@/lib/orderflow";
export const dynamic = "force-dynamic";
const STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];

export async function GET(req: Request) {
  const a = await adminOnly();
  if ("res" in a) return a.res;
  const sp = new URL(req.url).searchParams, status = sp.get("status") ?? "", q = (sp.get("q") ?? "").trim().slice(0, 100);
  const where: Prisma.OrderWhereInput = {};
  if (STATUSES.includes(status)) where.status = status as OrderStatus;
  if (q) where.OR = [{ number: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }];
  if (sp.get("refund") === "1") { where.status = "CANCELLED"; where.payments = { some: { status: "CAPTURED" } }; }
  const rows = await prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { items: true, payments: true } });
  return NextResponse.json({ orders: rows.map((o) => ({ id: o.id, number: o.number, createdAt: o.createdAt, email: o.email, phone: o.phone, shipTo: o.shipTo, status: o.status, totalPaise: o.totalPaise,
    items: o.items.map((i) => ({ name: i.name, qty: i.qty })), paymentStatus: o.payments[0]?.status ?? null, carrier: o.carrier, trackingNumber: o.trackingNumber, trackingUrl: o.trackingUrl, next: nextStatus(o.status), canRefund: canRefund(o), needsRefund: needsRefund(o) })) });
}
