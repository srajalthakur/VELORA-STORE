import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AddressBody } from "@/lib/addressinput";
import { customerOnly } from "@/lib/customer";
import { sameOrigin } from "@/lib/http";
export const dynamic = "force-dynamic";

/** Every query below includes the signed-in user's id, so one customer can never read or change another's address. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = await customerOnly();
  if ("res" in a) return a.res;
  const p = AddressBody.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Check the address" }, { status: 422 });
  const { id } = await params;
  const userId = a.user.id;
  const ok = await prisma.$transaction(async (tx) => {
    const cur = await tx.address.findFirst({ where: { id, userId }, select: { isDefault: true } });
    if (!cur) return false;
    const makeDefault = p.data.isDefault || cur.isDefault; // the default can only be changed by choosing another one
    if (makeDefault) await tx.address.updateMany({ where: { userId, NOT: { id } }, data: { isDefault: false } });
    await tx.address.updateMany({ where: { id, userId }, data: { ...p.data, line2: p.data.line2 || null, isDefault: makeDefault } });
    return true;
  });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Address not found" }, { status: 404 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = await customerOnly();
  if ("res" in a) return a.res;
  const { id } = await params;
  const userId = a.user.id;
  const ok = await prisma.$transaction(async (tx) => {
    const cur = await tx.address.findFirst({ where: { id, userId }, select: { isDefault: true } });
    if (!cur) return false;
    await tx.address.deleteMany({ where: { id, userId } });
    if (cur.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { id: "desc" }, select: { id: true } });
      if (next) await tx.address.updateMany({ where: { id: next.id, userId }, data: { isDefault: true } });
    }
    return true;
  });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Address not found" }, { status: 404 });
}
