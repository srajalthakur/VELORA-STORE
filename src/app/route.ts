import { readFile } from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cached: string | null = null;

/** The VELORA storefront, served at "/". The page itself lives in src/storefront/velora.html and talks to this app's own /api routes. */
export async function GET() {
  // In development the file is re-read each time, so edits show up on refresh. In production it is read once.
  if (!cached || process.env.NODE_ENV !== "production") cached = await readFile(path.join(process.cwd(), "src", "storefront", "velora.html"), "utf8");
  return new Response(cached, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}
