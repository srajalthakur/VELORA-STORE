"use client";

import { useState } from "react";
import s from "../login/login.module.css";

export default function VerifyClient({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function confirm() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) setError(j.error || "Could not confirm the email. Try again.");
      else setDone(true);
    } catch {
      setError("Network problem. Check your connection and try again.");
    }
    setBusy(false);
  }

  if (done) {
    return (
      <>
        <p className={s.lede} role="status" style={{ color: "#a9e6c0" }}>Your email address is confirmed. Thank you.</p>
        <a href="/account" className={s.submit} style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>Go to my account</a>
      </>
    );
  }

  return (
    <div className={s.form}>
      <p className={s.lede} style={{ margin: 0 }}>Press the button to confirm this email address for your VELORA account.</p>
      <p className={s.error} role="alert" aria-live="polite">{error}</p>
      <button type="button" className={s.submit} onClick={confirm} disabled={busy}>{busy ? "Confirming…" : "Confirm email"}</button>
    </div>
  );
}
