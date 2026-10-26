/** Prices are stored as whole paise (integers). These limits are shared by the admin screen and the API. */
export const MIN_PAISE = 100; // ₹1
export const MAX_PAISE = 1_000_000_000; // ₹1 crore, safely inside a 32-bit integer column
export const MAX_STOCK = 100_000;

/** "92500", "1,85,000" or "1850.5" to paise, using whole-number arithmetic (no floating-point drift). Returns null for anything else. */
export function rupeesToPaise(input: string): number | null {
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(input.trim().replace(/,/g, ""));
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

/** Paise to a plain editable amount: 9250000 gives "92500", 185050 gives "1850.50". */
export function paiseToRupees(paise: number): string {
  const r = Math.floor(paise / 100);
  const f = paise % 100;
  return f ? `${r}.${String(f).padStart(2, "0")}` : String(r);
}
