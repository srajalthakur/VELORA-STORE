import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { customerOnly } from "@/lib/customer";
import { sameOrigin } from "@/lib/http";
export const dynamic = "force-dynamic";
const MAX_SAVED = 200;
const Slugs = z.object({ slugs: z.array(z.string().trim().min(1).max(120)).min(1).max(100) });
const One = z.object({ slug: z.string().trim().min(1).max(120) });

/** The signed-in customer's saved products, as product slugs. Products that are no longer on sale are left out. */
export async function GET() {
  const a = await customerOnly();
  if ("res" in a) return a.res;
  const rows = await prisma.wishlistItem.findMany({ where: { userId: a.user.id, product: { active: true } }, include: { product: { select: { slug: true } } } });
  return NextResponse.json({ slugs: rows.map((r) => r.product.slug) });
}

/** Save products. Takes one or many slugs (the storefront sends everything saved in the browser when someone signs in). Saving twice is harmless. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = await customerOnly();
  if ("res" in a) return a.res;
  const raw = await req.json().catch(() => null);
  const p = Slugs.safeParse(raw && typeof raw === "object" && "slug" in raw ? { slugs: [(raw as { slug: unknown }).slug] } : raw);
  if (!p.success) return NextResponse.json({ error: "Nothing to save" }, { status: 422 });
  const userId = a.user.id;
  const products = await prisma.product.findMany({ where: { slug: { in: [...new Set(p.data.slugs)] }, active: true }, select: { id: true } });
  const have = await prisma.wishlistItem.count({ where: { userId } });
  if (have + products.length > MAX_SAVED) return NextResponse.json({ error: `You can save up to ${MAX_SAVED} items. Remove some first.` }, { status: 409 });
  await prisma.wishlistItem.createMany({ data: products.map((x) => ({ userId, productId: x.id })), skipDuplicates: true });
  return NextResponse.json({ ok: true, saved: products.length });
}

/** Remove one saved product. Removing something that is not saved is harmless. */
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = await customerOnly();
  if ("res" in a) return a.res;
  const p = One.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Nothing to remove" }, { status: 422 });
  await prisma.wishlistItem.deleteMany({ where: { userId: a.user.id, product: { slug: p.data.slug } } });
  return NextResponse.json({ ok: true });
}
