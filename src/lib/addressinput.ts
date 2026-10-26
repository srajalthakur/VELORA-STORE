import { z } from "zod";

/** Shared by the address routes. The phone is cleaned to ten digits (spaces, dashes, +91 and a leading 0 are accepted). */
export const AddressBody = z.object({
  fullName: z.string().trim().min(1, "Enter the recipient's name").max(80),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, "").replace(/^(?:\+91|91|0)(?=\d{10}$)/, ""))
    .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a 10-digit Indian mobile number"),
  line1: z.string().trim().min(1, "Enter the address line").max(120),
  line2: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().min(1, "Enter the city").max(60),
  state: z.string().trim().min(2, "Enter the state").max(40),
  pin: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a 6-digit PIN code"),
  isDefault: z.boolean(),
});
