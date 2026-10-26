import { NextResponse } from "next/server";
import { currentUser, type SessionUser } from "./session";

/** Server-side check for signed-in customer routes. Every /api/account route must call this first. */
export async function customerOnly(): Promise<{ user: SessionUser } | { res: NextResponse }> {
  const user = await currentUser();
  if (!user) return { res: NextResponse.json({ error: "Please sign in" }, { status: 401 }) };
  return { user };
}
