"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MAX_PAISE, MAX_STOCK, MIN_PAISE, paiseToRupees, rupeesToPaise } from "@/lib/money";
import { AddVariant, ImagesPanel, type ImageBody, type Img, type NewVariant } from "./ProductExtras";
import s from "./products.module.css";

type Variant ={ id: string; sku: string; name: string; pricePaise: number; comparePaise: number | null; active: boolean; onHand: number; reserved: number };
type Product = { id: string; slug: string; name: string; description: string; specs: string[]; badge: string | null; active: boolean; category: string; images: Img[]; variants: Variant[] };
type Category = { id: string; name: string };
type Note = { kind: "ok" | "err"; text: string } | null;
type Result = { ok: boolean; status: number; error: string };
type VariantBody = { pricePaise: number; comparePaise: number | null; onHand: number; active: boolean };

async function send(url: string, method: string, body?: unknown): Promise<Result> {
  try {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    return { ok: r.ok, status: r.status, error: j.error ?? "" };
  } catch {
    return { ok: false, status: 0, error: "Network problem. Nothing was changed. Try again." };
  }
}

const slugify = (t: string) =>
  t.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

const PRICE_HELP = `Enter a price from ${MIN_PAISE / 100} to ${MAX_PAISE / 100} rupees, like 92500 or 1850.50`;

/* ---------- one variant (finish) row ---------- */
function VariantRow({ v, onSave }: { v: Variant; onSave: (v: Variant, body: VariantBody) => Promise<string | null> }) {
  const [price, setPrice] = useState(paiseToRupees(v.pricePaise));
  const [compare, setCompare] = useState(v.comparePaise ? paiseToRupees(v.comparePaise) : "");
  const [stock, setStock] = useState(String(v.onHand));
  const [active, setActive] = useState(v.active);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const pp = rupeesToPaise(price);
  const compareBlank = compare.trim() === "";
  const cp = compareBlank ? null : rupeesToPaise(compare);
  const st = /^\d{1,6}$/.test(stock.trim()) ? Number(stock.trim()) : null;
  const dirty = pp !== v.pricePaise || cp !== v.comparePaise || st !== v.onHand || active !== v.active;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !dirty) return;
    if (pp === null || pp < MIN_PAISE || pp > MAX_PAISE) return setErr(PRICE_HELP);
    if (!compareBlank && (cp === null || cp < MIN_PAISE || cp > MAX_PAISE)) return setErr("Compare-at price must be an amount like 120000, or left empty");
    if (cp !== null && cp <= pp) return setErr("Compare-at price must be higher than the price");
    if (st === null || st > MAX_STOCK) return setErr(`Stock must be a whole number from 0 to ${MAX_STOCK}`);
    if (st < v.reserved) return setErr(`${v.reserved} ${v.reserved === 1 ? "unit is" : "units are"} held in open checkouts, so stock cannot be lower than ${v.reserved}`);
    setErr("");
    setBusy(true);
    const m = await onSave(v, { pricePaise: pp, comparePaise: cp, onHand: st, active });
    setBusy(false);
    if (m) setErr(m);
  }

  return (
    <form className={s.vrow} onSubmit={submit} noValidate>
      <div className={s.vname}>
        <strong>{v.name}</strong>
        <span>{v.sku}</span>
      </div>
      <label className={s.f}>
        <span>Price (₹)</span>
        <input className={s.in} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} disabled={busy} suppressHydrationWarning />
      </label>
      <label className={s.f}>
        <span>Compare-at (₹)</span>
        <input className={s.in} inputMode="decimal" value={compare} placeholder="none" onChange={(e) => setCompare(e.target.value)} disabled={busy} suppressHydrationWarning />
      </label>
      <label className={s.f}>
        <span>In stock</span>
        <input className={s.in} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} disabled={busy} suppressHydrationWarning />
        <small className={s.hint}>{v.reserved > 0 ? `${v.reserved} held in checkouts` : `${Math.max(0, v.onHand - v.reserved)} available`}</small>
      </label>
      <label className={s.chk}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={busy} />
        <span>On sale</span>
      </label>
      <button type="submit" className={s.save} disabled={!dirty || busy}>{busy ? "Saving…" : "Save"}</button>
      {err && <p className={s.err} role="alert">{err}</p>}
    </form>
  );
}

