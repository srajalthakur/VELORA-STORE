import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import RegisterForm from "./RegisterForm";
import s from "../login/login.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create account — VELORA", robots: { index: false, follow: false } };

export default async function RegisterPage() {
  if (await currentUser()) redirect("/account");
  return (
    <main className={s.page}>
      <section className={s.card} aria-labelledby="reg-title">
        <a href="/" className={s.brand}>VELORA</a>
        <h1 id="reg-title" className={s.title}>Create account</h1>
        <p className={s.lede}>Track your orders and keep your delivery addresses ready for checkout.</p>
        <RegisterForm />
        <p className={s.lede} style={{ margin: "24px 0 0" }}>
          Already have an account? <a href="/login" style={{ color: "#c9a24b" }}>Sign in</a>
        </p>
      </section>
    </main>
  );
}
