import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyPaymentSignature, verifyWebhookSignature } from "./razorpay";
const sign = (d: string, s: string) => createHmac("sha256", s).update(d).digest("hex");
describe("signatures", () => {
  it("accepts a genuine payment signature and rejects tampering", () => {
    const s = sign("order_1|pay_1", "secret");
    expect(verifyPaymentSignature("order_1", "pay_1", s, "secret")).toBe(true);
    expect(verifyPaymentSignature("order_1", "pay_2", s, "secret")).toBe(false);
    expect(verifyPaymentSignature("order_1", "pay_1", s, "other")).toBe(false);
    expect(verifyPaymentSignature("order_1", "pay_1", "short", "secret")).toBe(false);
  });
  it("verifies webhooks against the exact raw body", () => {
    const body = '{"event":"payment.captured"}', s = sign(body, "whsec_test_1");
    expect(verifyWebhookSignature(body, s, "whsec_test_1")).toBe(true);
    expect(verifyWebhookSignature(body + " ", s, "whsec_test_1")).toBe(false);
  });
});
