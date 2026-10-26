import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { dbCode } from "@/lib/dberror";
import { adminOnly, sameOrigin } from "@/lib/http";
import { isSafeImageUrl } from "@/lib/imageurl";
export const dynamic = "force-dynamic";

const Body = z.object({
  url: z.string().trim().refine(isSafeImageUrl, "Use a full https:// address, or a path like /images/tote.jpg"),
  alt: z.string().trim().min(1, "Describe the image in a few words").max(200),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = await adminOnly();
  if ("res" in a) return a.res;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Check the image details" }, { status: 422 });
  const { id } = await params;
  try {
    await prisma.productImage.update({ where: { id }, data: p.data });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (dbCode(e) === "P2025") return NextResponse.json({ error: "Image not found" }, { status: 404 });
    console.error("update image failed:", e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "Could not save the image" }, { status: 500 });
  }
}

/** Removes the image from the product. Only the database row goes; the file at that address is untouched. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = await adminOnly();
  if ("res" in a) return a.res;
  const { id } = await params;
  try {
    await prisma.productImage.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (dbCode(e) === "P2025") return NextResponse.json({ error: "Image not found" }, { status: 404 });
    console.error("delete image failed:", e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "Could not remove the image" }, { status: 500 });
  }
}
