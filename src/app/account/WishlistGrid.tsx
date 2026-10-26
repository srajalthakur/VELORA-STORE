"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import s from "./account.module.css";

type Item = { slug: string; name: string; image: { url: string; alt: string } | null; fromPaise: number; inStock: boolean };
const rupees = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

export function WishlistGrid({ items }: { items: Item[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function remove(it: Item) {
    setBusy(it.slug);
    setErr("");
    try {
      const r = await fetch("/api/account/wishlist", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: it.slug }) });
      if (!r.ok) setErr("Could not remove that item. Try again.");
      else {
        // The storefront keeps a copy in this browser too; take it out so it is not saved again on the next visit.
        try {
          const kept = (JSON.parse(localStorage.getItem("vwish") || "[]") as string[]).filter((x) => x !== it.slug);
          localStorage.setItem("vwish", JSON.stringify(kept));
        } catch { /* storage unavailable: nothing to tidy */ }
        router.refresh();
      }
    } catch {
      setErr("Network problem. Nothing was changed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) return <p className={s.empty}>Nothing saved yet. Tap the heart on any piece in <a href="/">the store</a> to keep it here.</p>;
  return (
    <div>
      {err && <p className={s.err} role="alert">{err}</p>}
      <ul className={s.wgrid}>
        {items.map((it) => (
          <li key={it.slug} className={s.wcard}>
            <a className={s.wimg} href={`/?product=${encodeURIComponent(it.slug)}`} aria-label={`View ${it.name}`}>
              {it.image ? <img src={it.image.url} alt={it.image.alt} loading="lazy" /> : <span className={s.wmono}>{it.name.slice(0, 1)}</span>}
            </a>
            <div className={s.wbody}>
              <a className={s.wname} href={`/?product=${encodeURIComponent(it.slug)}`}>{it.name}</a>
              <span className={s.wprice}>From {rupees(it.fromPaise)}</span>
              {!it.inStock && <span className={s.wsold}>Sold out</span>}
            </div>
            <div className={s.wbtns}>
              <a className={s.ghost} href={`/?product=${encodeURIComponent(it.slug)}`} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>View</a>
              <button type="button" className={s.ghost} onClick={() => remove(it)} disabled={busy === it.slug}>{busy === it.slug ? "Removing…" : "Remove"}</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
