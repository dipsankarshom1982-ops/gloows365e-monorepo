// apps/tutor-mobile/app/(app)/reviews.tsx
// RN mirror of apps/tutor's (app)/reviews/page.tsx — see its header
// comment for the full reasoning (same useTutorReviews hook, same
// replyToTutorReview callable, same closed-write firestore.rules).

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { useTutorReviews, useTutorProfile, type TutorReview } from "@gloows/shared-logic";
import { functions } from "@/lib/firebase";
import { Button, Card, EmptyState, Input, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const replyToTutorReviewCall = httpsCallable<
  { reviewId: string; replyText: string },
  { reviewId: string; tutorReply: string }
>(functions, "replyToTutorReview");

export default function ReviewsScreen() {
  const { t } = useTranslation();
  const { user } = useTutorProfile();
  const { reviews, loading } = useTutorReviews(user?.uid);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <View style={{ flex: 1, paddingTop: spacing.xl, paddingBottom: 100 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary, paddingHorizontal: spacing.xl, marginBottom: spacing.xl }}>
          {t("myReviewsTitle")}
        </Text>

        {loading ? (
          <LoadingState />
        ) : reviews.length === 0 ? (
          <EmptyState title={t("noReviewsTitle")} subtitle={t("noReviewsSubtitle")} />
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md }} showsVerticalScrollIndicator={false}>
            {reviews.map((r) => <ReviewCard key={r.id} review={r} t={t} />)}
          </ScrollView>
        )}
      </View>
      <BottomNav />
    </SafeAreaView>
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
      setEditing(false);
    } catch (e: any) {
      setError(e?.message ?? "Could not post your reply.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ fontWeight: "700", color: semantic.textPrimary }}>{review.studentName || "Student"}</Text>
        <Text style={{ fontSize: 12, fontWeight: "800", color: semantic.textPrimary }}>{"⭐".repeat(review.rating)}</Text>
      </View>
      {!!review.subject && <Text style={{ fontSize: 12, color: semantic.textMuted, marginTop: 4 }}>{review.subject}</Text>}
      {!!review.reviewText && (
        <Text style={{ fontSize: 12, color: semantic.textSecondary, marginTop: spacing.md, lineHeight: 18 }}>{review.reviewText}</Text>
      )}

      {!editing && !!review.tutorReply && (
        <View style={{ marginTop: spacing.md, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: semantic.accent }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: semantic.accent }}>{t("yourReplyLabel")}</Text>
          <Text style={{ fontSize: 12, color: semantic.textSecondary, marginTop: 2, lineHeight: 18 }}>{review.tutorReply}</Text>
          <TouchableOpacity onPress={() => setEditing(true)} style={{ marginTop: spacing.sm }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: semantic.accent }}>{t("editReply")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!editing && !review.tutorReply && (
        <TouchableOpacity onPress={() => setEditing(true)} style={{ marginTop: spacing.md }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: semantic.accent }}>{t("replyToReview")}</Text>
        </TouchableOpacity>
      )}

      {editing && (
        <View style={{ marginTop: spacing.md }}>
          <Input
            value={text}
            onChangeText={setText}
            placeholder={t("replyPlaceholder")}
            maxLength={500}
            multiline
            numberOfLines={3}
            style={{ minHeight: 72, textAlignVertical: "top" }}
          />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                title={saving ? t("postingReply") : t("postReply")}
                onPress={submit}
                loading={saving}
                disabled={!text.trim()}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={t("cancel")}
                variant="secondary"
                onPress={() => { setEditing(false); setText(review.tutorReply ?? ""); setError(""); }}
                disabled={saving}
              />
            </View>
          </View>
          {!!error && (
            <Text style={{ color: semantic.danger ?? "#ef4444", fontSize: 12, fontWeight: "600", marginTop: spacing.sm }}>{error}</Text>
          )}
        </View>
      )}
    </Card>
  );
}
