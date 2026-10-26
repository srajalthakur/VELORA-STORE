import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { customerOnly } from "@/lib/customer";
import { sameOrigin } from "@/lib/http";
import { hashPassword, verifyPassword } from "@/lib/password";
import { passwordProblem } from "@/lib/passwordrules";
import { clearFailures, recordFailure, tooMany } from "@/lib/ratelimit";
import { SESSION_COOKIE } from "@/lib/session";
import { hashToken } from "@/lib/token";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ current: z.string().min(1, "Enter your current password").max(200), next: z.string().max(200) });

/** Changes the password after checking the current one, and signs out every other device. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = await customerOnly();
  if ("res" in a) return a.res;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Check the passwords and try again" }, { status: 400 });
  const key = `pw|${a.user.id}`;
  if (await tooMany(key)) return NextResponse.json({ error: "Too many wrong attempts. Try again in 15 minutes." }, { status: 429 });
  const u = await prisma.user.findUnique({ where: { id: a.user.id }, select: { passwordHash: true } });
  if (!u?.passwordHash || !verifyPassword(p.data.current, u.passwordHash)) {
    await recordFailure(key);
    return NextResponse.json({ error: "Your current password is not correct" }, { status: 403 });
  }
  const bad = passwordProblem(p.data.next);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  if (p.data.next === p.data.current) return NextResponse.json({ error: "Choose a password different from the current one" }, { status: 400 });
  await clearFailures(key);
  const mine = (await cookies()).get(SESSION_COOKIE)?.value;
  await prisma.$transaction([
    prisma.user.update({ where: { id: a.user.id }, data: { passwordHash: hashPassword(p.data.next) } }),
    prisma.session.deleteMany({ where: { userId: a.user.id, ...(mine ? { NOT: { sessionToken: hashToken(mine) } } : {}) } }),
  ]);
  return NextResponse.json({ ok: true });
}
