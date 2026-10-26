import { z } from "zod";

/** The delivery details every order needs. Same rules as before, now shared by the checkout route and its tests. */
export const Details = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().transform((s) => s.replace(/[\s-]/g, "").replace(/^(\+91|0)/, "")).pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number")),
  addr: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(60),
  pin: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a 6-digit PIN code"),
});

type Saved = { fullName: string; phone: string; line1: string; line2: string | null; city: string; state: string; pin: string };

/** A saved address, shaped like the details a checkout form would send. */
export const savedToDetails = (a: Saved) => ({
  name: a.fullName,
  phone: a.phone,
  addr: [a.line1, a.line2].map((x) => x?.trim()).filter(Boolean).join(", "),
  city: a.city,
  state: a.state,
  pin: a.pin,
});
