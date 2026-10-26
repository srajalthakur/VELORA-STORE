import TrackClient from "./TrackClient";
import s from "./track.module.css";
export const metadata = { title: "Track your order — VELORA" };

export default function TrackPage() {
  return (
    <main className={s.page}>
      <a href="/" className={s.brand}>VELORA</a>
      <h1 className={s.title}>Track your order</h1>
      <p className={s.lead}>Enter the order number from your confirmation and the email you used at checkout. Signed-in customers can also see every order in <a href="/account" style={{ color: "#c9a24b" }}>their account</a>.</p>
      <TrackClient />
      <a href="/" className={s.back}>Back to the store</a>
    </main>
  );
}
