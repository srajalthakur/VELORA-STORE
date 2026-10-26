import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import LoginForm from "./LoginForm";
import s from "./login.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in — VELORA", robots: { index: false, follow: false } };

/** Only same-site paths are allowed as a post-login destination (blocks open redirects like //evil.com). */
function safeNext(v: string | string[] | undefined): string | null {
  const x = Array.isArray(v) ? v[0] : v;
  return x && /^\/(?![/\\])/.test(x) ? x : null;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = safeNext((await searchParams).next);
  const user = await currentUser();
  if (user) redirect(next ?? (user.role === "ADMIN" ? "/admin/orders" : "/account"));

  const link = { color: "#c9a24b" } as const;
  return (
    <main className={s.page}>
      <section className={s.card} aria-labelledby="login-title">
        <a href="/" className={s.brand}>VELORA</a>
        <h1 id="login-title" className={s.title}>Sign in</h1>
        <p className={s.lede}>Access your account and the store dashboard.</p>
        <LoginForm next={next} />
        <p className={s.lede} style={{ margin: "20px 0 0" }}>
          <a href="/forgot-password" style={link}>Forgot your password?</a>
        </p>
        <p className={s.lede} style={{ margin: "8px 0 0" }}>
          New to VELORA? <a href="/register" style={link}>Create an account</a>
        </p>
      </section>
    </main>
  );
}
