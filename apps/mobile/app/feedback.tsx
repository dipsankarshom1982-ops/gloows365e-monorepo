// PATH: apps/mobile/app/feedback.tsx
// Mirrors web src/app/(app)/settings/feedback/page.tsx
//
// Lets a student star-rate (1-5) whichever admin-configured features they
// want, plus leave one free-text improvement suggestion. One doc per
// student (feedback/{uid}) — editable, upsert: revisiting this screen
// pre-fills the last submission, resubmitting overwrites it.

import Header from "@/components/header";
import OnboardingGuard from "@/components/OnboardingGuard";
import StarRatingInput from "@/components/StarRatingInput";
import { useTheme } from "@/context/ThemeContext";
import {
  FeedbackFeature,
  getFeedbackFeatures,
  getMyFeedback,
  submitFeedback,
} from "@/services/feedbackService";
import { useStudentProfile } from "@gloows/shared-logic";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ACCENT = "#f59e0b";

// Signed-in students only: OnboardingGuard sends a signed-out visitor (deep
// link / stale screen after logout) to /login, same as the other root screens.
export default function FeedbackRoute() {
  return (
    <OnboardingGuard>
      <FeedbackScreen />
    </OnboardingGuard>
  );
}

function FeedbackScreen() {
  const { colors } = useTheme();
  const { user } = useStudentProfile();
  const router = useRouter();

  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState(false);
  const [features, setFeatures]     = useState<FeedbackFeature[]>([]);
  const [ratings, setRatings]       = useState<Record<string, number>>({});
  const [suggestion, setSuggestion] = useState("");
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [saveError, setSaveError]   = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const [feats, mine] = await Promise.all([
          getFeedbackFeatures(),
          getMyFeedback(user.uid),
        ]);
        setFeatures(feats);
        if (mine) {
          setRatings(mine.ratings);
          setSuggestion(mine.suggestion);
        }
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid]);

  const setRating = (featureId: string, value: number) => {
    setRatings((prev) => ({ ...prev, [featureId]: value }));
    setSaved(false);
  };

  const handleSubmit = async () => {
    if (!user?.uid || saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      await submitFeedback(user.uid, { ratings, suggestion });
      setSaved(true);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header hideMenu={true} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Title */}
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: ACCENT }]}>⭐ Feedback &amp; Ratings</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Rate the features you use and tell us how to make Gloows365 better.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 20 }} />
        ) : loadError ? (
          <View style={[styles.card, styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>⚠️</Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>
              Couldn't load feedback right now. Please try again later.
            </Text>
          </View>
        ) : features.length === 0 ? (
          <View style={[styles.card, styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🌱</Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>
              No features open for rating just yet.
            </Text>
          </View>
        ) : (
          <>
            {/* Feature ratings */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 16 }]}>
              {features.map((f) => (
                <View key={f.id} style={styles.featureRow}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {!!f.icon && <Text style={{ fontSize: 16 }}>{f.icon}</Text>}
                      <Text style={[styles.featureName, { color: colors.text }]}>{f.name}</Text>
                    </View>
                    {!!f.description && (
                      <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>{f.description}</Text>
                    )}
                  </View>
                  <StarRatingInput
                    value={ratings[f.id] ?? 0}
                    onChange={(v) => setRating(f.id, v)}
                    size={22}
                    color={ACCENT}
                    emptyColor={colors.border}
                  />
                </View>
              ))}
            </View>

            {/* Suggestion */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>💡 Suggest an improvement</Text>
              <TextInput
                value={suggestion}
                onChangeText={(t) => { setSuggestion(t); setSaved(false); }}
                maxLength={1000}
                multiline
                numberOfLines={4}
                placeholder="What would make Gloows365 better for you?"
                placeholderTextColor={colors.textSecondary}
                style={[styles.textarea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              />
              <Text style={[styles.charCount, { color: colors.textSecondary }]}>{suggestion.length}/1000</Text>
            </View>

            {saved && (
              <View style={styles.savedBanner}>
                <Text style={styles.savedText}>✓ Thanks for your feedback!</Text>
              </View>
            )}
            {saveError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>Couldn't save your feedback. Please try again.</Text>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: ACCENT, opacity: saving ? 0.7 : 1 }]}
              disabled={saving}
              onPress={handleSubmit}
              activeOpacity={0.85}
            >
              <Text style={styles.submitBtnText}>{saving ? "Saving…" : "Submit Feedback"}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Back */}
        <TouchableOpacity
          style={[styles.backBtn, { borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
          <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  titleWrap: { paddingVertical: 16 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 13, fontWeight: "500", lineHeight: 20 },

  card: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  emptyCard: { alignItems: "center" },
  cardTitle: { fontSize: 14, fontWeight: "700", marginBottom: 10 },

  featureRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  featureName: { fontSize: 14, fontWeight: "700" },
  featureDesc: { fontSize: 11, fontWeight: "500", marginTop: 2 },

  textarea: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 13, textAlignVertical: "top", minHeight: 90 },
  charCount: { textAlign: "right", fontSize: 11, marginTop: 4 },

  savedBanner: { padding: 12, borderRadius: 12, backgroundColor: "rgba(34,197,94,0.12)", borderWidth: 1, borderColor: "rgba(34,197,94,0.3)", alignItems: "center", marginBottom: 12 },
  savedText: { fontSize: 13, fontWeight: "700", color: "#22c55e" },
  errorBanner: { padding: 12, borderRadius: 12, backgroundColor: "rgba(248,113,113,0.12)", borderWidth: 1, borderColor: "rgba(248,113,113,0.3)", alignItems: "center", marginBottom: 12 },
  errorText: { fontSize: 13, fontWeight: "700", color: "#F87171" },

  submitBtn: { paddingVertical: 14, borderRadius: 12, alignItems: "center", marginBottom: 20 },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  backBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  backBtnText: { fontSize: 14, fontWeight: "700" },
});