/* ---------- name / badge / description ---------- */
function DetailsForm({ p, onSave }: { p: Product; onSave: (body: { name: string; description: string; badge: string | null; specs: string[] }) => Promise<string | null> }) {
  const [name, setName] = useState(p.name);
  const [badge, setBadge] = useState(p.badge ?? "");
  const [desc, setDesc] = useState(p.description);
  const [specs, setSpecs] = useState(p.specs.join("\n"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const lines = specs.split("\n").map((l) => l.trim()).filter(Boolean);
  const dirty = name !== p.name || badge !== (p.badge ?? "") || desc !== p.description || lines.join("\n") !== p.specs.join("\n");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !dirty) return;
    if (!name.trim() || !desc.trim()) return setErr("The name and description cannot be empty");
    if (lines.length > 12) return setErr("Use at most 12 detail lines");
    if (lines.some((l) => l.length > 200)) return setErr("Each detail line must be 200 characters or fewer");
    setErr("");
    setBusy(true);
    const m = await onSave({ name: name.trim(), description: desc.trim(), badge: badge.trim() || null, specs: lines });
    setBusy(false);
    if (m) setErr(m);
  }

  return (
    <form className={s.details} onSubmit={submit} noValidate>
      <label className={s.f}>
        <span>Name</span>
        <input className={s.in} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} disabled={busy} suppressHydrationWarning />
      </label>
      <label className={s.f}>
        <span>Badge (optional)</span>
        <input className={s.in} value={badge} maxLength={30} placeholder="for example New" onChange={(e) => setBadge(e.target.value)} disabled={busy} suppressHydrationWarning />
      </label>
      <label className={`${s.f} ${s.wide}`}>
        <span>Description</span>
        <textarea className={s.in} rows={4} value={desc} maxLength={4000} onChange={(e) => setDesc(e.target.value)} disabled={busy} />
      </label>
      <label className={`${s.f} ${s.wide}`}>
        <span>Detail lines, one per line (shown as bullet points)</span>
        <textarea className={s.in} rows={5} value={specs} onChange={(e) => setSpecs(e.target.value)} disabled={busy} />
      </label>
      <div className={s.wide}>
        <button type="submit" className={s.save} disabled={!dirty || busy}>{busy ? "Saving…" : "Save details"}</button>
        {err && <p className={s.err} role="alert">{err}</p>}
      </div>
    </form>
  );
}

