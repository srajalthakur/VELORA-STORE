"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import s from "./account.module.css";

type Addr = { id: string; fullName: string; phone: string; line1: string; line2: string | null; city: string; state: string; pin: string; isDefault: boolean };
type Draft = { fullName: string; phone: string; line1: string; line2: string; city: string; state: string; pin: string; isDefault: boolean };
const EMPTY: Draft = { fullName: "", phone: "", line1: "", line2: "", city: "", state: "", pin: "", isDefault: false };

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (r.ok) return null;
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    return j.error || "Something went wrong. Try again.";
  } catch {
    return "Network problem. Nothing was changed. Try again.";
  }
}

export function SignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={s.ghost}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        router.replace("/login");
        router.refresh();
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

function AddressForm({ initial, onDone, onCancel, id }: { initial: Draft; id?: string; onDone: () => void; onCancel: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr("");
    setBusy(true);
    const body = { ...d, line2: d.line2.trim() || null };
    const m = id ? await send(`/api/account/addresses/${id}`, "PATCH", body) : await send("/api/account/addresses", "POST", body);
    setBusy(false);
    if (m) return setErr(m);
    onDone();
  }

  const field = (k: keyof Draft, label: string, extra: Record<string, string | number> = {}) => (
    <label className={s.f}>
      <span>{label}</span>
      <input className={s.in} value={d[k] as string} onChange={set(k)} disabled={busy} suppressHydrationWarning {...extra} />
    </label>
  );

  return (
    <form className={s.aform} onSubmit={submit} noValidate>
      {field("fullName", "Recipient name", { maxLength: 80, autoComplete: "name" })}
      {field("phone", "Mobile number", { inputMode: "tel", maxLength: 16, autoComplete: "tel" })}
      <div className={s.wide}>{field("line1", "Address", { maxLength: 120, autoComplete: "address-line1" })}</div>
      <div className={s.wide}>{field("line2", "Apartment, landmark (optional)", { maxLength: 120, autoComplete: "address-line2" })}</div>
      {field("city", "City", { maxLength: 60, autoComplete: "address-level2" })}
      {field("state", "State", { maxLength: 40, autoComplete: "address-level1" })}
      {field("pin", "PIN code", { inputMode: "numeric", maxLength: 6, autoComplete: "postal-code" })}
      <label className={`${s.chk} ${s.wide}`}>
        <input type="checkbox" checked={d.isDefault} onChange={(e) => setD((p) => ({ ...p, isDefault: e.target.checked }))} disabled={busy || initial.isDefault} />
        <span>Use as my default address</span>
      </label>
      {err && <p className={`${s.err} ${s.wide}`} role="alert">{err}</p>}
      <div className={`${s.btns} ${s.wide}`}>
        <button type="submit" className={s.save} disabled={busy}>{busy ? "Saving…" : "Save address"}</button>
        <button type="button" className={s.ghost} onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

export function AddressBook({ addresses }: { addresses: Addr[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () => {
    setEditing(null);
    router.refresh();
  };

  async function remove(a: Addr) {
    if (!window.confirm("Remove this address?")) return;
    setBusyId(a.id);
    setErr("");
    const m = await send(`/api/account/addresses/${a.id}`, "DELETE");
    setBusyId(null);
    if (m) setErr(m);
    else router.refresh();
  }

  const draft = (a: Addr): Draft => ({ fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2 ?? "", city: a.city, state: a.state, pin: a.pin, isDefault: a.isDefault });

  return (
    <div>
      {addresses.length === 0 && editing !== "new" && <p className={s.empty}>No saved addresses yet.</p>}
      {err && <p className={s.err} role="alert">{err}</p>}
      <ul className={s.addrs}>
        {addresses.map((a) => (
          <li key={a.id} className={s.addr}>
            {editing === a.id ? (
              <AddressForm id={a.id} initial={draft(a)} onDone={refresh} onCancel={() => setEditing(null)} />
            ) : (
              <>
                <p className={s.aname}>
                  {a.fullName} {a.isDefault && <span className={s.badge}>Default</span>}
                </p>
                <p className={s.aline}>{[a.line1, a.line2].filter(Boolean).join(", ")}</p>
                <p className={s.aline}>{a.city}, {a.state} {a.pin}</p>
                <p className={s.aline}>{a.phone}</p>
                <div className={s.btns}>
                  <button type="button" className={s.ghost} onClick={() => setEditing(a.id)} disabled={busyId === a.id}>Edit</button>
                  <button type="button" className={s.ghost} onClick={() => remove(a)} disabled={busyId === a.id}>Remove</button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {editing === "new" ? (
        <div className={s.addr}>
          <AddressForm initial={EMPTY} onDone={refresh} onCancel={() => setEditing(null)} />
        </div>
      ) : (
        <button type="button" className={s.save} onClick={() => setEditing("new")} disabled={addresses.length >= 10}>Add an address</button>
      )}
    </div>
  );
}
