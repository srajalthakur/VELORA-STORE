import ResetForm from "./ResetForm";
import s from "../login/login.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose a new password — VELORA", robots: { index: false, follow: false } };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const t = (await searchParams).token;
  const token = Array.isArray(t) ? t[0] : t;
  return (
    <main className={s.page}>
      <section className={s.card} aria-labelledby="reset-title">
        <a href="/" className={s.brand}>VELORA</a>
        <h1 id="reset-title" className={s.title}>New password</h1>
        {token ? (
          <ResetForm token={token} />
        ) : (
          <p className={s.lede}>
            This link is incomplete. <a href="/forgot-password" style={{ color: "#c9a24b" }}>Request a new one</a>.
          </p>
        )}
      </section>
    </main>
  );
}
