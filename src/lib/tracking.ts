import { z } from "zod";

export type TimelineOrder = {
  status: string;
  createdAt: Date | string;
  confirmedAt?: Date | string | null;
  processingAt?: Date | string | null;
  shippedAt?: Date | string | null;
  deliveredAt?: Date | string | null;
};
export type Step = { key: "placed" | "confirmed" | "processing" | "shipped" | "delivered"; label: string; at: string | null; done: boolean };
export type Timeline = { steps: Step[]; terminal: "CANCELLED" | "REFUNDED" | null; awaitingPayment: boolean };

const RANK: Record<string, number> = { PENDING: 0, CONFIRMED: 1, PROCESSING: 2, SHIPPED: 3, DELIVERED: 4 };
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

/** The steps a customer sees for an order. A step is done when its date was recorded, or when the order's status is already past it
 *  (older orders have no dates, so they show done steps without a date). Cancelled and refunded orders show only the steps that really happened. */
export function timeline(o: TimelineOrder): Timeline {
  const at = { placed: iso(o.createdAt), confirmed: iso(o.confirmedAt), processing: iso(o.processingAt), shipped: iso(o.shippedAt), delivered: iso(o.deliveredAt) };
  const terminal = o.status === "CANCELLED" || o.status === "REFUNDED" ? (o.status as "CANCELLED" | "REFUNDED") : null;
  const rank = RANK[o.status] ?? -1;
  const defs: [Step["key"], string, number][] = [["placed", "Order placed", 0], ["confirmed", "Payment confirmed", 1], ["processing", "Being prepared", 2], ["shipped", "Shipped", 3], ["delivered", "Delivered", 4]];
  const steps = defs.map(([key, label, r]) => ({ key, label, at: at[key], done: key === "placed" || at[key] !== null || (!terminal && rank >= r) }));
  return { steps, terminal, awaitingPayment: o.status === "PENDING" };
}

const isHttps = (v: string) => { try { return new URL(v).protocol === "https:"; } catch { return false; } };

/** What the admin sends when marking an order shipped, or correcting the tracking details afterwards. */
export const TrackingInput = z.object({
  carrier: z.string().trim().min(2, "Enter the courier name").max(60),
  trackingNumber: z.string().trim().min(3, "Enter the tracking number").max(60).regex(/^[A-Za-z0-9][A-Za-z0-9 \-_/]*$/, "Tracking number can only have letters, numbers, spaces, dashes and slashes"),
  trackingUrl: z.string().trim().max(300).optional().transform((v) => v || undefined).refine((v) => v === undefined || isHttps(v), "The tracking link must start with https://"),
});
export type TrackingInput = z.infer<typeof TrackingInput>;

/** Only https links are ever shown to customers as clickable. */
export const safeTrackingUrl = (v: string | null | undefined) => (v && isHttps(v) ? v : null);
