"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import s from "./orders.module.css";

type Order = {
  id: string;
  number: string;
  createdAt: string;
  email: string | null;
  phone: string | null;
  shipTo: unknown;
  status: string;
  totalPaise: number;
  items: { name: string; qty: number }[];
  paymentStatus: string | null;
  next: string | null;
  canRefund: boolean;
  needsRefund: boolean;
};

type Filter = "ALL" | "NEEDS_REFUND" | "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
type Note = { kind: "ok" | "err"; text: string } | null;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "NEEDS_REFUND", label: "Needs refund" },
  { id: "CONFIRMED", label: "Confirmed" },
  { id: "PROCESSING", label: "Processing" },
  { id: "SHIPPED", label: "Shipped" },
  { id: "DELIVERED", label: "Delivered" },
  { id: "PENDING", label: "Pending" },
  { id: "CANCELLED", label: "Cancelled" },
  { id: "REFUNDED", label: "Refunded" },
];

const ACTION_LABEL: Record<string, string> = {
  PROCESSING: "Start processing",
  SHIPPED: "Mark shipped",
  DELIVERED: "Mark delivered",
};

const rupees = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

/** shipTo may be stored as text or as a JSON object; show whichever it is. */
function address(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return [o.name, o.addr, o.line1, o.line2, o.city, o.state, o.pin ?? o.pincode ?? o.postalCode]
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .join(", ");
  }
  return "";
}

