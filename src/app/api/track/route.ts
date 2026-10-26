import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/clientip";
import { sameOrigin } from "@/lib/http";
import { recordFailure, tooMany } from "@/lib/ratelimit";
import { safeTrackingUrl, timeline } from "@/lib/tracking";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const Body = z.object({ number: z.string().trim().min(3).max(40), email: z.string().trim().toLowerCase().email().max(200) });
const NOT_FOUND = { error: "We could not find an order with those details. Check the order number and the email used at checkout." };

/** Order lookup for guests: the order number plus the email on the order. The reply holds status and parcel details only, never the address or phone.
 *  A wrong guess and an unknown order give the same reply, and failed guesses are limited per visitor and per order number. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Enter your order number and email" }, { status: 400 });
  const ipKey = `track-ip|${clientIp(req)}`, numKey = `track-num|${p.data.number.toUpperCase()}`;
  if (await tooMany(ipKey, 10) || await tooMany(numKey, 10)) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  const o = await prisma.order.findFirst({ where: { number: { equals: p.data.number, mode: "insensitive" } }, include: { items: true } });
  if (!o || o.email.trim().toLowerCase() !== p.data.email) { await recordFailure(ipKey); await recordFailure(numKey); return NextResponse.json(NOT_FOUND, { status: 404 }); }
  const t = timeline(o);
  return NextResponse.json({ order: { number: o.number, status: o.status, createdAt: o.createdAt, timeline: t, carrier: o.carrier, trackingNumber: o.trackingNumber, trackingUrl: safeTrackingUrl(o.trackingUrl), items: o.items.map((i) => ({ name: i.name, qty: i.qty })) } });
}
