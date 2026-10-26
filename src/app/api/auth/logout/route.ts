import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/http";
import { endSession } from "@/lib/session";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await endSession();
  return NextResponse.json({ ok: true });
}
