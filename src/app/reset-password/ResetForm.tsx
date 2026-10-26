"use client";

import { useState, type FormEvent } from "react";
import { passwordProblem } from "@/lib/passwordrules";
import s from "../login/login.module.css";

export default function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const bad = passwordProblem(password);
    if (bad) return setError(bad);
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) setError(j.error || "Could not reset the password. Try again.");
      else setDone(true);
    } catch {
      setError("Network problem. Check your connection and try again.");
    }
    setBusy(false);
  }

  if (done) {
    return (
      <>
        <p className={s.lede} role="status" style={{ color: "#a9e6c0" }}>Your password has been changed and you were signed out everywhere. Sign in with the new one.</p>
        <a href="/login" className={s.submit} style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>Go to sign in</a>
      </>
    );
  }

  return (
    <form onSubmit={submit} className={s.form} noValidate>
      <label className={s.field}>
        <span>New password (at least 10 characters)</span>
        <div className={s.pw}>
          <input type={show ? "text" : "password"} name="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} suppressHydrationWarning />
          <button type="button" className={s.toggle} onClick={() => setShow((v) => !v)} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
        </div>
      </label>
      <p className={s.error} role="alert" aria-live="polite">{error}</p>
      <button type="submit" className={s.submit} disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
    </form>
  );
}
