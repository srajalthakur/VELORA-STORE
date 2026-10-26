import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { dbCode } from "@/lib/dberror";
import { adminOnly, sameOrigin } from "@/lib/http";
import { isSafeImageUrl } from "@/lib/imageurl";
export const dynamic = "force-dynamic";

const MAX_IMAGES = 12;
const AddBody = z.object({
  url: z.string().trim().refine(isSafeImageUrl, "Use a full https:// address, or a path like /images/tote.jpg"),
  alt: z.string().trim().min(1, "Describe the image in a few words").max(200),
});

/** Attaches an image (by address) to the end of a product's image list. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = await adminOnly();
  if ("res" in a) return a.res;
  const p = AddBody.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Check the image details" }, { status: 422 });
  const { id } = await params;
  if ((await prisma.productImage.count({ where: { productId: id } })) >= MAX_IMAGES) {
    return NextResponse.json({ error: `A product can have at most ${MAX_IMAGES} images` }, { status: 409 });
  }
  const last = await prisma.productImage.aggregate({ where: { productId: id }, _max: { position: true } });
  try {
    const img = await prisma.productImage.create({ data: { productId: id, url: p.data.url, alt: p.data.alt, position: (last._max.position ?? -1) + 1 }, select: { id: true } });
    return NextResponse.json({ ok: true, id: img.id }, { status: 201 });
  } catch (e) {
    if (dbCode(e) === "P2003") return NextResponse.json({ error: "Product not found" }, { status: 404 });
    console.error("add image failed:", e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "Could not add the image" }, { status: 500 });
  }
}

const OrderBody = z.object({ order: z.array(z.string().min(1)).min(1).max(50) });

/** Saves a new image order. The list must contain exactly the product's current images, so a stale screen cannot drop or duplicate one. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = await adminOnly();
  if ("res" in a) return a.res;
  const p = OrderBody.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid image order" }, { status: 422 });
  const { id } = await params;
  const have = new Set((await prisma.productImage.findMany({ where: { productId: id }, select: { id: true } })).map((i) => i.id));
  const want = new Set(p.data.order);
  if (want.size !== p.data.order.length || want.size !== have.size || p.data.order.some((x) => !have.has(x))) {
    return NextResponse.json({ error: "The images changed since this screen loaded. Refresh and try again." }, { status: 409 });
  }
  await prisma.$transaction(p.data.order.map((imgId, i) => prisma.productImage.update({ where: { id: imgId }, data: { position: i } })));
  return NextResponse.json({ ok: true });
}
