import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { customerOnly } from "@/lib/customer";
import { issueToken } from "@/lib/emailtokens";
import { sameOrigin } from "@/lib/http";
import { appUrl, sendMail } from "@/lib/mail";
import { recordFailure, tooMany } from "@/lib/ratelimit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Emails a confirmation link to the signed-in person's own address. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = await customerOnly();
  if ("res" in a) return a.res;
  const u = await prisma.user.findUnique({ where: { id: a.user.id }, select: { email: true, emailVerified: true } });
  if (!u) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  if (u.emailVerified) return NextResponse.json({ ok: true, already: true });
  const key = `verify-send|${a.user.id}`;
  if (tooMany(key, 5)) return NextResponse.json({ error: "Too many emails requested. Try again in 15 minutes." }, { status: 429 });
  recordFailure(key);
  try {
    const token = await issueToken("verify", u.email);
    await sendMail(u.email, "Confirm your VELORA email address", `Confirm this email address for your VELORA account (the link expires in 24 hours):\n${appUrl()}/verify?token=${encodeURIComponent(token)}\n\nIf you did not create an account, ignore this email.`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("verification email failed:", e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "Could not send the email right now. Try again later." }, { status: 502 });
  }
}
