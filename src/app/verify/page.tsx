import VerifyClient from "./VerifyClient";
import s from "../login/login.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirm email — VELORA", robots: { index: false, follow: false } };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const t = (await searchParams).token;
  const token = Array.isArray(t) ? t[0] : t;
  return (
    <main className={s.page}>
      <section className={s.card} aria-labelledby="verify-title">
        <a href="/" className={s.brand}>VELORA</a>
        <h1 id="verify-title" className={s.title}>Confirm your email</h1>
        {token ? (
          <VerifyClient token={token} />
        ) : (
          <p className={s.lede}>This link is incomplete. Request a new one from your <a href="/account" style={{ color: "#c9a24b" }}>account page</a>.</p>
        )}
      </section>
    </main>
  );
}