/* ---------- add a product ---------- */
function AddProduct({ categories, onCreate, onClose }: { categories: Category[]; onCreate: (body: object, name: string) => Promise<string | null>; onClose: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [badge, setBadge] = useState("");
  const [specs, setSpecs] = useState("");
  const [variantName, setVariantName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const pp = rupeesToPaise(price);
    const st = /^\d{1,6}$/.test(stock.trim()) ? Number(stock.trim()) : null;
    if (!name.trim()) return setErr("Enter a product name");
    if (!slug.trim()) return setErr("Enter a web address for the product");
    if (!categoryId) return setErr("Choose a category. If the list is empty, add categories to the database first.");
    if (!description.trim()) return setErr("Enter a description");
    if (!variantName.trim()) return setErr("Enter a finish or variant name, for example Noir");
    if (!sku.trim()) return setErr("Enter a SKU");
    if (pp === null || pp < MIN_PAISE || pp > MAX_PAISE) return setErr(PRICE_HELP);
    if (st === null || st > MAX_STOCK) return setErr(`Opening stock must be a whole number from 0 to ${MAX_STOCK}`);
    setErr("");
    setBusy(true);
    const m = await onCreate(
      {
        name: name.trim(), slug: slug.trim(), categoryId, description: description.trim(), badge: badge.trim() || null,
        specs: specs.split("\n").map((x) => x.trim()).filter(Boolean), variantName: variantName.trim(), sku: sku.trim(),
        pricePaise: pp, onHand: st, active: visible,
      },
      name.trim(),
    );
    setBusy(false);
    if (m) setErr(m);
    else onClose();
  }

  return (
    <form className={s.add} onSubmit={submit} noValidate>
      <h2 className={s.addTitle}>New product</h2>
      <div className={s.grid}>
        <label className={s.f}>
          <span>Name</span>
          <input className={s.in} value={name} maxLength={120} onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} disabled={busy} suppressHydrationWarning />
        </label>
        <label className={s.f}>
          <span>Web address (slug)</span>
          <input className={s.in} value={slug} maxLength={80} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }} disabled={busy} suppressHydrationWarning />
        </label>
        <label className={s.f}>
          <span>Category</span>
          <select className={s.in} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={busy}>
            {categories.length === 0 && <option value="">No categories yet</option>}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className={s.f}>
          <span>Badge (optional)</span>
          <input className={s.in} value={badge} maxLength={30} onChange={(e) => setBadge(e.target.value)} disabled={busy} suppressHydrationWarning />
        </label>
        <label className={`${s.f} ${s.wide}`}>
          <span>Description</span>
          <textarea className={s.in} rows={3} value={description} maxLength={4000} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
        </label>
        <label className={`${s.f} ${s.wide}`}>
          <span>Details, one per line (optional)</span>
          <textarea className={s.in} rows={3} value={specs} onChange={(e) => setSpecs(e.target.value)} disabled={busy} />
        </label>
        <label className={s.f}>
          <span>First finish or variant</span>
          <input className={s.in} value={variantName} maxLength={80} placeholder="for example Noir" onChange={(e) => setVariantName(e.target.value)} disabled={busy} suppressHydrationWarning />
        </label>
        <label className={s.f}>
          <span>SKU</span>
          <input className={s.in} value={sku} maxLength={40} onChange={(e) => setSku(e.target.value)} disabled={busy} suppressHydrationWarning />
        </label>
        <label className={s.f}>
          <span>Price (₹)</span>
          <input className={s.in} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} disabled={busy} suppressHydrationWarning />
        </label>
        <label className={s.f}>
          <span>Opening stock</span>
          <input className={s.in} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} disabled={busy} suppressHydrationWarning />
        </label>
      </div>
      <label className={s.chk}>
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} disabled={busy} />
        <span>Show on the storefront right away (leave unticked to add it hidden)</span>
      </label>
      {err && <p className={s.err} role="alert">{err}</p>}
      <div className={s.addActions}>
        <button type="submit" className={s.save} disabled={busy}>{busy ? "Adding…" : "Add product"}</button>
        <button type="button" className={s.ghost} onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

