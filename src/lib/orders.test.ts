import { describe, expect, it } from "vitest";
import { AmountMismatchError, expireStaleOrders, reserve, settle, StockError, UnknownOrderError } from "./orders";
function fake(onHand = 5) {
  const inv: Record<string, { onHand: number; reserved: number }> = { v1: { onHand, reserved: 0 }, v2: { onHand: 1, reserved: 0 } };
  const items = [{ variantId: "v1", qty: 2 }];
  const order: any = { id: "o1", number: "VEL-1", status: "PENDING", items };
  const pay: any = { id: "p1", orderId: "o1", status: "CREATED", amountPaise: 1000, order };
  const tx: any = {
    payment: {
      findUnique: async ({ where }: any) => (where.providerOrderId === "rzp_o" ? pay : null),
      updateMany: async ({ where, data }: any) => (where.id === pay.id && where.status.in.includes(pay.status) ? (Object.assign(pay, data), { count: 1 }) : { count: 0 }),
    },
    order: { updateMany: async ({ where, data }: any) => (where.id === order.id && order.status === where.status ? (Object.assign(order, data), { count: 1 }) : { count: 0 }) },
    orderItem: { findMany: async () => items },
    $executeRaw: async (s: TemplateStringsArray, ...v: any[]) => {
      const q = s.join("?");
      if (q.includes(">=")) { const [qty, id] = v, i = inv[id]; if (i && i.onHand - i.reserved >= qty) { i.reserved += qty; return 1; } return 0; }
      if (q.includes('"onHand" = "onHand" -')) { const [qty, , id] = v; inv[id].onHand -= qty; inv[id].reserved -= qty; return 1; }
      const [qty, id] = v; inv[id].reserved -= qty; return 1;
    },
  };
  const db: any = { order: { findMany: async () => [{ id: "o1" }] }, $transaction: async (fn: any) => fn(tx) };
  return { tx, db, inv, pay, order };
}
const lines = [{ variantId: "v1", qty: 2 }];
describe("reserving stock", () => {
  it("refuses to oversell", async () => {
    const { tx, inv } = fake();
    await reserve(tx, [{ variantId: "v1", qty: 5 }]);
    expect(inv.v1.reserved).toBe(5);
    await expect(reserve(tx, [{ variantId: "v1", qty: 1 }])).rejects.toBeInstanceOf(StockError);
  });
  it("is all or nothing across lines", async () => {
    const { tx, inv } = fake();
    await expect(reserve(tx, [{ variantId: "v1", qty: 2 }, { variantId: "v2", qty: 2 }])).rejects.toBeInstanceOf(StockError);
    expect(inv.v1.reserved).toBe(0); expect(inv.v2.reserved).toBe(0);
  });
});
describe("settling payments", () => {
  it("confirms once and ignores repeats", async () => {
    const { tx, inv, pay, order } = fake();
    await reserve(tx, lines);
    const a = await settle(tx, "rzp_o", "pay_1", 1000), b = await settle(tx, "rzp_o", "pay_1", 1000);
    expect([a.alreadySettled, b.alreadySettled]).toEqual([false, true]);
    expect(inv.v1).toEqual({ onHand: 3, reserved: 0 }); expect(order.status).toBe("CONFIRMED"); expect(pay.status).toBe("CAPTURED");
  });
  it("rejects a wrong amount and unknown orders without changing anything", async () => {
    const { tx, inv, pay } = fake();
    await expect(settle(tx, "rzp_o", "pay_1", 999)).rejects.toBeInstanceOf(AmountMismatchError);
    await expect(settle(tx, "nope", "pay_1")).rejects.toBeInstanceOf(UnknownOrderError);
    expect(pay.status).toBe("CREATED"); expect(inv.v1.onHand).toBe(5);
  });
});
describe("abandoned checkouts", () => {
  it("releases held stock once and cancels the order", async () => {
    const { tx, db, inv, order } = fake();
    await reserve(tx, lines);
    expect(await expireStaleOrders(db, { force: true })).toBe(1);
    expect(order.status).toBe("CANCELLED"); expect(inv.v1.reserved).toBe(0);
    expect(await expireStaleOrders(db, { force: true })).toBe(0);
  });
  it("revives an expired order that is paid later, if stock is still there", async () => {
    const { tx, db, inv, order, pay } = fake();
    await reserve(tx, lines); await expireStaleOrders(db, { force: true });
    const r = await settle(tx, "rzp_o", "pay_late", 1000);
    expect(r.needsRefund).toBe(false); expect(order.status).toBe("CONFIRMED"); expect(pay.status).toBe("CAPTURED");
    expect(inv.v1).toEqual({ onHand: 3, reserved: 0 });
  });
  it("flags a refund when an expired order is paid after the stock is gone", async () => {
    const { tx, db, inv, order, pay } = fake();
    await reserve(tx, lines); await expireStaleOrders(db, { force: true });
    inv.v1.onHand = 1;
    const r = await settle(tx, "rzp_o", "pay_late", 1000);
    expect(r.needsRefund).toBe(true); expect(order.status).toBe("CANCELLED"); expect(pay.status).toBe("CAPTURED");
    expect(inv.v1).toEqual({ onHand: 1, reserved: 0 });
  });
});
