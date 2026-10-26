import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { dbCode } from "@/lib/dberror";
import { adminOnly, sameOrigin } from "@/lib/http";
import { MAX_PAISE, MAX_STOCK, MIN_PAISE } from "@/lib/money";
export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().trim().min(1, "Enter a finish or variant name").max(80),
  sku: z.string().trim().regex(/^[A-Za-z0-9._-]{2,40}$/, "SKU must be 2 to 40 letters, numbers, dots, hyphens or underscores"),
  pricePaise: z.number().int().min(MIN_PAISE, "Price is too low").max(MAX_PAISE, "Price is too high"),
  onHand: z.number().int().min(0, "Stock cannot be negative").max(MAX_STOCK, "Stock is too high"),
  active: z.boolean(),
});

/** Adds another finish (variant) to an existing product, with its opening stock. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = await adminOnly();
  if ("res" in a) return a.res;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Check the details and try again" }, { status: 422 });
  const { id } = await params;
  const d = p.data;
  try {
    const v = await prisma.productVariant.create({
      data: { productId: id, sku: d.sku, name: d.name, pricePaise: d.pricePaise, active: d.active, inventory: { create: { onHand: d.onHand } } },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: v.id }, { status: 201 });
  } catch (e) {
    const code = dbCode(e);
    if (code === "P2002") return NextResponse.json({ error: "That SKU is already used by another variant" }, { status: 409 });
    if (code === "P2003") return NextResponse.json({ error: "Product not found" }, { status: 404 });
    console.error("add variant failed:", e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "Could not add the finish" }, { status: 500 });
  }
}