/* ---------- the screen ---------- */
export default function ProductsClient({ adminEmail }: { adminEmail: string }) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [note, setNote] = useState<Note>(null);
  const [adding, setAdding] = useState(false);
  const seq = useRef(0);

  const toLogin = useCallback(() => router.replace("/login?next=/admin/products"), [router]);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    setLoadError("");
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    try {
      const r = await fetch(`/api/admin/products?${p}`, { cache: "no-store" });
      if (mine !== seq.current) return;
      if (r.status === 401) return toLogin();
      const j = (await r.json().catch(() => ({}))) as { products?: Product[]; categories?: Category[]; error?: string };
      if (!r.ok || !j.products) throw new Error(j.error || "Could not load products");
      setProducts(j.products);
      setCategories(j.categories ?? []);
    } catch (e) {
      if (mine !== seq.current) return;
      setLoadError(e instanceof Error ? e.message : "Could not load products");
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [q, toLogin]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  /** Turns an API result into a message for the form that asked (null means success) and refreshes the list. */
  async function done(res: Result, okText: string): Promise<string | null> {
    if (res.status === 401) {
      toLogin();
      return "Please sign in again";
    }
    if (!res.ok) return res.error || "Something went wrong";
    setNote({ kind: "ok", text: okText });
    await load();
    return null;
  }

  const saveVariant = async (p: Product, v: Variant, body: VariantBody) => done(await send(`/api/admin/variants/${v.id}`, "PATCH", body), `Saved ${p.name}, ${v.name}.`);
  const saveDetails = async (p: Product, body: object) => done(await send(`/api/admin/products/${p.id}`, "PATCH", body), `Saved the details for ${p.name}.`);
  const createProduct = async (body: object, name: string) => done(await send("/api/admin/products", "POST", body), `${name} was added.`);
  const addVariant = async (p: Product, body: NewVariant) => done(await send(`/api/admin/products/${p.id}/variants`, "POST", body), `Added ${body.name} to ${p.name}.`);
  const addImage = async (p: Product, body: ImageBody) => done(await send(`/api/admin/products/${p.id}/images`, "POST", body), `Image added to ${p.name}.`);
  const saveImage = async (img: Img, body: ImageBody) => done(await send(`/api/admin/images/${img.id}`, "PATCH", body), "Image saved.");
  const removeImage = async (img: Img) => done(await send(`/api/admin/images/${img.id}`, "DELETE"), "Image removed.");
  const reorderImages = async (p: Product, ids: string[]) => done(await send(`/api/admin/products/${p.id}/images`, "PUT", { order: ids }), "Image order saved.");

  async function toggle(p: Product) {
    setNote(null);
    const m = await done(
      await send(`/api/admin/products/${p.id}`, "PATCH", { active: !p.active }),
      p.active ? `${p.name} is now hidden from the storefront.` : `${p.name} is now visible on the storefront.`,
    );
    if (m) setNote({ kind: "err", text: m });
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className={s.page}>
      <header className={s.top}>
        <div>
          <a href="/" className={s.brand}>VELORA</a>
          <h1 className={s.title}>Products</h1>
        </div>
        <div className={s.who}>
          <a href="/admin/orders" className={s.ghost}>Orders</a>
          <span>{adminEmail}</span>
          <button type="button" className={s.ghost} onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className={s.tools}>
        <input type="search" className={s.in} placeholder="Search name, web address or SKU" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" suppressHydrationWarning />
        {!adding && (
          <button type="button" className={s.save} onClick={() => { setNote(null); setAdding(true); }}>Add product</button>
        )}
      </div>

      {adding && <AddProduct categories={categories} onCreate={createProduct} onClose={() => setAdding(false)} />}

      {note && <p className={note.kind === "ok" ? s.noteOk : s.noteErr} role="status">{note.text}</p>}

      {loadError && (
        <div className={s.noteErr} role="alert">
          {loadError} <button type="button" className={s.link} onClick={load}>Try again</button>
        </div>
      )}

      <p className={s.count} aria-live="polite">
        {loading ? "Loading…" : products ? `${products.length} ${products.length === 1 ? "product" : "products"}` : ""}
      </p>

      <ul className={s.list}>
        {products?.map((p) => (
          <li key={p.id} className={`${s.card} ${p.active ? "" : s.cardHidden}`}>
            <div className={s.row1}>
              <div>
                <strong className={s.pname}>{p.name}</strong>
                <span className={s.meta}>{p.category} · /{p.slug}{p.badge ? ` · ${p.badge}` : ""}</span>
              </div>
              <div className={s.row1r}>
                <span className={s.pill} data-on={p.active}>{p.active ? "Visible" : "Hidden"}</span>
                <button type="button" className={s.ghost} onClick={() => toggle(p)}>{p.active ? "Hide" : "Show"}</button>
              </div>
            </div>

            <div className={s.vlist}>
              {p.variants.map((v) => (
                <VariantRow key={v.id} v={v} onSave={(vv, body) => saveVariant(p, vv, body)} />
              ))}
            </div>

            <AddVariant onAdd={(body) => addVariant(p, body)} />

            <details className={s.more}>
              <summary>Edit name, badge, description and detail lines</summary>
              <DetailsForm p={p} onSave={(body) => saveDetails(p, body)} />
            </details>

            <details className={s.more}>
              <summary>Images ({p.images.length})</summary>
              <ImagesPanel
                images={p.images}
                onAdd={(body) => addImage(p, body)}
                onSave={saveImage}
                onRemove={removeImage}
                onReorder={(ids) => reorderImages(p, ids)}
              />
            </details>
          </li>
        ))}
      </ul>

      {!loading && !loadError && products?.length === 0 && <p className={s.empty}>No products match. Clear the search, or add a product.</p>}
    </main>
  );
}
