import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { dbCode } from "@/lib/dberror";
import { issueToken } from "@/lib/emailtokens";
import { clientIp } from "@/lib/clientip";
import { sameOrigin } from "@/lib/http";
import { appUrl, sendMail } from "@/lib/mail";
import { hashPassword } from "@/lib/password";
import { passwordProblem } from "@/lib/passwordrules";
import { recordFailure, tooMany } from "@/lib/ratelimit";
import { startSession } from "@/lib/session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  password: z.string().max(200),
});

/** Creates a customer account, signs the person in and emails a confirmation link. The role is always CUSTOMER; it can never be chosen by the request. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Check your details and try again" }, { status: 400 });
  const bad = passwordProblem(p.data.password);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const key = `register|${clientIp(req)}`;
  if (tooMany(key, 10)) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  recordFailure(key); // counts every attempt, successful or not

  const taken = await prisma.user.findFirst({ where: { email: { equals: p.data.email, mode: "insensitive" } }, select: { id: true } });
  if (taken) return NextResponse.json({ error: "An account with this email already exists. Try signing in." }, { status: 409 });
  try {
    const user = await prisma.user.create({ data: { name: p.data.name, email: p.data.email, passwordHash: hashPassword(p.data.password), role: "CUSTOMER" }, select: { id: true } });
    await startSession(user.id);
    // Best effort: a failed email must not undo the sign-up. The account page offers "send again".
    issueToken("verify", p.data.email)
      .then((t) => sendMail(p.data.email, "Confirm your VELORA email address", `Welcome to VELORA. Confirm this email address (the link expires in 24 hours):\n${appUrl()}/verify?token=${encodeURIComponent(t)}`))
      .catch((e) => console.error("welcome email failed:", e instanceof Error ? e.message : "unknown error"));
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (dbCode(e) === "P2002") return NextResponse.json({ error: "An account with this email already exists. Try signing in." }, { status: 409 });
    console.error("register failed:", e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "Could not create the account" }, { status: 500 });
  }
}
