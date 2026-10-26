import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { consumeToken } from "@/lib/emailtokens";
import { sameOrigin } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { passwordProblem } from "@/lib/passwordrules";
import { recordFailure, tooMany } from "@/lib/ratelimit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().min(20).max(200), password: z.string().max(200) });
const INVALID = "This link is invalid or has expired. Request a new one.";

class BadLink extends Error {}

/** Sets a new password from an emailed link, then signs the account out everywhere. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: INVALID }, { status: 400 });
  const bad = passwordProblem(p.data.password);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  const key = `reset|${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"}`;
  if (tooMany(key, 10)) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  recordFailure(key);
  try {
    await prisma.$transaction(async (tx) => {
      const email = await consumeToken(tx, "reset", p.data.token);
      if (!email) throw new BadLink();
      const user = await tx.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, emailVerified: true } });
      if (!user) throw new BadLink();
      // Following the emailed link proves the person controls the mailbox, so the email counts as verified too.
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(p.data.password), emailVerified: user.emailVerified ?? new Date() } });
      await tx.session.deleteMany({ where: { userId: user.id } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof BadLink) return NextResponse.json({ error: INVALID }, { status: 400 });
    console.error("reset failed:", e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "Could not reset the password" }, { status: 500 });
  }
}
