import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { expireStaleOrders } from "@/lib/orders";
export const dynamic = "force-dynamic";
// Same as before, with one addition: each product now also lists its images, in the order set in the admin screen.
export async function GET() {
  await expireStaleOrders(prisma).catch(() => {});
  const rows = await prisma.product.findMany({ where: { active: true }, orderBy: { createdAt: "asc" }, include: { category: true, images: { orderBy: { position: "asc" } }, variants: { where: { active: true }, include: { inventory: true }, orderBy: { pricePaise: "asc" } } } });
  return NextResponse.json(rows.map((p) => ({ slug: p.slug, name: p.name, category: p.category.name, badge: p.badge, description: p.description, specs: p.specs,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt })),
    variants: p.variants.map((v) => ({ id: v.id, name: v.name, pricePaise: v.pricePaise, available: Math.max(0, (v.inventory?.onHand ?? 0) - (v.inventory?.reserved ?? 0)) })) })));
}
