// PATH: app/(drawer)/(tabs)/skillbattle.tsx
// Phase 2D-3 rebuild — Skill Battle discovery, reorganized around
// My Active Battles / Ending Soon / Featured / Browse by Skill (Phase
// 2D-1 blueprint §7, Phase 2D-3 brief §5). "Recent Winners" is
// deliberately omitted — no safe existing cross-battle aggregation
// source exists yet (brief §10), and building one would be exactly the
// "new backend aggregation system" this phase is told not to invent.
//
// Legacy battles (no managed `state`) keep exactly the data/behavior
// they had before this rebuild (same isActive==true query, same
// date-derived status, same submit destination). Canonical battles
// (Phase 2B/2C `state` present) render through the same visual shell via
// resolveBattleExperience.ts's adapter — students never see which engine
// a battle runs on. See that file's header for why a canonical battle's
// CTA doesn't yet route anywhere destructive.
//
// PERFORMANCE (brief §34): this screen makes exactly ONE lightweight,
// single-document read per visible battle to learn "have I submitted"
// (posts or submissions, whichever engine) — no per-battle rank/score
// Cloud Function call happens here at all (that N-calls-per-screen
// pattern from the pre-Phase-1 audit is exactly what this avoids). Rank
// only loads once a student opens a specific Battle Details screen.

import Header from "@/components/header";
import BannerCarousel from "@/components/BannerCarousel";
import BattleCard from "@/components/battle/BattleCard";
import { BattleCardSkeleton } from "@/components/battle/SkeletonBlock";
import EmptyState from "@/components/battle/EmptyState";
import SkillChip from "@/components/battle/SkillChip";
import { fetchMySubmissionStatus, type MySubmissionStatus } from "@/components/battle/fetchMySubmissionStatus";
import {
  buildBattleCardViewModel, type RawBattle,
} from "@/components/battle/resolveBattleExperience";
import type { BattleCardViewModel } from "@/components/battle/types";
import { useTheme } from "@/context/ThemeContext";
import { auth, db } from "@/lib/firebase";
import { getActiveSkillCategories, getActiveSkills, type Skill, type SkillCategory } from "@/services/skillTaxonomyService";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  RefreshControl, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ACCENT = "#ff9f43";

export default function SkillBattleDiscoveryScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [rawBattles, setRawBattles] = useState<RawBattle[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Record<string, MySubmissionStatus>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [activeSkillFilter, setActiveSkillFilter] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setFetchError("");
    try {
      const [battleSnap, skillList, categoryList] = await Promise.all([
        getDocs(query(collection(db, "skillBattles"), where("isActive", "==", true))),
        getActiveSkills(),
        getActiveSkillCategories(),
      ]);
      const battles = battleSnap.docs.map((d) => ({ id: d.id, ...d.data() } as RawBattle));
      setRawBattles(battles);
      setSkills(skillList);
      setCategories(categoryList);

      const uid = auth.currentUser?.uid;
      if (uid) {
        const entries = await Promise.all(
          battles.map(async (b) => [b.id, await fetchMySubmissionStatus(b, uid)] as const)
        );
        setMySubmissions(Object.fromEntries(entries));
      }
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  const viewModels: BattleCardViewModel[] = rawBattles.map((b) => buildBattleCardViewModel(b, { skills, categories }));

  const myActive = viewModels.filter((v) => {
    const status = mySubmissions[v.id];
    return status && status !== "NONE" && status !== "WITHDRAWN" && v.status !== "COMPLETED" && v.status !== "CANCELLED";
  });

  const liveBattles = viewModels.filter((v) => v.status === "LIVE");
  const endingSoon = [...liveBattles]
    .filter((v) => v.deadline)
    .sort((a, b) => (a.deadline!.getTime() - b.deadline!.getTime()))
    .slice(0, 3);
  const endingSoonIds = new Set(endingSoon.map((v) => v.id));

  // "Featured" — no dedicated backend concept exists yet (brief §8: don't
  // invent one this phase). Safest existing signal: the remaining live
  // battles, most-recently-opened first, capped to a handful — avoids
  // fabricating popularity/ranking data that isn't authoritative.
  const featured = liveBattles.filter((v) => !endingSoonIds.has(v.id)).slice(0, 4);

  const skillFiltered = activeSkillFilter
    ? viewModels.filter((v) => v.skill?.id === activeSkillFilter)
    : [];

  const navigateToDetails = (battleId: string) => {
    // "as any" — Expo Router's generated .expo/types/router.d.ts (a
    // build-tool-generated file, regenerated by `expo start`, which this
    // sandboxed environment can't run) doesn't yet list the brand-new
    // /battle-details route added in this same change; the route itself
    // resolves correctly at runtime from the app/battle-details.tsx file.
    // Same escape hatch already used elsewhere in this codebase for a
    // freshly-added route (e.g. ai-guru/index.tsx's MENU_CARD_DEFS route
    // casts) — safe to remove once a real `expo start` regenerates types.
    router.push({ pathname: "/battle-details" as any, params: { battleId } });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header />
      <BannerCarousel screen="skillbattle" />

      {fetchError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{fetchError}</Text>
        </View>
      ) : null}

      {loading ? (
        <ScrollView contentContainerStyle={styles.list}>
          <BattleCardSkeleton />
          <BattleCardSkeleton />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
        >
          {viewModels.length === 0 && (
            <EmptyState emoji="🎯" title="No battles right now" subtitle="Check back soon — new Skill Battles open regularly." />
          )}

          {myActive.length > 0 && (
            <Section title="🔥 My Active Battles">
              {myActive.map((v) => (
                <BattleCard key={v.id} battle={v} onPress={() => navigateToDetails(v.id)} />
              ))}
            </Section>
          )}

          {endingSoon.length > 0 && (
            <Section title="⏰ Ending Soon">
              {endingSoon.map((v) => (
                <BattleCard key={v.id} battle={v} onPress={() => navigateToDetails(v.id)} />
              ))}
            </Section>
          )}

          {featured.length > 0 && (
            <Section title="⭐ Featured">
              {featured.map((v) => (
                <BattleCard key={v.id} battle={v} onPress={() => navigateToDetails(v.id)} />
              ))}
            </Section>
          )}

          {categories.length > 0 && skills.length > 0 && (
            <Section title="🎨 Browse by Skill">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                <SkillChip label="All" active={activeSkillFilter === null} onPress={() => setActiveSkillFilter(null)} />
                {skills.map((s) => (
                  <SkillChip key={s.id} label={s.name} active={activeSkillFilter === s.id} onPress={() => setActiveSkillFilter(s.id)} />
                ))}
              </ScrollView>
              {activeSkillFilter && (
                skillFiltered.length > 0 ? (
                  <View style={{ gap: 12, marginTop: 12 }}>
                    {skillFiltered.map((v) => (
                      <BattleCard key={v.id} battle={v} onPress={() => navigateToDetails(v.id)} />
                    ))}
                  </View>
                ) : (
                  <EmptyState emoji="🔍" title="No battles for this skill yet" />
                )
              )}
            </Section>
          )}

          {liveBattles.length === 0 && myActive.length === 0 && viewModels.length > 0 && (
            <EmptyState emoji="⏰" title="No live battles right now" subtitle="New battles open regularly — check back soon." />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ gap: 12 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 40, gap: 24 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: 0.5 },
  chipScroll: { gap: 8, paddingRight: 8 },
  errorBanner: { marginHorizontal: 16, marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: "rgba(255,107,157,0.1)", borderWidth: 1, borderColor: "rgba(255,107,157,0.3)" },
  errorText: { color: "#ff6b9d", fontSize: 11, fontWeight: "600" },
});
