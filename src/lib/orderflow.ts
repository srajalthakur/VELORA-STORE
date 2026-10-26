const NEXT: Record<string, string> = { CONFIRMED: "PROCESSING", PROCESSING: "SHIPPED", SHIPPED: "DELIVERED" };
type O = { status: string; payments: { status: string }[] };
export const nextStatus = (s: string) => NEXT[s] ?? null;
export const canMove = (from: string, to: string) => NEXT[from] === to;
const hasCaptured = (o: O) => o.payments.some((p) => p.status === "CAPTURED");
/** Paid orders that can be refunded. Cancelled-but-paid orders are the late-payment case. */
export const canRefund = (o: O) => hasCaptured(o) && ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].includes(o.status);
export const needsRefund = (o: O) => o.status === "CANCELLED" && hasCaptured(o);
