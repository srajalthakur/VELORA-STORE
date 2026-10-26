"use client";

import { useState, type FormEvent } from "react";
import { MAX_PAISE, MAX_STOCK, MIN_PAISE, rupeesToPaise } from "@/lib/money";
import { isSafeImageUrl } from "@/lib/imageurl";
import s from "./products.module.css";
import x from "./extras.module.css";

export type Img = { id: string; url: string; alt: string; position: number };
export type NewVariant = { name: string; sku: string; pricePaise: number; onHand: number; active: boolean };
export type ImageBody = { url: string; alt: string };

const MAX_IMAGES = 12;
const URL_HELP = "Use a full https:// address, or a path to a file in your public folder, like /images/tote-noir.jpg";
const ALT_HELP = "Describe the image in a few words (screen readers read this aloud)";

/* ---------- add another finish to a product ---------- */
export function AddVariant({ onAdd }: { onAdd: (b: NewVariant) => Promise<string | null> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const pp = rupeesToPaise(price);
    const st = /^\d{1,6}$/.test(stock.trim()) ? Number(stock.trim()) : null;
    if (!name.trim()) return setErr("Enter a finish or variant name, for example Champagne dial");
    if (!sku.trim()) return setErr("Enter a SKU");
    if (pp === null || pp < MIN_PAISE || pp > MAX_PAISE) return setErr(`Enter a price from ${MIN_PAISE / 100} to ${MAX_PAISE / 100} rupees, like 92500 or 1850.50`);
    if (st === null || st > MAX_STOCK) return setErr(`Opening stock must be a whole number from 0 to ${MAX_STOCK}`);
    setErr("");
    setBusy(true);
    const m = await onAdd({ name: name.trim(), sku: sku.trim(), pricePaise: pp, onHand: st, active });
    setBusy(false);
    if (m) return setErr(m);
    setName("");
    setSku("");
    setPrice("");
    setStock("0");
    setActive(true);
    setOpen(false);
  }

  if (!open) {
    return (
      <div className={x.addVar}>
        <button type="button" className={s.ghost} onClick={() => setOpen(true)}>Add another finish</button>
      </div>
    );
  }

  return (
    <form className={x.varForm} onSubmit={submit} noValidate>
      <label className={s.f}>
        <span>Finish or variant name</span>
        <input className={s.in} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} disabled={busy} suppressHydrationWarning />
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
      <label className={`${s.chk} ${s.wide}`}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={busy} />
        <span>On sale right away</span>
      </label>
      {err && <p className={s.err} role="alert">{err}</p>}
      <div className={`${x.btns} ${s.wide}`}>
        <button type="submit" className={s.save} disabled={busy}>{busy ? "Adding…" : "Add finish"}</button>
        <button type="button" className={s.ghost} onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

/* ---------- one image ---------- */
function ImageRow({
  img, index, count, onSave, onRemove, onMove,
}: {
  img: Img;
  index: number;
  count: number;
  onSave: (img: Img, b: ImageBody) => Promise<string | null>;
  onRemove: (img: Img) => Promise<string | null>;
  onMove: (from: number, to: number) => Promise<string | null>;
}) {
  const [url, setUrl] = useState(img.url);
  const [alt, setAlt] = useState(img.alt);
  const [brokenUrl, setBrokenUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dirty = url.trim() !== img.url || alt.trim() !== img.alt;

  async function run(job: () => Promise<string | null>) {
    setBusy(true);
    setErr("");
    const m = await job();
    setBusy(false);
    if (m) setErr(m);
  }

  function save(e: FormEvent) {
    e.preventDefault();
    if (busy || !dirty) return;
    if (!isSafeImageUrl(url.trim())) return setErr(URL_HELP);
    if (!alt.trim()) return setErr(ALT_HELP);
    void run(() => onSave(img, { url: url.trim(), alt: alt.trim() }));
  }

  function remove() {
    if (busy) return;
    if (!window.confirm("Remove this image from the product? The image file itself is not deleted.")) return;
    void run(() => onRemove(img));
  }

  return (
    <form className={x.imgRow} onSubmit={save} noValidate>
      <div className={x.thumbBox}>
        {brokenUrl === img.url ? <span>No preview</span> : <img key={img.url} src={img.url} alt="" className={x.thumb} onError={() => setBrokenUrl(img.url)} />}
      </div>
      <label className={s.f}>
        <span>Image address</span>
        <input className={s.in} value={url} maxLength={500} onChange={(e) => setUrl(e.target.value)} disabled={busy} suppressHydrationWarning />
      </label>
      <label className={s.f}>
        <span>Describe the image</span>
        <input className={s.in} value={alt} maxLength={200} onChange={(e) => setAlt(e.target.value)} disabled={busy} suppressHydrationWarning />
      </label>
      <div className={x.imgBtns}>
        <button type="button" className={s.ghost} aria-label="Move image earlier" disabled={busy || index === 0} onClick={() => void run(() => onMove(index, index - 1))}>↑</button>
        <button type="button" className={s.ghost} aria-label="Move image later" disabled={busy || index === count - 1} onClick={() => void run(() => onMove(index, index + 1))}>↓</button>
        <button type="submit" className={s.save} disabled={!dirty || busy}>Save</button>
        <button type="button" className={s.ghost} onClick={remove} disabled={busy}>Remove</button>
      </div>
      {err && <p className={s.err} role="alert">{err}</p>}
    </form>
  );
}

/* ---------- a product's images ---------- */
export function ImagesPanel({
  images, onAdd, onSave, onRemove, onReorder,
}: {
  images: Img[];
  onAdd: (b: ImageBody) => Promise<string | null>;
  onSave: (img: Img, b: ImageBody) => Promise<string | null>;
  onRemove: (img: Img) => Promise<string | null>;
  onReorder: (ids: string[]) => Promise<string | null>;
}) {
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const move = (from: number, to: number): Promise<string | null> => {
    const ids = images.map((i) => i.id);
    const id = ids[from];
    if (id === undefined) return Promise.resolve(null);
    ids.splice(from, 1);
    ids.splice(to, 0, id);
    return onReorder(ids);
  };

  async function add(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!isSafeImageUrl(url.trim())) return setErr(URL_HELP);
    if (!alt.trim()) return setErr(ALT_HELP);
    setErr("");
    setBusy(true);
    const m = await onAdd({ url: url.trim(), alt: alt.trim() });
    setBusy(false);
    if (m) return setErr(m);
    setUrl("");
    setAlt("");
  }

  return (
    <div className={x.imgs}>
      <p className={x.imgNote}>The first image is the main one. Images are added by address: paste a link, or put the file in your project&apos;s public folder and use a path like /images/tote-noir.jpg.</p>

      {images.length === 0 && <p className={x.imgNote}>No images yet.</p>}
      <ul className={x.imgList}>
        {images.map((img, i) => (
          <li key={img.id}>
            <ImageRow img={img} index={i} count={images.length} onSave={onSave} onRemove={onRemove} onMove={move} />
          </li>
        ))}
      </ul>

      {images.length < MAX_IMAGES ? (
        <form className={x.addImg} onSubmit={add} noValidate>
          <label className={s.f}>
            <span>New image address</span>
            <input className={s.in} value={url} maxLength={500} placeholder="https://… or /images/…" onChange={(e) => setUrl(e.target.value)} disabled={busy} suppressHydrationWarning />
          </label>
          <label className={s.f}>
            <span>Describe the image</span>
            <input className={s.in} value={alt} maxLength={200} onChange={(e) => setAlt(e.target.value)} disabled={busy} suppressHydrationWarning />
          </label>
          <button type="submit" className={s.save} disabled={busy}>{busy ? "Adding…" : "Add image"}</button>
          {err && <p className={s.err} role="alert">{err}</p>}
        </form>
      ) : (
        <p className={x.imgNote}>This product has the maximum of {MAX_IMAGES} images.</p>
      )}
    </div>
  );
}
