// PATH: apps/mobile/app/(drawer)/(tabs)/shikshahub.tsx
// ShikshaHub — browsable marketplace of verified Gloows Tutor profiles,
// with Instant Tutor as a first-class hero feature (not a filter chip).
// Registered as a tab via ALL_SCREENS + DEFAULT_MODULES in ../_layout.tsx
// and the Firestore appModules/shikshahub doc (see
// apps/admin/src/pages/AppModules.tsx).
//
// Redesign notes: the "N Tutors Available Now" count is a real
// tutorMarketplaceProfiles query result (tutors currently
// isOnlineForInstantHelp), never a hard-coded number — it's simply hidden
// (not zeroed-out or faked) while the initial fetch is still loading.

import { useCallback, useEffect, useMemo, useState } from "react";
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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "@/components/header";
import TutorCard from "@/components/shikshahub/TutorCard";
import InstantTutorSheet from "@/components/shikshahub/InstantTutorSheet";
import AdvancedFiltersSheet, {
  DEFAULT_FILTERS,
  type FilterState,
} from "@/components/shikshahub/AdvancedFiltersSheet";

const SORT_LABELS: Record<FilterState["sortMode"], string> = {
  recommended: "Recommended",
  rating: "Top Rated",
  experience: "Most Experienced",
  priceLow: "Lowest Price",
  priceHigh: "Highest Price",
};

