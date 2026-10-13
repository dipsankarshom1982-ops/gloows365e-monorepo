"use client";
// apps/tutor/src/app/(app)/reviews/page.tsx
// Tutor reply to reviews phase — a tutor's own reviews (useTutorReviews,
// same hook the student-facing marketplace profile page already uses —
// its where(hidden==false) filter means a review an admin has hidden
// simply doesn't show up here either, matching what students see). Each
// review can carry one public reply from the tutor being reviewed
// (replyToTutorReview, Admin-SDK callable) — this page never writes
// tutorReviews/{id} directly, matching firestore.rules' `allow write: if
// false` on that collection, same closed-write pattern every other
// ShikshaHub screen here already follows.

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { useTutorReviews, useTutorProfile, type TutorReview } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import { Button, Card, EmptyState, LoadingState, Textarea } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const replyToTutorReviewCall = httpsCallable<
  { reviewId: string; replyText: string },
  { reviewId: string; tutorReply: string }
>(functions, "replyToTutorReview");

export default function ReviewsPage() {
  const { t } = useTutorT();
  const { user } = useTutorProfile();
  const { reviews, loading } = useTutorReviews(user?.uid);

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-xl font-black text-slate-100 mb-6">{t("myReviewsTitle")}</h1>

        {loading ? (
          <LoadingState />
        ) : reviews.length === 0 ? (
          <EmptyState title={t("noReviewsTitle")} subtitle={t("noReviewsSubtitle")} />
        ) : (
          <div className="flex flex-col gap-3">
            {reviews.map((r) => <ReviewCard key={r.id} review={r} t={t} />)}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

function ReviewCard({ review, t }: { review: TutorReview; t: (k: string) => string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(review.tutorReply ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setSaving(true);
    setError("");
    try {
      await replyToTutorReviewCall({ reviewId: review.id!, replyText: text });
      // No local mutation needed — useTutorReviews' onSnapshot listener
      // picks up the callable's Admin-SDK write automatically.
      setEditing(false);
    } catch (e: any) {
      setError(e?.message ?? "Could not post your reply.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-slate-100">{review.studentName || "Student"}</p>
        <span className="text-xs font-extrabold text-slate-100">{"⭐".repeat(review.rating)}</span>
      </div>
      {!!review.subject && <p className="text-xs text-slate-400 mt-1">{review.subject}</p>}
      {!!review.reviewText && <p className="text-xs text-slate-300 mt-3 leading-5">{review.reviewText}</p>}

      {!editing && !!review.tutorReply && (
        <div className="mt-3 pl-3 border-l-2 border-brand-500">
          <p className="text-[11px] font-extrabold text-brand-400">{t("yourReplyLabel")}</p>
          <p className="text-xs text-slate-300 mt-1 leading-5">{review.tutorReply}</p>
          <button onClick={() => setEditing(true)} className="text-[11px] font-bold text-brand-400 mt-2">
            {t("editReply")}
          </button>
        </div>
      )}

      {!editing && !review.tutorReply && (
        <button onClick={() => setEditing(true)} className="text-xs font-bold text-brand-400 mt-3">
          {t("replyToReview")}
        </button>
      )}

      {editing && (
        <div className="mt-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("replyPlaceholder")}
            maxLength={500}
            rows={3}
          />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={submit} disabled={saving || !text.trim()}>
              {saving ? t("postingReply") : t("postReply")}
            </Button>
            <Button
              variant="secondary" className="flex-1"
              onClick={() => { setEditing(false); setText(review.tutorReply ?? ""); setError(""); }}
              disabled={saving}
            >
              {t("cancel")}
            </Button>
          </div>
          {!!error && <p className="text-danger text-xs font-semibold mt-2">{error}</p>}
        </div>
      )}
    </Card>
  );
}
