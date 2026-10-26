"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { passwordProblem } from "@/lib/passwordrules";
import s from "../login/login.module.css";

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) return setError("Enter your name");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address");
    const bad = passwordProblem(password);
    if (bad) return setError(bad);
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setError(j.error || "Could not create the account. Try again.");
        setBusy(false);
        return;
      }
      router.replace("/account"); // stay busy while navigating so the form cannot be sent twice
      router.refresh();
    } catch {
      setError("Network problem. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={s.form} noValidate>
      <label className={s.field}>
        <span>Name</span>
        <input type="text" name="name" autoComplete="name" autoFocus value={name} onChange={(e) => setName(e.target.value)} disabled={busy} suppressHydrationWarning />
      </label>
      <label className={s.field}>
        <span>Email</span>
        <input type="email" name="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} suppressHydrationWarning />
      </label>
      <label className={s.field}>
        <span>Password (at least 10 characters)</span>
        <div className={s.pw}>
          <input type={show ? "text" : "password"} name="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} suppressHydrationWarning />
          <button type="button" className={s.toggle} onClick={() => setShow((v) => !v)} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
        </div>
      </label>
      <p className={s.error} role="alert" aria-live="polite">{error}</p>
      <button type="submit" className={s.submit} disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
    </form>
  );
}
