import { createHmac, timingSafeEqual } from "node:crypto";
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const hmac = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest("hex");
/** Checkout callback signature: HMAC-SHA256 of "order_id|payment_id" with the key secret. */
export const verifyPaymentSignature = (orderId: string, paymentId: string, sig: string, secret: string) => same(hmac(`${orderId}|${paymentId}`, secret), sig);
/** Webhook signature: HMAC-SHA256 of the exact raw request body with the webhook secret. */
export const verifyWebhookSignature = (rawBody: string, sig: string, secret: string) => same(hmac(rawBody, secret), sig);

type Creds = { keyId: string; keySecret: string };
const auth = (c: Creds) => "Basic " + Buffer.from(`${c.keyId}:${c.keySecret}`).toString("base64");
export async function createRazorpayOrder(c: Creds, amountPaise: number, receipt: string) {
  const r = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: auth(c), "Content-Type": "application/json" }, body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt }) });
  if (!r.ok) throw new Error(`Razorpay order creation failed (${r.status})`);
  return (await r.json()) as { id: string; amount: number };
}
export async function fetchRazorpayPayment(c: Creds, paymentId: string) {
  const r = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: auth(c) } });
  if (!r.ok) throw new Error(`Razorpay payment lookup failed (${r.status})`);
  return (await r.json()) as { id: string; order_id: string; amount: number; currency: string; status: string };
}

/** Full refund of a captured payment. The idempotency key makes repeated clicks or retries return the same refund instead of creating another. */
export async function refundRazorpayPayment(c: Creds, paymentId: string, amountPaise: number, idempotencyKey: string) {
  const r = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, { method: "POST", headers: { Authorization: auth(c), "Content-Type": "application/json", "X-Refund-Idempotency": idempotencyKey }, body: JSON.stringify({ amount: amountPaise, speed: "normal" }) });
  const j = (await r.json().catch(() => ({}))) as { id?: string; status?: string; error?: { description?: string } };
  if (!r.ok) throw new Error(j.error?.description || `Razorpay refund failed (${r.status})`);
  return j as { id: string; status: string };
}

