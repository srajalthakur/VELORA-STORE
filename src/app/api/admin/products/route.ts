import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { dbCode, dbTarget } from "@/lib/dberror";
import { adminOnly, sameOrigin } from "@/lib/http";
import { MAX_PAISE, MAX_STOCK, MIN_PAISE } from "@/lib/money";
export const dynamic = "force-dynamic";

/** Every product, hidden ones included, with each variant's price and stock. */
export async function GET(req: Request) {
  const a = await adminOnly();
  if ("res" in a) return a.res;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  const where: Prisma.ProductWhereInput = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }, { variants: { some: { sku: { contains: q, mode: "insensitive" } } } }] }
    : {};
  const [rows, categories] = await Promise.all([
    prisma.product.findMany({ where, orderBy: { createdAt: "asc" }, take: 200, include: { category: true, images: { orderBy: { position: "asc" } }, variants: { include: { inventory: true }, orderBy: { pricePaise: "asc" } } } }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return NextResponse.json({
    categories,
    products: rows.map((p) => ({
      id: p.id, slug: p.slug, name: p.name, description: p.description, specs: p.specs, badge: p.badge, active: p.active, category: p.category.name,
      images: p.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, position: i.position })),
      variants: p.variants.map((v) => ({ id: v.id, sku: v.sku, name: v.name, pricePaise: v.pricePaise, comparePaise: v.comparePaise, active: v.active, onHand: v.inventory?.onHand ?? 0, reserved: v.inventory?.reserved ?? 0 })),
    })),
  });
}

const Body = z.object({
  name: z.string().trim().min(1, "Enter a product name").max(120),
  slug: z.string().trim().toLowerCase().max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "The web address can only use letters, numbers and single hyphens"),
  categoryId: z.string().min(1, "Choose a category"),
  description: z.string().trim().min(1, "Enter a description").max(4000),
  badge: z.string().trim().max(30).nullable(),
  specs: z.array(z.string().trim().min(1).max(200)).max(12),
  variantName: z.string().trim().min(1, "Enter a finish or variant name").max(80),
  sku: z.string().trim().regex(/^[A-Za-z0-9._-]{2,40}$/, "SKU must be 2 to 40 letters, numbers, dots, hyphens or underscores"),
  pricePaise: z.number().int().min(MIN_PAISE, "Price is too low").max(MAX_PAISE, "Price is too high"),
  onHand: z.number().int().min(0).max(MAX_STOCK),
  active: z.boolean(),
});

/** Adds a product with its first variant and opening stock. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = await adminOnly();
  if ("res" in a) return a.res;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Check the details and try again" }, { status: 422 });
  const d = p.data;
  try {
    const created = await prisma.product.create({
      data: {
        slug: d.slug, name: d.name, description: d.description, specs: d.specs, badge: d.badge || null, active: d.active, categoryId: d.categoryId,
        variants: { create: { sku: d.sku, name: d.variantName, pricePaise: d.pricePaise, inventory: { create: { onHand: d.onHand } } } },
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  } catch (e) {
    const code = dbCode(e);
    if (code === "P2002") {
      const t = dbTarget(e);
      return NextResponse.json({ error: t.includes("sku") ? "That SKU is already used by another variant" : "That web address is already used by another product" }, { status: 409 });
    }
    if (code === "P2003") return NextResponse.json({ error: "Choose a valid category" }, { status: 422 });
    console.error("create product failed:", e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "Could not add the product" }, { status: 500 });
  }
}
