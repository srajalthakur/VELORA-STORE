import { NextResponse } from "next/server";
import { currentUser, type SessionUser } from "./session";
/** Browsers always send Origin on cross-site writes; reject it when it is not this site. (Cookies are also SameSite=Lax.) */
export function sameOrigin(req: Request) {
  const o = req.headers.get("origin");
  if (!o) return true;
  try { return new URL(o).host === req.headers.get("host"); } catch { return false; }
}
/** Server-side admin check. Every /api/admin route must call this first. */
export async function adminOnly(): Promise<{ user: SessionUser } | { res: NextResponse }> {
  const user = await currentUser();
  if (!user) return { res: NextResponse.json({ error: "Please sign in" }, { status: 401 }) };
  if (user.role !== "ADMIN") return { res: NextResponse.json({ error: "Not allowed" }, { status: 403 }) };
  return { user };
}
