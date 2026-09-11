// PATH: apps/admin/src/pages/TutorReviews.tsx
// ShikshaHub Phase 6 — admin moderation queue for tutor ratings & reviews.
// Same closed-write pattern as TutorPayouts.tsx: tutorReviews/{id} has
// `allow write: if false` in firestore.rules, so hiding/unhiding goes
// through functions/src/tutorReviews.ts's hideTutorReview callable, which
// also recomputes the tutor's ratingSum/ratingCount/ratingAverage inside
// the same transaction. This is "moderate, don't destroy" — hide/unhide a
// review rather than delete it, matching Feedback.tsx/Grievances.tsx.

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";

interface TutorReview {
  id: string;
  // Booking completion phase — a review comes from exactly one of these
  // two (never both), same presence/absence-is-the-signal pattern
  // bookings/{id} itself uses (see functions/src/tutorReviews.ts).
  sessionId?: string;
  bookingId?: string;
  studentUid: string;
  tutorUid: string;
  studentName?: string;
  subject?: string;
  rating: number;
  reviewText?: string;
  hidden: boolean;
  hiddenBy?: string;
  hiddenReason?: string;
  createdAt?: { toDate?: () => Date };
}

type Filter = "visible" | "hidden" | "all";

const hideTutorReviewFn = httpsCallable<
  { reviewId: string; hidden: boolean; reason?: string },
  { hidden: boolean }
>(functions, "hideTutorReview");

function fmtDate(ts?: { toDate?: () => Date }): string {
  const d = ts?.toDate?.();
  return d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export default function TutorReviews() {
  const [items, setItems] = useState<TutorReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("visible");
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "tutorReviews"), orderBy("createdAt", "desc")));
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorReview)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? items : items.filter((i) => (filter === "hidden" ? i.hidden : !i.hidden));
  const hiddenCount = items.filter((i) => i.hidden).length;

  async function handleHide(id: string) {
    const reason = window.prompt("Reason for hiding this review (not shown to the student or tutor):") ?? undefined;
    await run(id, () => hideTutorReviewFn({ reviewId: id, hidden: true, reason: reason || undefined }));
  }

  async function handleUnhide(id: string) {
    if (!window.confirm("Unhide this review? It will become publicly visible on the tutor's profile again.")) return;
    await run(id, () => hideTutorReviewFn({ reviewId: id, hidden: false }));
  }

  async function run(id: string, fn: () => Promise<unknown>) {
    setActingOn(id);
    setRowError((prev) => ({ ...prev, [id]: "" }));
    try {
      await fn();
      await load();
    } catch (e: any) {
      setRowError((prev) => ({ ...prev, [id]: e?.message ?? "Action failed." }));
    } finally {
      setActingOn(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">⭐ Tutor Reviews</h1>
        <p className="text-slate-400 text-sm mt-1">
          Moderate student reviews left after Instant Help sessions. Hiding a review removes it from the
          tutor's public profile and recomputes their rating average — it is not deleted.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["visible", "hidden", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors capitalize ${
              filter === f ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {f}
            {f === "hidden" && hiddenCount > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">{hiddenCount}</span>
            )}
          </button>
        ))}
        <button onClick={load} className="text-slate-400 hover:text-white text-xs border border-slate-700 rounded-lg px-3 py-2 transition-colors ml-auto">
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-16">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-slate-400 py-16">No {filter === "all" ? "" : filter} reviews.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-white font-bold">{item.studentName || "Unnamed student"}</div>
                  <div className="text-slate-500 text-xs font-mono">for {item.tutorUid.slice(0, 14)}…</div>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${item.hidden ? "bg-slate-700 text-slate-400" : "bg-green-500/15 text-green-400"}`}>
                  {item.hidden ? "Hidden" : "Visible"}
                </span>
              </div>

              <div className="bg-slate-800 rounded-xl p-3 space-y-1 text-sm">
                <div className="text-amber-400 font-bold">{"⭐".repeat(item.rating)}<span className="text-slate-600">{"⭐".repeat(5 - item.rating)}</span></div>
                {item.subject && <div className="text-slate-400 text-xs">{item.subject}</div>}
                {item.reviewText && <div className="text-slate-300 text-xs mt-1">{item.reviewText}</div>}
              </div>

              <div className="text-xs text-slate-400 space-y-0.5">
                <div>
                  {item.sessionId ? "Session" : "Booking"}:{" "}
                  <span className="text-slate-300 font-mono">{(item.sessionId ?? item.bookingId ?? "").slice(0, 14)}…</span>
                </div>
                <div>Left: {fmtDate(item.createdAt)}</div>
                {item.hidden && item.hiddenReason && <div className="text-slate-500 italic mt-1">Reason: {item.hiddenReason}</div>}
              </div>

              {item.hidden ? (
                <button
                  onClick={() => handleUnhide(item.id)}
                  disabled={actingOn === item.id}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50"
                >
                  {actingOn === item.id ? "Processing…" : "Unhide"}
                </button>
              ) : (
                <button
                  onClick={() => handleHide(item.id)}
                  disabled={actingOn === item.id}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-red-400 text-xs font-bold py-2 rounded-lg disabled:opacity-50"
                >
                  {actingOn === item.id ? "Processing…" : "Hide"}
                </button>
              )}
              {rowError[item.id] && <p className="text-red-400 text-xs font-semibold">{rowError[item.id]}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
