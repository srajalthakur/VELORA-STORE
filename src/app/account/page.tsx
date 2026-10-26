import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { AddressBook, SignOut } from "./AccountClient";
import { ChangePassword, VerifyBanner } from "./AccountSecurity";
import { WishlistGrid } from "./WishlistGrid";
import OrderTimeline from "../track/OrderTimeline";
import { safeTrackingUrl, timeline } from "@/lib/tracking";
import s from "./account.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "My account — VELORA", robots: { index: false, follow: false } };

const rupees = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
// Fixed time zone so the server and browser always agree on the date shown.
const day = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");

  const [orders, addresses, me, saved] = await Promise.all([
    // Orders are matched on the account's id only. Matching on email would let anyone who signs up with someone else's email read their orders.
    prisma.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50, include: { items: true } }),
    prisma.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { id: "asc" }] }),
    prisma.user.findUnique({ where: { id: user.id }, select: { emailVerified: true } }),
    prisma.wishlistItem.findMany({
      where: { userId: user.id, product: { active: true } },
      take: 200,
      include: { product: { include: { images: { orderBy: { position: "asc" }, take: 1 }, variants: { where: { active: true }, include: { inventory: true } } } } },
    }),
  ]);
  const wishItems = saved
    .map((w) => w.product)
    .filter((p) => p.variants.length > 0)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      image: p.images[0] ? { url: p.images[0].url, alt: p.images[0].alt } : null,
      fromPaise: Math.min(...p.variants.map((v) => v.pricePaise)),
      inStock: p.variants.some((v) => (v.inventory?.onHand ?? 0) - (v.inventory?.reserved ?? 0) > 0),
    }));

  return (
    <main className={s.page}>
      <header className={s.top}>
        <div>
          <a href="/" className={s.brand}>VELORA</a>
          <h1 className={s.title}>My account</h1>
          <p className={s.who}>{user.name ? `${user.name} · ` : ""}{user.email}{me?.emailVerified ? " · email confirmed" : ""}</p>
        </div>
        <SignOut />
      </header>

      {!me?.emailVerified && <VerifyBanner email={user.email} />}

      <section aria-labelledby="orders-h">
        <h2 id="orders-h" className={s.h2}>Orders</h2>
        {orders.length === 0 ? (
          <p className={s.empty}>You have no orders yet. <a href="/">Continue shopping</a></p>
        ) : (
          <ul className={s.orders}>
            {orders.map((o) => (
              <li key={o.id} className={s.order}>
                <div className={s.orow}>
                  <div>
                    <strong className={s.num}>{o.number}</strong>
                    <span className={s.date}>{day(o.createdAt)}</span>
                  </div>
                  <span className={s.pill} data-status={o.status}>{o.status.toLowerCase()}</span>
                </div>
                <ul className={s.items}>
                  {o.items.map((i) => (
                    <li key={i.id}>{i.qty} × {i.name}</li>
                  ))}
                </ul>
                <p className={s.total}>{rupees(o.totalPaise)}</p>
                {o.status !== "PENDING" && (
                  <details className={s.track}>
                    <summary>Track this order</summary>
                    <OrderTimeline t={{ timeline: timeline(o), carrier: o.carrier, trackingNumber: o.trackingNumber, trackingUrl: safeTrackingUrl(o.trackingUrl) }} />
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="wish-h">
        <h2 id="wish-h" className={s.h2}>Wishlist</h2>
        <WishlistGrid items={wishItems} />
      </section>

      <section aria-labelledby="addr-h">
        <h2 id="addr-h" className={s.h2}>Saved addresses</h2>
        <AddressBook
          addresses={addresses.map((a) => ({ id: a.id, fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, state: a.state, pin: a.pin, isDefault: a.isDefault }))}
        />
      </section>

      <section aria-labelledby="pw-h">
        <h2 id="pw-h" className={s.h2}>Password</h2>
        <ChangePassword />
      </section>
    </main>
  );
}
