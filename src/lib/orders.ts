import type { Prisma, PrismaClient } from "@prisma/client";
type Tx = Prisma.TransactionClient;
type Line = { variantId: string; qty: number };
export class StockError extends Error {}
export class UnknownOrderError extends Error {}
export class AmountMismatchError extends Error {}
/** How long an unpaid checkout may hold stock. */
export const HOLD_MINUTES = 15;

async function tryReserve(tx: Tx, lines: Line[]) {
  const done: Line[] = [];
  for (const l of lines) {
    const n = await tx.$executeRaw`UPDATE "Inventory" SET "reserved" = "reserved" + ${l.qty} WHERE "variantId" = ${l.variantId} AND "onHand" - "reserved" >= ${l.qty}`;
    if (n !== 1) { await unreserve(tx, done); return false; } // all or nothing
    done.push(l);
  }
  return true;
}
async function unreserve(tx: Tx, lines: Line[]) {
  for (const l of lines) await tx.$executeRaw`UPDATE "Inventory" SET "reserved" = "reserved" - ${l.qty} WHERE "variantId" = ${l.variantId}`;
}
async function sell(tx: Tx, lines: Line[]) {
  for (const l of lines) await tx.$executeRaw`UPDATE "Inventory" SET "onHand" = "onHand" - ${l.qty}, "reserved" = "reserved" - ${l.qty} WHERE "variantId" = ${l.variantId}`;
}

/** Hold stock for an order being paid. Atomic: fails if available (onHand - reserved) is too low. Call inside the transaction that creates the order. */
export async function reserve(tx: Tx, lines: Line[]) {
  if (!(await tryReserve(tx, lines))) throw new StockError("Stock changed while you were checking out");
}

/** Mark a payment captured and finalise the order. Safe to call repeatedly or concurrently: only the call that flips the payment status touches stock.
 *  If the checkout had already expired, the stock is taken again when still available; otherwise `needsRefund` is true and the customer must be refunded. */
export async function settle(tx: Tx, providerOrderId: string, providerPaymentId: string, amountPaise?: number) {
  const pay = await tx.payment.findUnique({ where: { providerOrderId }, include: { order: { include: { items: true } } } });
  if (!pay) throw new UnknownOrderError(providerOrderId);
  if (amountPaise !== undefined && amountPaise !== pay.amountPaise) throw new AmountMismatchError(`${providerOrderId}: expected ${pay.amountPaise}, got ${amountPaise}`);
  const number = pay.order.number, items = pay.order.items;
  const moved = await tx.payment.updateMany({ where: { id: pay.id, status: { in: ["CREATED", "AUTHORIZED"] } }, data: { status: "CAPTURED", providerPaymentId } });
  if (moved.count === 0) return { number, alreadySettled: true, needsRefund: false };
  const ok = await tx.order.updateMany({ where: { id: pay.orderId, status: "PENDING" }, data: { status: "CONFIRMED" } });
  if (ok.count === 1) { await sell(tx, items); return { number, alreadySettled: false, needsRefund: false }; }
  if (pay.order.status === "CANCELLED" && (await tryReserve(tx, items))) {
    const back = await tx.order.updateMany({ where: { id: pay.orderId, status: "CANCELLED" }, data: { status: "CONFIRMED" } });
    if (back.count === 1) { await sell(tx, items); return { number, alreadySettled: false, needsRefund: false }; }
    await unreserve(tx, items);
  }
  return { number, alreadySettled: false, needsRefund: pay.order.status === "CANCELLED" };
}

/** Cancel a still-pending order and release its held stock. Returns false if the order was no longer pending. */
export async function releaseOrder(tx: Tx, orderId: string) {
  const o = await tx.order.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "CANCELLED" } });
  if (o.count !== 1) return false;
  await unreserve(tx, await tx.orderItem.findMany({ where: { orderId } }));
  return true;
}

let lastRun = 0;
/** Release stock held by checkouts that were never paid. Skips orders with a payment in flight. Safe to run often; throttled to once a minute unless forced. */
export async function expireStaleOrders(db: PrismaClient, o: { now?: Date; minutes?: number; force?: boolean } = {}) {
  const now = o.now ?? new Date();
  if (!o.force && now.getTime() - lastRun < 60_000) return 0;
  lastRun = now.getTime();
  const cutoff = new Date(now.getTime() - (o.minutes ?? HOLD_MINUTES) * 60_000);
  const stale = await db.order.findMany({ where: { status: "PENDING", createdAt: { lt: cutoff }, payments: { none: { status: { in: ["AUTHORIZED", "CAPTURED"] } } } }, select: { id: true }, take: 100 });
  let n = 0;
  for (const s of stale) if (await db.$transaction((tx) => releaseOrder(tx, s.id))) n++;
  return n;
}

/** A refund processed by the provider: record it on the payment and order. Stock is not restocked automatically. */
export async function markRefunded(tx: Tx, providerPaymentId: string) {
  const pay = await tx.payment.findUnique({ where: { providerPaymentId } });
  if (!pay) return;
  const r = await tx.payment.updateMany({ where: { id: pay.id, status: "CAPTURED" }, data: { status: "REFUNDED" } });
  if (r.count === 1) await tx.order.update({ where: { id: pay.orderId }, data: { status: "REFUNDED" } });
}
