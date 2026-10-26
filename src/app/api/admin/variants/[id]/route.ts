import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminOnly, sameOrigin } from "@/lib/http";
import { MAX_PAISE, MAX_STOCK, MIN_PAISE } from "@/lib/money";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    pricePaise: z.number().int().min(MIN_PAISE, "Price is too low").max(MAX_PAISE, "Price is too high"),
    comparePaise: z.number().int().min(MIN_PAISE).max(MAX_PAISE).nullable(),
    onHand: z.number().int().min(0, "Stock cannot be negative").max(MAX_STOCK, "Stock is too high"),
    active: z.boolean(),
  })
  .refine((b) => b.comparePaise === null || b.comparePaise > b.pricePaise, { message: "Compare-at price must be higher than the price", path: ["comparePaise"] });

class HeldStock extends Error {
  constructor(public held: number) {
    super("held");
  }
}

/** Sets a variant's price, compare-at price, stock and on-sale flag together, so a half-saved row cannot happen. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = await adminOnly();
  if ("res" in a) return a.res;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Check the values and try again" }, { status: 422 });
  const { id } = await params;
  const { pricePaise, comparePaise, onHand, active } = p.data;
  const exists = await prisma.productVariant.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  try {
    await prisma.$transaction(async (tx) => {
      await tx.productVariant.update({ where: { id }, data: { pricePaise, comparePaise, active } });
      const inv = await tx.inventory.findUnique({ where: { variantId: id } });
      if (!inv) {
        await tx.inventory.create({ data: { variantId: id, onHand } });
        return;
      }
      // Stock may never drop below what open checkouts are holding. The check and the write are one statement, so a checkout starting meanwhile cannot slip between them.
      const r = await tx.inventory.updateMany({ where: { variantId: id, reserved: { lte: onHand } }, data: { onHand } });
      if (r.count !== 1) throw new HeldStock(inv.reserved);
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof HeldStock) {
      return NextResponse.json({ error: `${e.held} ${e.held === 1 ? "unit is" : "units are"} held in open checkouts, so stock cannot be set below ${e.held}. Nothing was saved.` }, { status: 409 });
    }
    console.error("update variant failed:", e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "Could not save the changes" }, { status: 500 });
  }
}
