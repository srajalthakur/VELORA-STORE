import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { issueToken } from "@/lib/emailtokens";
import { clientIp } from "@/lib/clientip";
import { sameOrigin } from "@/lib/http";
import { appUrl, sendMail } from "@/lib/mail";
import { recordFailure, tooMany } from "@/lib/ratelimit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200) });

/** Always answers the same way, so nobody can use this form to find out which emails have accounts. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Enter a valid email address" }, { status: 400 });
  const ip = clientIp(req);
  const ipKey = `forgot|${ip}`, mailKey = `forgot-mail|${p.data.email}`;
  if (tooMany(ipKey, 8)) return NextResponse.json({ error: "Too many requests. Try again in 15 minutes." }, { status: 429 });
  recordFailure(ipKey);
  const ok = NextResponse.json({ ok: true });
  if (tooMany(mailKey, 3)) return ok; // stops one mailbox from being flooded; the caller still sees the usual answer
  recordFailure(mailKey);
  try {
    const user = await prisma.user.findFirst({ where: { email: { equals: p.data.email, mode: "insensitive" }, passwordHash: { not: null } }, select: { email: true } });
    if (user) {
      const token = await issueToken("reset", user.email);
      await sendMail(user.email, "Reset your VELORA password", `Someone asked to reset the password for this account.\n\nChoose a new password here (the link works once and expires in 1 hour):\n${appUrl()}/reset-password?token=${encodeURIComponent(token)}\n\nIf this was not you, ignore this email. Your password stays the same.`);
    }
  } catch (e) {
    console.error("forgot-password failed:", e instanceof Error ? e.message : "unknown error");
  }
  return ok;
}
