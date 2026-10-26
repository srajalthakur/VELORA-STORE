import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/clientip";
import { sameOrigin } from "@/lib/http";
import { hashPassword, verifyPassword } from "@/lib/password";
import { clearFailures, recordFailure, tooMany } from "@/lib/ratelimit";
import { startSession } from "@/lib/session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const DUMMY = hashPassword("velora-dummy-password"); // so unknown emails cost the same time as wrong passwords
const Body = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Enter your email and password" }, { status: 400 });
  const ip = clientIp(req), key = `${ip}|${p.data.email}`, acctKey = `login-acct|${p.data.email}`, ipKey = `login-ip|${ip}`;
  // Three counters: this visitor on this account, anyone on this account, and this visitor on any account.
  if (await tooMany(key) || await tooMany(acctKey, 15) || await tooMany(ipKey, 40)) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  const user = await prisma.user.findFirst({ where: { email: { equals: p.data.email, mode: "insensitive" } } });
  const ok = verifyPassword(p.data.password, user?.passwordHash ?? DUMMY) && !!user?.passwordHash;
  if (!ok || !user) { await recordFailure(key); await recordFailure(acctKey); await recordFailure(ipKey); return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 }); }
  await clearFailures(key); await clearFailures(acctKey);
  await startSession(user.id);
  return NextResponse.json({ ok: true, role: user.role });
}
