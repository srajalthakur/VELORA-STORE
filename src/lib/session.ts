import { cookies } from "next/headers";
import { prisma } from "./db";
import { hashToken, newToken } from "./token";
export const SESSION_COOKIE = "velora_session";
const DAYS = 7;
export type SessionUser = { id: string; email: string; name: string | null; role: "CUSTOMER" | "ADMIN" };
export async function startSession(userId: string) {
  const token = newToken(), expires = new Date(Date.now() + DAYS * 86_400_000);
  await prisma.session.create({ data: { sessionToken: hashToken(token), userId, expires } });
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires });
}
export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { sessionToken: hashToken(token) }, include: { user: true } });
  if (!s || s.expires < new Date()) return null;
  return { id: s.user.id, email: s.user.email, name: s.user.name, role: s.user.role };
}
export async function endSession() {
  const c = await cookies(), t = c.get(SESSION_COOKIE)?.value;
  if (t) await prisma.session.deleteMany({ where: { sessionToken: hashToken(t) } });
  c.delete(SESSION_COOKIE);
}

