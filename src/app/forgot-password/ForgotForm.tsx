"use client";

import { useState, type FormEvent } from "react";
import s from "../login/login.module.css";

export default function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address");
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) setError(j.error || "Something went wrong. Try again.");
      else setSent(true);
    } catch {
      setError("Network problem. Check your connection and try again.");
    }
    setBusy(false);
  }

  if (sent) {
    return (
      <p className={s.lede} role="status" style={{ color: "#a9e6c0", margin: 0 }}>
        If an account exists for {email.trim()}, a reset link is on its way. It works once and expires in 1 hour. Check your spam folder if it does not arrive.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={s.form} noValidate>
      <label className={s.field}>
        <span>Email</span>
        <input type="email" name="email" autoComplete="email" inputMode="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} suppressHydrationWarning />
      </label>
      <p className={s.error} role="alert" aria-live="polite">{error}</p>
      <button type="submit" className={s.submit} disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
    </form>
  );
}
