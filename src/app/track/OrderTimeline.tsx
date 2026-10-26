import type { Timeline } from "@/lib/tracking";
import s from "./track.module.css";

// A fixed time zone so the server and the browser always show the same date.
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export type TrackView = { timeline: Timeline; carrier: string | null; trackingNumber: string | null; trackingUrl: string | null };

/** Progress steps plus courier details for one order. Plain markup, so it works on the server (account page) and in the browser (track page). */
export default function OrderTimeline({ t }: { t: TrackView }) {
  const { timeline, carrier, trackingNumber, trackingUrl } = t;
  return (
    <div>
      {timeline.terminal && (
        <p className={`${s.note} ${s.noteBad}`}>{timeline.terminal === "CANCELLED" ? "This order was cancelled." : "This order was refunded. The money returns to the original payment method."}</p>
      )}
      {timeline.awaitingPayment && <p className={s.note}>We are waiting for payment to be confirmed.</p>}
      <ol className={s.steps} aria-label="Order progress">
        {timeline.steps.map((st) => (
          <li key={st.key} className={`${s.step} ${st.done ? s.done : ""}`}>
            <span className={s.dot} aria-hidden="true" />
            <span>
              {st.label}{st.done ? "" : " (not yet)"}
              {st.at && <span className={s.when}>{day(st.at)}</span>}
            </span>
          </li>
        ))}
      </ol>
      {trackingNumber && (
        <p className={s.ship}>
          <strong>{carrier ?? "Courier"}</strong> · tracking number <strong>{trackingNumber}</strong>
          {trackingUrl && <> · <a href={trackingUrl} target="_blank" rel="noopener noreferrer">Track parcel</a></>}
        </p>
      )}
    </div>
  );
}
