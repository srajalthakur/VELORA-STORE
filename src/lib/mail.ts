/** Public address of the site, used inside emailed links. Read from APP_URL, never from the request, so a forged Host header cannot poison a reset link. */
export function appUrl(): string {
  const u = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (u) return u;
  if (process.env.NODE_ENV === "production") throw new Error("APP_URL is not set");
  return "http://localhost:3000";
}

/**
 * Sends a plain-text email through Resend when RESEND_API_KEY and MAIL_FROM are set.
 * In development, with no key, the message is printed in the terminal instead, so the flows can be tried without an email service.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const key = process.env.RESEND_API_KEY, from = process.env.MAIL_FROM;
  if (!key || !from) {
    if (process.env.NODE_ENV === "production") throw new Error("Email is not configured");
    console.log(`\n[dev email, not really sent]\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!r.ok) throw new Error(`Email service refused the message (${r.status})`);
}
