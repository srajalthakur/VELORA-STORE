import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { dbCode } from "@/lib/dberror";
import { adminOnly, sameOrigin } from "@/lib/http";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    active: z.boolean().optional(),
    name: z.string().trim().min(1, "Enter a product name").max(120).optional(),
    description: z.string().trim().min(1, "Enter a description").max(4000).optional(),
    badge: z.string().trim().max(30).nullable().optional(),
    specs: z.array(z.string().trim().min(1).max(200)).max(12).optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), { message: "Nothing to change" });

/** Hide or show a product, or edit its name, description and badge. Hidden products disappear from the storefront but keep their orders. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = await adminOnly();
  if ("res" in a) return a.res;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Invalid change" }, { status: 422 });
  const { id } = await params;
  try {
    const { specs, ...rest } = p.data;
    await prisma.product.update({
      where: { id },
      data: { ...rest, badge: rest.badge === undefined ? undefined : rest.badge || null, ...(specs ? { specs: { set: specs } } : {}) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (dbCode(e) === "P2025") return NextResponse.json({ error: "Product not found" }, { status: 404 });
    console.error("update product failed:", e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "Could not save the product" }, { status: 500 });
  }
}
