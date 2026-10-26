import { z } from "zod";
const Schema = z.object({
  DATABASE_URL: z.string().min(1),
  RAZORPAY_KEY_ID: z.string().min(1, "RAZORPAY_KEY_ID is missing"),
  RAZORPAY_KEY_SECRET: z.string().min(1, "RAZORPAY_KEY_SECRET is missing"),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(8, "RAZORPAY_WEBHOOK_SECRET must be at least 8 characters"),
});
let cached: z.infer<typeof Schema> | undefined;
/** Validated lazily so routes that don't need payments (like the catalogue) work without Razorpay keys. */
export const env = () => (cached ??= Schema.parse(process.env));