export default function ShikshaHubHomeScreen() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const { user, authLoading } = useStudentProfile();

  const [tutors, setTutors]     = useState<MarketplaceTutor[]>([]);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [subject, setSubject]         = useState<string | null>(null);
  const [onlineOnly, setOnlineOnly]   = useState(false);
  const [filters, setFilters]         = useState<FilterState>(DEFAULT_FILTERS);

  const [showInstantSheet, setShowInstantSheet] = useState(false);
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);

  const loadTutors = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    fetchAllTutors()
      .then(setTutors)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadTutors(); }, [loadTutors]);

  const subjectChips = useMemo(() => deriveSubjectChips(tutors), [tutors]);
  const onlineCount = useMemo(() => tutors.filter((tu) => tu.isOnlineForInstantHelp).length, [tutors]);

  const filtered = useMemo(() => {
    let result = tutors;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((tu) =>
        tu.name.toLowerCase().includes(q) ||
        tu.qualification.toLowerCase().includes(q) ||
        tu.subjects.some((s) => s.toLowerCase().includes(q))
      );
    }
    if (subject) result = result.filter((tu) => tu.subjects.includes(subject));
    if (onlineOnly) result = result.filter((tu) => tu.isOnlineForInstantHelp);
    if (filters.minRating != null) {
      result = result.filter((tu) => tu.ratingAverage != null && tu.ratingAverage >= filters.minRating!);
    }
    if (filters.priceBand != null) {
      result = result.filter((tu) => {
        if (tu.sessionFee == null) return false;
        if (filters.priceBand === "under500") return tu.sessionFee < 500;
        if (filters.priceBand === "500to1000") return tu.sessionFee >= 500 && tu.sessionFee <= 1000;
        return tu.sessionFee > 1000;
      });
    }
    if (filters.minExperience != null) {
      result = result.filter((tu) => tu.teachingExperienceYears != null && tu.teachingExperienceYears >= filters.minExperience!);
    }

    return [...result].sort((a, b) => {
      switch (filters.sortMode) {
        case "rating": {
          const ar = a.ratingAverage ?? -1, br = b.ratingAverage ?? -1;
          if (ar !== br) return br - ar;
          break;
        }
        case "experience": {
          const ae = a.teachingExperienceYears ?? -1, be = b.teachingExperienceYears ?? -1;
          if (ae !== be) return be - ae;
          break;
        }
        case "priceLow": {
          const ap = a.sessionFee ?? Infinity, bp = b.sessionFee ?? Infinity;
          if (ap !== bp) return ap - bp;
          break;
        }
        case "priceHigh": {
          const ap = a.sessionFee ?? -Infinity, bp = b.sessionFee ?? -Infinity;
          if (ap !== bp) return bp - ap;
          break;
        }
        default:
          break;
      }
      return a.name.localeCompare(b.name);
    });
  }, [tutors, searchQuery, subject, onlineOnly, filters]);

  function clearAllFilters() {
    setSearchQuery("");
    setSubject(null);
    setOnlineOnly(false);
    setFilters(DEFAULT_FILTERS);
  }

  function openProfile(uid: string) {
    router.push({ pathname: "/shikshahub/[uid]", params: { uid } });
  }

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

  const advancedActive = filters.priceBand != null || filters.minExperience != null
    || filters.sortMode === "priceLow" || filters.sortMode === "priceHigh" || filters.sortMode === "experience";

  const listHeader = (
    <View>
      <View style={S.titleWrap}>
        <Text style={[S.title, { color: colors.text }]}>🎓 {t("shikshaHubTitle") ?? "ShikshaHub"}</Text>
        <Text style={[S.subtitle, { color: colors.textSecondary }]}>
          {t("shikshaHubHeaderSubtitle") ?? "Find the right tutor or get help instantly"}
        </Text>
      </View>

      <View style={[S.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search" size={16} color={colors.textSecondary} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("shikshaHubSearchPlaceholder") ?? "Search tutors, subjects or classes"}
          placeholderTextColor={colors.textSecondary}
          style={[S.searchInput, { color: colors.text }]}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={S.heroCard}>
        <Text style={S.heroLabel}>⚡ {t("shikshaHubInstantTutorLabel") ?? "INSTANT TUTOR"}</Text>
        <Text style={S.heroTitle}>{t("shikshaHubNeedHelpNow") ?? "Need help right now?"}</Text>
        <Text style={S.heroSubtitle}>
          {t("shikshaHubHeroSubtitle") ?? "Connect with a verified tutor available to help you."}
        </Text>
        {!loading && onlineCount > 0 && (
          <Text style={S.heroLive}>🟢 {onlineCount} {t("shikshaHubTutorsAvailableNow") ?? "Tutors Available Now"}</Text>
        )}
        <TouchableOpacity style={S.heroCta} onPress={() => setShowInstantSheet(true)} activeOpacity={0.88}>
          <Text style={S.heroCtaText}>⚡ {t("shikshaHubFindInstantTutor") ?? "Find an Instant Tutor"}</Text>
        </TouchableOpacity>
      </View>

      <View style={S.quickAccessRow}>
        <TouchableOpacity
          style={[S.quickAccessChip, { borderColor: colors.border }]}
          onPress={() => router.push("/shikshahub/bookings")}
        >
          <Text style={[S.quickAccessText, { color: colors.text }]}>📅 {t("shikshaHubMyBookingsTitle") ?? "My Bookings"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[S.quickAccessChip, { borderColor: colors.border }]}
          onPress={() => router.push("/shikshahub/messages")}
        >
          <Text style={[S.quickAccessText, { color: colors.text }]}>💬 {t("shikshaHubMessagesTitle") ?? "Messages"}</Text>
        </TouchableOpacity>
      </View>

      <View style={S.sectionWrap}>
        <Text style={[S.sectionTitle, { color: colors.text }]}>👨‍🏫 {t("shikshaHubFindRegular") ?? "Find Your Regular Tutor"}</Text>
        <Text style={[S.sectionSubtitle, { color: colors.textSecondary }]}>
          {t("shikshaHubFindRegularSubtitle") ?? "Browse verified tutors for long-term learning and regular sessions"}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.chipRow}>
        <Chip label={`⭐ ${t("shikshaHubSortByRating") ?? "Top Rated"}`} active={filters.sortMode === "rating"}
          onPress={() => setFilters((f) => ({ ...f, sortMode: f.sortMode === "rating" ? "recommended" : "rating" }))} />
        <Chip label={`🟢 ${t("shikshaHubOnlineNow") ?? "Online Now"}`} active={onlineOnly}
          onPress={() => setOnlineOnly((v) => !v)} />
        <Chip label={`₹ ${t("shikshaHubPriceLabel") ?? "Price"}`} active={filters.priceBand != null}
          onPress={() => setShowFiltersSheet(true)} />
        <Chip label={`⭐ 4+ ${t("shikshaHubRatingLabel") ?? "Rating"}`} active={filters.minRating === 4}
          onPress={() => setFilters((f) => ({ ...f, minRating: f.minRating === 4 ? null : 4 }))} />
        <Chip label={`🧑‍🏫 ${t("shikshaHubExperienceLabel") ?? "Experience"}`} active={filters.minExperience != null}
          onPress={() => setShowFiltersSheet(true)} />
        <Chip label={`⚙️ ${t("shikshaHubMoreFilters") ?? "More"}`} active={advancedActive}
          onPress={() => setShowFiltersSheet(true)} />
      </ScrollView>

      {!loading && subjectChips.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.chipRow}>
          <Chip label={t("shikshaHubAllSubjects") ?? "All"} active={subject === null} onPress={() => setSubject(null)} />
          {subjectChips.map((s) => (
            <Chip key={s} label={s} active={subject === s} onPress={() => setSubject(s)} />
          ))}
        </ScrollView>
      )}

      <View style={S.resultsHeaderRow}>
        <View>
          <Text style={[S.resultsTitle, { color: colors.text }]}>{t("shikshaHubRecommendedTutors") ?? "Recommended Tutors"}</Text>
          {!loading && !loadError && (
            <Text style={[S.resultsCount, { color: colors.textSecondary }]}>
              {filtered.length} {t("shikshaHubTutorsFound") ?? "Tutors Found"}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={() => setShowFiltersSheet(true)}>
          <Text style={S.sortLabel}>{t("shikshaHubSortLabel") ?? "Sort"}: {SORT_LABELS[filters.sortMode]} ▼</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]}>
      <Header />

      <FlatList
        data={loading || loadError ? [] : filtered}
        keyExtractor={(item) => item.uid}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={S.grid}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          loading ? (
            <View style={S.center}>
              <ActivityIndicator color="#14b8a6" />
            </View>
          ) : loadError ? (
            <View style={S.center}>
              <Text style={{ fontSize: 40 }}>⚠️</Text>
              <Text style={[S.emptyText, { color: colors.textSecondary }]}>
                {t("shikshaHubLoadError") ?? "Couldn't load tutors. Check your connection and try again."}
              </Text>
              <TouchableOpacity style={S.retryBtn} onPress={loadTutors}>
                <Text style={S.retryBtnText}>{t("retry") ?? "Retry"}</Text>
              </TouchableOpacity>
            </View>
          ) : tutors.length === 0 ? (
            <View style={S.center}>
              <Text style={{ fontSize: 40 }}>🎓</Text>
              <Text style={[S.emptyText, { color: colors.textSecondary }]}>
                {t("shikshaHubEmpty") ?? "No verified tutors yet — check back soon!"}
              </Text>
            </View>
          ) : (
            <View style={S.center}>
              <Text style={{ fontSize: 40 }}>🔍</Text>
              <Text style={[S.emptyText, { color: colors.textSecondary }]}>
                {t("shikshaHubNoFilterResults") ?? "No tutors match your search or filters."}
              </Text>
              <TouchableOpacity style={S.retryBtn} onPress={clearAllFilters}>
                <Text style={S.retryBtnText}>{t("shikshaHubClearFilters") ?? "Clear Filters"}</Text>
              </TouchableOpacity>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TutorCard
            tutor={item}
            colors={colors}
            t={t}
            onPressProfile={() => openProfile(item.uid)}
            onPressPrimary={() => openProfile(item.uid)}
          />
        )}
      />

      <InstantTutorSheet
        visible={showInstantSheet}
        onClose={() => setShowInstantSheet(false)}
        tutors={tutors}
        colors={colors}
        t={t}
        onBrowseSubject={(s) => setSubject(s)}
      />
      <AdvancedFiltersSheet
        visible={showFiltersSheet}
        onClose={() => setShowFiltersSheet(false)}
        colors={colors}
        t={t}
        value={filters}
        onApply={setFilters}
      />
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

