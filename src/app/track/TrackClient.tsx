"use client";

import { useState, type FormEvent } from "react";
import OrderTimeline, { type TrackView } from "./OrderTimeline";
import s from "./track.module.css";

type Found = TrackView & { number: string; items: { name: string; qty: number }[] };

export default function TrackClient() {
  const [number, setNumber] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [found, setFound] = useState<Found | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr("");
    setFound(null);
    setBusy(true);
    try {
      const r = await fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number, email }) });
      const j = (await r.json().catch(() => ({}))) as { order?: Found; error?: string };
      if (!r.ok || !j.order) setErr(j.error || "Something went wrong. Try again.");
      else setFound(j.order);
    } catch {
      setErr("Network problem. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className={s.form} onSubmit={submit} noValidate>
        <label className={s.f}>
          <span>Order number</span>
          <input className={s.in} value={number} onChange={(e) => setNumber(e.target.value)} maxLength={40} autoComplete="off" disabled={busy} suppressHydrationWarning />
        </label>
        <label className={s.f}>
          <span>Email</span>
          <input className={s.in} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} autoComplete="email" disabled={busy} suppressHydrationWarning />
        </label>
        {err && <p className={s.err} role="alert">{err}</p>}
        <button type="submit" className={s.btn} disabled={busy || !number.trim() || !email.trim()}>{busy ? "Looking…" : "Track order"}</button>
      </form>
      {found && (
        <section className={s.card} aria-live="polite">
          <div className={s.head}>
            <strong className={s.num}>{found.number}</strong>
          </div>
          <OrderTimeline t={found} />
          <ul className={s.items}>
            {found.items.map((i, n) => <li key={n}>{i.qty} × {i.name}</li>)}
          </ul>
        </section>
      )}
    </>
  );
}
