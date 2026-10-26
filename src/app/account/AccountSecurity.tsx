"use client";

import { useState, type FormEvent } from "react";
import { passwordProblem } from "@/lib/passwordrules";
import s from "./account.module.css";

const ok = { margin: "0 0 12px", color: "#a9e6c0", fontSize: 14, lineHeight: 1.5 } as const;

export function VerifyBanner({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function send() {
    if (busy) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const r = await fetch("/api/auth/verify/send", { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { error?: string; already?: boolean };
      if (!r.ok) setErr(j.error || "Could not send the email. Try again.");
      else setMsg(j.already ? "Your email is already confirmed." : `We sent a confirmation link to ${email}. Check your spam folder if it does not arrive.`);
    } catch {
      setErr("Network problem. Try again.");
    }
    setBusy(false);
  }

  return (
    <div className={s.addr} style={{ marginBottom: 8, borderColor: "#c9a24b" }}>
      <p className={s.aname}>Your email address is not confirmed yet</p>
      <p className={s.aline}>Confirming it lets you recover your account if you forget your password.</p>
      {msg && <p style={{ ...ok, margin: "10px 0 0" }} role="status">{msg}</p>}
      {err && <p className={s.err} role="alert" style={{ marginTop: 10 }}>{err}</p>}
      <div className={s.btns}>
        <button type="button" className={s.save} onClick={send} disabled={busy}>{busy ? "Sending…" : msg ? "Send again" : "Send confirmation email"}</button>
      </div>
    </div>
  );
}

export function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setDone(false);
    if (!current) return setErr("Enter your current password");
    const bad = passwordProblem(next);
    if (bad) return setErr(bad);
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current, next }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) setErr(j.error || "Could not change the password. Try again.");
      else {
        setDone(true);
        setCurrent("");
        setNext("");
      }
    } catch {
      setErr("Network problem. Nothing was changed. Try again.");
    }
    setBusy(false);
  }

  return (
    <form className={s.addr} onSubmit={submit} noValidate style={{ display: "grid", gap: 12 }}>
      <label className={s.f}>
        <span>Current password</span>
        <input className={s.in} type={show ? "text" : "password"} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} disabled={busy} suppressHydrationWarning />
      </label>
      <label className={s.f}>
        <span>New password (at least 10 characters)</span>
        <input className={s.in} type={show ? "text" : "password"} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} disabled={busy} suppressHydrationWarning />
      </label>
      <label className={s.chk}>
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        <span>Show passwords</span>
      </label>
      {err && <p className={s.err} role="alert" style={{ margin: 0 }}>{err}</p>}
      {done && <p style={{ ...ok, margin: 0 }} role="status">Password changed. Other devices were signed out.</p>}
      <div className={s.btns} style={{ margin: 0 }}>
        <button type="submit" className={s.save} disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
      </div>
    </form>
  );
}
