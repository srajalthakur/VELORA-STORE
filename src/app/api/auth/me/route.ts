import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
export const dynamic = "force-dynamic";
export async function GET() {
  const u = await currentUser();
  return u ? NextResponse.json({ id: u.id, email: u.email, name: u.name, role: u.role }) : NextResponse.json({ error: "Not signed in" }, { status: 401 });
}
