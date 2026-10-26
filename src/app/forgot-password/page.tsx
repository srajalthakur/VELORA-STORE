import ForgotForm from "./ForgotForm";
import s from "../login/login.module.css";

export const metadata = { title: "Reset password — VELORA", robots: { index: false, follow: false } };

export default function ForgotPage() {
  return (
    <main className={s.page}>
      <section className={s.card} aria-labelledby="forgot-title">
        <a href="/" className={s.brand}>VELORA</a>
        <h1 id="forgot-title" className={s.title}>Reset password</h1>
        <p className={s.lede}>Enter your email and we will send you a link to choose a new password.</p>
        <ForgotForm />
        <p className={s.lede} style={{ margin: "24px 0 0" }}>
          <a href="/login" style={{ color: "#c9a24b" }}>Back to sign in</a>
        </p>
      </section>
    </main>
  );
}
