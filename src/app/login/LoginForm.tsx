"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import s from "./login.module.css";

export default function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; role?: string };
      if (!r.ok) {
        setError(j.error || "Could not sign in. Try again.");
        setBusy(false);
        return;
      }
      // Stay "busy" while navigating so the form cannot be submitted twice.
      router.replace(next ?? (j.role === "ADMIN" ? "/admin/orders" : "/"));
      router.refresh();
    } catch {
      setError("Network problem. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={s.form} noValidate>
      <label className={s.field}>
        <span>Email</span>
        <input
          type="email"
          name="email"
          suppressHydrationWarning
          autoComplete="username"
          inputMode="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          aria-invalid={!!error}
        />
      </label>

      <label className={s.field}>
        <span>Password</span>
        <div className={s.pw}>
          <input
            type={show ? "text" : "password"}
            name="password"
            suppressHydrationWarning
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            aria-invalid={!!error}
          />
          <button type="button" className={s.toggle} onClick={() => setShow((v) => !v)} aria-pressed={show}>
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </label>

      <p className={s.error} role="alert" aria-live="polite">{error}</p>

      <button type="submit" className={s.submit} disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
