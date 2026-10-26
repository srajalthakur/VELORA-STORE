import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AddressBody } from "@/lib/addressinput";
import { customerOnly } from "@/lib/customer";
import { sameOrigin } from "@/lib/http";
export const dynamic = "force-dynamic";
const MAX_ADDRESSES = 10;

export async function GET() {
  const a = await customerOnly();
  if ("res" in a) return a.res;
  const rows = await prisma.address.findMany({ where: { userId: a.user.id }, orderBy: [{ isDefault: "desc" }, { id: "asc" }] });
  return NextResponse.json({ addresses: rows });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = await customerOnly();
  if ("res" in a) return a.res;
  const p = AddressBody.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Check the address" }, { status: 422 });
  const userId = a.user.id;
  const made = await prisma.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) return null;
    const makeDefault = p.data.isDefault || count === 0; // the first address is always the default
    if (makeDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.address.create({ data: { ...p.data, line2: p.data.line2 || null, isDefault: makeDefault, userId }, select: { id: true } });
  });
  if (!made) return NextResponse.json({ error: `You can save up to ${MAX_ADDRESSES} addresses. Remove one first.` }, { status: 409 });
  return NextResponse.json({ ok: true, id: made.id }, { status: 201 });
}