const S = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 60 },
  emptyTitle: { fontSize: 15, fontWeight: "700" },
  emptyText: { fontSize: 13, fontWeight: "600", textAlign: "center", paddingHorizontal: 24 },
  retryBtn: { marginTop: 4, backgroundColor: "#14b8a6", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  retryBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  titleWrap: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: "900" },
  subtitle: { fontSize: 12, fontWeight: "600", marginTop: 2 },

  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 12,
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 13, fontWeight: "600", padding: 0 },

  heroCard: {
    marginHorizontal: 16, marginBottom: 14, borderRadius: 20, padding: 18, gap: 4,
    backgroundColor: "#0f766e", borderWidth: 1, borderColor: "#0d9488",
  },
  heroLabel: { fontSize: 11, fontWeight: "900", color: "#a7f3d0", letterSpacing: 0.5 },
  heroTitle: { fontSize: 19, fontWeight: "900", color: "#fff", marginTop: 2 },
  heroSubtitle: { fontSize: 12.5, fontWeight: "600", color: "rgba(255,255,255,0.85)", marginTop: 2 },
  heroLive: { fontSize: 11.5, fontWeight: "800", color: "#bbf7d0", marginTop: 8 },
  heroCta: { marginTop: 12, backgroundColor: "#fff", borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  heroCtaText: { fontSize: 14, fontWeight: "900", color: "#0f766e" },

  quickAccessRow: { flexDirection: "row", gap: 8, marginHorizontal: 16, marginBottom: 16 },
  quickAccessChip: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 9, alignItems: "center" },
  quickAccessText: { fontSize: 11.5, fontWeight: "700" },

  sectionWrap: { paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "900" },
  sectionSubtitle: { fontSize: 11.5, fontWeight: "600", marginTop: 2 },

  chipRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  chip: { borderWidth: 1, borderColor: "#334155", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  chipActive: { backgroundColor: "rgba(20,184,166,0.15)", borderColor: "#14b8a6" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#94a3b8" },
  chipTextActive: { color: "#14b8a6" },

  resultsHeaderRow: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    paddingHorizontal: 16, marginBottom: 10,
  },
  resultsTitle: { fontSize: 14.5, fontWeight: "800" },
  resultsCount: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  sortLabel: { fontSize: 11.5, fontWeight: "700", color: "#0d9488" },

  grid: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
});