export default function OrdersClient({ adminEmail }: { adminEmail: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<Note>(null);
  const seq = useRef(0);

  const toLogin = useCallback(() => router.replace("/login?next=/admin/orders"), [router]);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    setLoadError("");
    const p = new URLSearchParams();
    if (filter === "NEEDS_REFUND") p.set("refund", "1");
    else if (filter !== "ALL") p.set("status", filter);
    if (q.trim()) p.set("q", q.trim());
    try {
      const r = await fetch(`/api/admin/orders?${p}`, { cache: "no-store" });
      if (mine !== seq.current) return; // a newer request replaced this one
      if (r.status === 401) return toLogin();
      const j = (await r.json().catch(() => ({}))) as { orders?: Order[]; error?: string };
      if (!r.ok || !j.orders) throw new Error(j.error || "Could not load orders");
      setOrders(j.orders);
    } catch (e) {
      if (mine !== seq.current) return;
      setLoadError(e instanceof Error ? e.message : "Could not load orders");
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [filter, q, toLogin]);

  // Reload when the filter changes; wait 300 ms after typing stops before searching.
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function call(o: Order, url: string, init: RequestInit) {
    setBusyId(o.id);
    setNote(null);
    try {
      const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      if (r.status === 401) return { unauth: true as const };
      const j = (await r.json().catch(() => ({}))) as { error?: string; status?: string };
      return { ok: r.ok, j };
    } catch {
      return { ok: false, j: { error: "Network problem. Nothing was changed. Try again." } };
    } finally {
      setBusyId(null);
    }
  }

  async function advance(o: Order) {
    if (!o.next) return;
    const res = await call(o, `/api/admin/orders/${o.id}`, { method: "PATCH", body: JSON.stringify({ status: o.next }) });
    if ("unauth" in res) return toLogin();
    setNote(res.ok ? { kind: "ok", text: `${o.number} is now ${o.next!.toLowerCase()}.` } : { kind: "err", text: res.j.error || "Could not update the order" });
    load();
  }

  async function refund(o: Order) {
    const ok = window.confirm(`Refund ${rupees(o.totalPaise)} to the customer for order ${o.number}?\n\nThis sends the money back through Razorpay and cannot be undone.`);
    if (!ok) return;
    const res = await call(o, `/api/admin/orders/${o.id}/refund`, { method: "POST", body: "{}" });
    if ("unauth" in res) return toLogin();
    if (res.ok) {
      setRequested((prev) => new Set(prev).add(o.id));
      setNote({
        kind: "ok",
        text:
          res.j.status === "processed"
            ? `${o.number} was refunded.`
            : `Refund for ${o.number} has been started with Razorpay. The order shows Refunded once Razorpay confirms it.`,
      });
    } else {
      setNote({ kind: "err", text: res.j.error || "Refund failed" });
    }
    load();
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  const refundCount = orders?.filter((o) => o.needsRefund).length ?? 0;

  return (
    <main className={s.page}>
      <header className={s.top}>
        <div>
          <a href="/" className={s.brand}>VELORA</a>
          <h1 className={s.title}>Orders</h1>
        </div>
        <div className={s.who}>
          <a href="/admin/products" className={s.ghost} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Products</a>
          <span>{adminEmail}</span>
          <button type="button" className={s.ghost} onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className={s.tools}>
        <input
          type="search"
          className={s.search}
          placeholder="Search order number, email or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search orders"
        />
        <div className={s.chips} role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`${s.chip} ${filter === f.id ? s.chipOn : ""}`}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filter !== "NEEDS_REFUND" && refundCount > 0 && (
        <button type="button" className={s.banner} onClick={() => setFilter("NEEDS_REFUND")}>
          {refundCount} paid {refundCount === 1 ? "order was" : "orders were"} cancelled and still need a refund. Review now
        </button>
      )}

      {note && (
        <p className={note.kind === "ok" ? s.noteOk : s.noteErr} role="status">
          {note.text}
        </p>
      )}

      {loadError && (
        <div className={s.noteErr} role="alert">
          {loadError} <button type="button" className={s.link} onClick={load}>Try again</button>
        </div>
      )}

      <p className={s.count} aria-live="polite">
        {loading ? "Loading…" : orders ? `${orders.length} ${orders.length === 1 ? "order" : "orders"}${orders.length === 100 ? " (showing the latest 100)" : ""}` : ""}
      </p>

      <ul className={s.list}>
        {orders?.map((o) => {
          const busy = busyId === o.id;
          const asked = requested.has(o.id);
          const addr = address(o.shipTo);
          return (
            <li key={o.id} className={`${s.card} ${o.needsRefund ? s.cardAlert : ""}`}>
              <div className={s.row1}>
                <div>
                  <strong className={s.num}>{o.number}</strong>
                  <span className={s.date}>{when(o.createdAt)}</span>
                </div>
                <span className={s.pill} data-status={o.status}>{o.status.toLowerCase()}</span>
              </div>

              <div className={s.cols}>
                <div>
                  <h2 className={s.h}>Items</h2>
                  <ul className={s.items}>
                    {o.items.map((i, n) => (
                      <li key={n}>{i.qty} × {i.name}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h2 className={s.h}>Customer</h2>
                  <p className={s.small}>{o.email}</p>
                  {o.phone && <p className={s.small}>{o.phone}</p>}
                  {addr && <p className={s.small}>{addr}</p>}
                </div>
                <div className={s.money}>
                  <h2 className={s.h}>Total</h2>
                  <p className={s.total}>{rupees(o.totalPaise)}</p>
                  <p className={s.small}>Payment: {o.paymentStatus ? o.paymentStatus.toLowerCase() : "none"}</p>
                </div>
              </div>

              {o.needsRefund && <p className={s.alertText}>Cancelled after payment. This customer is owed a refund.</p>}

              {(o.next || o.canRefund) && (
                <div className={s.actions}>
                  {o.next && (
                    <button type="button" className={s.primary} disabled={busy} onClick={() => advance(o)}>
                      {busy ? "Working…" : ACTION_LABEL[o.next] ?? `Mark ${o.next.toLowerCase()}`}
                    </button>
                  )}
                  {o.canRefund && (
                    <button type="button" className={s.danger} disabled={busy || asked} onClick={() => refund(o)}>
                      {asked ? "Refund requested" : busy ? "Working…" : "Refund"}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!loading && !loadError && orders?.length === 0 && (
        <p className={s.empty}>No orders match. Clear the search or pick another filter.</p>
      )}
    </main>
  );
}
