import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { consumeToken } from "@/lib/emailtokens";
import { clientIp } from "@/lib/clientip";
import { sameOrigin } from "@/lib/http";
import { recordFailure, tooMany } from "@/lib/ratelimit";
export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().min(20).max(200) });
const INVALID = "This link is invalid or has expired. Request a new one from your account page.";

/** Confirms an email address from an emailed link. The page asks for a click first, so mail scanners that open links cannot use the token up. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: INVALID }, { status: 400 });
  const key = `verify|${clientIp(req)}`;
  if (await tooMany(key, 20)) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  await recordFailure(key);
  const done = await prisma.$transaction(async (tx) => {
    const email = await consumeToken(tx, "verify", p.data.token);
    if (!email) return false;
    await tx.user.updateMany({ where: { email: { equals: email, mode: "insensitive" }, emailVerified: null }, data: { emailVerified: new Date() } });
    return true;
  });
  return done ? NextResponse.json({ ok: true }) : NextResponse.json({ error: INVALID }, { status: 400 });
}
