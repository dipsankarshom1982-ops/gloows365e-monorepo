// PATH: apps/mobile/app/(drawer)/(tabs)/shikshahub.tsx
// ShikshaHub — browsable marketplace of verified Gloows Tutor profiles.
// Mirrors apps/web/src/app/(app)/shikshahub/page.tsx. Registered as a tab
// via ALL_SCREENS + DEFAULT_MODULES in ../_layout.tsx and the Firestore
// appModules/shikshahub doc (see apps/admin/src/pages/AppModules.tsx).

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useStudentProfile } from "@gloows/shared-logic";
import { useAppTranslation } from "@/context/LanguageContext";
import {
  deriveSubjectChips,
  fetchAllTutors,
  type MarketplaceTutor,
} from "@/lib/shikshahub";
import { router } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "@/components/header";

type SortMode = "name" | "rating";
// See apps/web/src/app/(app)/shikshahub/page.tsx's mirrored comment —
// fixed sessionFee buckets, no typed min/max, same reasoning.
type PriceBand = "under500" | "500to1000" | "1000plus";

export default function ShikshaHubHomeScreen() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const { user, authLoading } = useStudentProfile();
  const [tutors, setTutors]   = useState<MarketplaceTutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [minRating, setMinRating] = useState<number | null>(null);
  const [priceBand, setPriceBand] = useState<PriceBand | null>(null);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [minExperience, setMinExperience] = useState<number | null>(null);

  useEffect(() => {
    fetchAllTutors().then(setTutors).finally(() => setLoading(false));
  }, []);

  const subjectChips = useMemo(() => deriveSubjectChips(tutors), [tutors]);
  const filtered = useMemo(() => {
    let result = subject ? tutors.filter((tu) => tu.subjects.includes(subject)) : tutors;
    if (minRating != null) {
      result = result.filter((tu) => tu.ratingAverage != null && tu.ratingAverage >= minRating);
    }
    if (priceBand != null) {
      result = result.filter((tu) => {
        if (tu.sessionFee == null) return false;
        if (priceBand === "under500") return tu.sessionFee < 500;
        if (priceBand === "500to1000") return tu.sessionFee >= 500 && tu.sessionFee <= 1000;
        return tu.sessionFee > 1000;
      });
    }
    if (onlineOnly) {
      result = result.filter((tu) => tu.isOnlineForInstantHelp);
    }
    if (minExperience != null) {
      result = result.filter((tu) => tu.teachingExperienceYears != null && tu.teachingExperienceYears >= minExperience);
    }
    if (sortMode === "rating") {
      result = [...result].sort((a, b) => {
        const ar = a.ratingAverage ?? -1;
        const br = b.ratingAverage ?? -1;
        if (ar !== br) return br - ar;
        return a.name.localeCompare(b.name);
      });
    }
    return result;
  }, [tutors, subject, sortMode, minRating, priceBand, onlineOnly, minExperience]);

  if (!authLoading && !user) {
    return (
      <SafeAreaView style={[S.container, { backgroundColor: colors.background }]}>
        <Header />
        <View style={S.center}>
          <Text style={[S.emptyTitle, { color: colors.text }]}>{t("shikshaHubSignIn") ?? "Sign in to browse ShikshaHub"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]}>
      <Header />

      <View style={S.titleWrap}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={[S.title, { color: colors.text }]}>🎓 {t("shikshaHubTitle") ?? "ShikshaHub"}</Text>
            <Text style={[S.subtitle, { color: colors.textSecondary }]}>
              {t("shikshaHubSubtitle") ?? "Verified tutors, ready to teach — browse and find the right fit"}
            </Text>
          </View>
          <View style={{ gap: 6 }}>
            <TouchableOpacity
              onPress={() => router.push("/shikshahub/bookings")}
              style={S.myBookingsBtn}
            >
              <Text style={S.myBookingsBtnText}>{t("shikshaHubMyBookingsTitle") ?? "My Bookings"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/shikshahub/messages")}
              style={S.myBookingsBtn}
            >
              <Text style={S.myBookingsBtnText}>💬 {t("shikshaHubMessagesTitle") ?? "Messages"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {!loading && subjectChips.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.chipRow}>
          <Chip label={t("shikshaHubAllSubjects") ?? "All"} active={subject === null} onPress={() => setSubject(null)} />
          {subjectChips.map((s) => (
            <Chip key={s} label={s} active={subject === s} onPress={() => setSubject(s)} />
          ))}
        </ScrollView>
      )}

      {!loading && tutors.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.chipRow}>
          <Chip label={t("shikshaHubSortByName") ?? "Name"} active={sortMode === "name"} onPress={() => setSortMode("name")} />
          <Chip label={`⭐ ${t("shikshaHubSortByRating") ?? "Top rated"}`} active={sortMode === "rating"} onPress={() => setSortMode("rating")} />
          <View style={{ width: 1, alignSelf: "stretch", backgroundColor: colors.border, marginHorizontal: 2 }} />
          <Chip label={t("shikshaHubAllRatings") ?? "All ratings"} active={minRating === null} onPress={() => setMinRating(null)} />
          <Chip label="4★+" active={minRating === 4} onPress={() => setMinRating(4)} />
          <Chip label="3★+" active={minRating === 3} onPress={() => setMinRating(3)} />
          <View style={{ width: 1, alignSelf: "stretch", backgroundColor: colors.border, marginHorizontal: 2 }} />
          <Chip label={t("shikshaHubAnyPrice") ?? "Any price"} active={priceBand === null} onPress={() => setPriceBand(null)} />
          <Chip label={t("shikshaHubPriceUnder500") ?? "Under ₹500"} active={priceBand === "under500"} onPress={() => setPriceBand("under500")} />
          <Chip label={t("shikshaHubPrice500to1000") ?? "₹500–1000"} active={priceBand === "500to1000"} onPress={() => setPriceBand("500to1000")} />
          <Chip label={t("shikshaHubPrice1000Plus") ?? "₹1000+"} active={priceBand === "1000plus"} onPress={() => setPriceBand("1000plus")} />
          <View style={{ width: 1, alignSelf: "stretch", backgroundColor: colors.border, marginHorizontal: 2 }} />
          <Chip label={`🟢 ${t("shikshaHubOnlineNow") ?? "Online now"}`} active={onlineOnly} onPress={() => setOnlineOnly((v) => !v)} />
          <View style={{ width: 1, alignSelf: "stretch", backgroundColor: colors.border, marginHorizontal: 2 }} />
          <Chip label={t("shikshaHubAnyExperience") ?? "Any experience"} active={minExperience === null} onPress={() => setMinExperience(null)} />
          <Chip label={t("shikshaHubExp1Plus") ?? "1+ yrs"} active={minExperience === 1} onPress={() => setMinExperience(1)} />
          <Chip label={t("shikshaHubExp3Plus") ?? "3+ yrs"} active={minExperience === 3} onPress={() => setMinExperience(3)} />
          <Chip label={t("shikshaHubExp5Plus") ?? "5+ yrs"} active={minExperience === 5} onPress={() => setMinExperience(5)} />
        </ScrollView>
      )}

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator color="#14b8a6" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={S.center}>
          <Text style={{ fontSize: 40 }}>🎓</Text>
          <Text style={[S.emptyText, { color: colors.textSecondary }]}>
            {t("shikshaHubEmpty") ?? "No verified tutors yet — check back soon!"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.uid}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={S.grid}
          renderItem={({ item }) => (
            <TutorCard
              tutor={item}
              colors={colors}
              onPress={() => router.push({ pathname: "/shikshahub/[uid]", params: { uid: item.uid } })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[S.chip, active ? S.chipActive : null]}
    >
      <Text style={[S.chipText, active ? S.chipTextActive : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

function TutorCard({ tutor, colors, onPress }: { tutor: MarketplaceTutor; colors: any; onPress: () => void }) {
  return (
    <TouchableOpacity style={[S.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onPress} activeOpacity={0.85}>
      <View style={S.cardImageWrap}>
        {tutor.profilePic ? (
          <Image source={{ uri: tutor.profilePic }} style={S.cardImage} resizeMode="cover" />
        ) : (
          <Text style={{ fontSize: 34 }}>🧑‍🏫</Text>
        )}
      </View>
      <View style={S.cardBody}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
          <Text style={[S.cardName, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>{tutor.name || "Tutor"}</Text>
          {tutor.ratingAverage != null && (
            <Text style={{ fontSize: 11, fontWeight: "800", color: colors.text, flexShrink: 0 }}>
              ⭐ {tutor.ratingAverage.toFixed(1)}
            </Text>
          )}
        </View>
        {!!tutor.qualification && (
          <Text style={[S.cardMeta, { color: colors.textSecondary }]} numberOfLines={1}>{tutor.qualification}</Text>
        )}
        {tutor.subjects.length > 0 && (
          <Text style={S.cardSubjects} numberOfLines={1}>{tutor.subjects.slice(0, 3).join(", ")}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 60 },
  emptyTitle: { fontSize: 15, fontWeight: "700" },
  emptyText: { fontSize: 13, fontWeight: "600", textAlign: "center" },

  titleWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: "900" },
  subtitle: { fontSize: 12, fontWeight: "600", marginTop: 4 },
  myBookingsBtn: { flexShrink: 0, marginTop: 2, borderWidth: 1, borderColor: "#14b8a6", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  myBookingsBtnText: { fontSize: 11.5, fontWeight: "700", color: "#14b8a6" },

  chipRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  chip: { borderWidth: 1, borderColor: "#334155", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  chipActive: { backgroundColor: "rgba(20,184,166,0.15)", borderColor: "#14b8a6" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#94a3b8" },
  chipTextActive: { color: "#14b8a6" },

  grid: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  card: { flex: 1, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  cardImageWrap: { height: 110, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(20,184,166,0.12)" },
  cardImage: { width: "100%", height: "100%" },
  cardBody: { padding: 10, gap: 3 },
  cardName: { fontSize: 14, fontWeight: "800" },
  cardMeta: { fontSize: 11, fontWeight: "600" },
  cardSubjects: { fontSize: 11, fontWeight: "700", color: "#14b8a6" },
});
