const prod = process.env.NODE_ENV === "production";
// The content policy is REPORT-ONLY: browsers list what it would block (DevTools > Console) but nothing breaks. Once a full
// shopping and payment run shows no warnings, rename the header to "Content-Security-Policy" to enforce it.
const csp = [
  "default-src 'self'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "object-src 'none'",
  `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://cdnjs.cloudflare.com${prod ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https:", "connect-src 'self' https://lumberjack.razorpay.com https://api.razorpay.com",
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
].join("; ");
const security = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy-Report-Only", value: csp },
  ...(prod ? [{ key: "Strict-Transport-Security", value: "max-age=15552000" }] : []),
];
export default { poweredByHeader: false, async headers() { return [{ source: "/:path*", headers: security }]; } };
