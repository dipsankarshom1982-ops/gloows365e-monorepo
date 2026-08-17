// PATH: apps/mobile/app/shikshahub/[uid].tsx
// Specific-tutor landing page — real Expo Router dynamic segment (mobile
// has a native router, no static-export constraint unlike apps/web's
// ?id= query-string equivalent). No contact/enquiry action here —
// explicitly deferred, see the approved plan's Context section.

import { useTheme } from "@/context/ThemeContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { fetchTutorById, type MarketplaceTutor } from "@/lib/shikshahub";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ShikshaHubProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const [tutor, setTutor]     = useState<MarketplaceTutor | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!uid) return;
    fetchTutorById(uid)
      .then((tu) => { if (tu) setTutor(tu); else setNotFound(true); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [uid]);

  if (loading) {
    return (
      <SafeAreaView style={[S.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color="#14b8a6" size="large" />
      </SafeAreaView>
    );
  }

  if (notFound || !tutor) {
    return (
      <SafeAreaView style={[S.center, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 40 }}>🤔</Text>
        <Text style={[S.notFoundText, { color: colors.textSecondary }]}>
          {t("shikshaHubNotFound") ?? "This tutor profile isn't available anymore."}
        </Text>
        <TouchableOpacity style={S.backLink} onPress={() => router.replace("/shikshahub" as any)}>
          <Text style={S.backLinkText}>{t("browseShikshaHub") ?? "Browse ShikshaHub"}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={S.imageWrap}>
          {tutor.profilePic ? (
            <Image source={{ uri: tutor.profilePic }} style={S.image} resizeMode="cover" />
          ) : (
            <LinearGradient colors={["#0f766e", "#14b8a6"]} style={[S.image, S.center]}>
              <Text style={{ fontSize: 56 }}>🧑‍🏫</Text>
            </LinearGradient>
          )}
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={{ padding: 20, gap: 12 }}>
          <Text style={[S.name, { color: colors.text }]}>{tutor.name || "Tutor"}</Text>

          {tutor.subjects.length > 0 && (
            <View style={S.chipRow}>
              {tutor.subjects.map((s) => (
                <Text key={s} style={S.subjectChip}>{s}</Text>
              ))}
            </View>
          )}

          {!!tutor.qualification && (
            <Field label={t("shikshaHubQualificationLabel") ?? "Qualification"} value={tutor.qualification} colors={colors} />
          )}
          {tutor.teachingExperienceYears != null && (
            <Field label={t("shikshaHubExperienceLabel") ?? "Experience"} value={`${tutor.teachingExperienceYears} years`} colors={colors} />
          )}
          {!!tutor.preferredLanguage && (
            <Field label={t("shikshaHubLanguageLabel") ?? "Preferred Language"} value={tutor.preferredLanguage} colors={colors} />
          )}
          {!!tutor.bio && (
            <View style={{ marginTop: 4 }}>
              <Text style={[S.fieldLabel, { color: colors.textSecondary }]}>{t("shikshaHubBioLabel") ?? "About"}</Text>
              <Text style={[S.bio, { color: colors.text }]}>{tutor.bio}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View>
      <Text style={[S.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[S.fieldValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  notFoundText: { fontSize: 14, fontWeight: "600" },
  backLink: { marginTop: 4, backgroundColor: "#14b8a6", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  backLinkText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  imageWrap: { position: "relative" },
  image: { width: "100%", height: 220 },
  backBtn: { position: "absolute", top: 14, left: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },

  name: { fontSize: 22, fontWeight: "900" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subjectChip: { fontSize: 11, fontWeight: "700", color: "#14b8a6", borderWidth: 1, borderColor: "#14b8a6", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },

  fieldLabel: { fontSize: 11, fontWeight: "700", marginBottom: 2 },
  fieldValue: { fontSize: 14, fontWeight: "600" },
  bio: { fontSize: 13, lineHeight: 20, fontWeight: "500" },
});
