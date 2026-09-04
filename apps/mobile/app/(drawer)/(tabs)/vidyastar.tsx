import { useTheme } from "@/context/ThemeContext";
import { useStudentProfile } from "@gloows/shared-logic";
import { useContests } from "@/hooks/useContests";
import { useUserContests } from "@/hooks/useUserContests";
import { db } from "@/lib/firebase";
import { getAuth } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Header from "@/components/header";
import EarnMoreVCoinsModal from "@/components/EarnMoreVCoinsModal";
import BannerCarousel from "@/components/BannerCarousel";
import { useAppTranslation } from "@/context/LanguageContext";

import ContestCard, { type PrizeRow, topPrize } from "@/components/vidyastar/ContestCard";
import ContestFilterTabs, { type ContestFilterTab } from "@/components/vidyastar/ContestFilterTabs";
import ContestCardSkeleton from "@/components/vidyastar/ContestCardSkeleton";
import EmptyContestState from "@/components/vidyastar/EmptyContestState";
import ContestErrorState from "@/components/vidyastar/ContestErrorState";
import { getDate } from "@/components/vidyastar/contestDateUtils";

function usePrizesByPeriod() {
  const [prizesByPeriod, setPrizesByPeriod] = useState<Record<string, PrizeRow[]>>({});
  useEffect(() => {
    getDocs(collection(db, "vidyastarConfig")).then((snap) => {
      const map: Record<string, PrizeRow[]> = {};
      snap.docs.forEach((d) => { map[d.id] = (d.data().prizeRows ?? []) as PrizeRow[]; });
      setPrizesByPeriod(map);
    }).catch(() => {});
  }, []);
  return prizesByPeriod;
}

export default function ShikshastarScreen() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const { contests = [], loading: contestsLoading, error: contestsError, retry } = useContests();
  const userId = getAuth().currentUser?.uid;
  const { joined = {}, completed = {} } = useUserContests(userId || "");
  const { studentProfile } = useStudentProfile();
  const prizesByPeriod = usePrizesByPeriod();

  const [chip, setChip] = useState("all");
  const [earnMore, setEarnMore] = useState<{ required: number; balance: number; contestTitle?: string } | null>(null);

  // FIX: UserService.getUserClass() read users/{uid}.class — a field that's
  // never actually written there (class lives on students/{uid}, per
  // register.tsx/signup.tsx). studentProfile.class is correctly sourced now
  // that StudentProfileContext merges both collections.
  const userClass = studentProfile?.class != null ? String(studentProfile.class) : null;

  const now = new Date();

  // FIX: admin writes targetClass (an array, e.g. ["6","7"] or ["all"]) —
  // this previously checked "class", a field nothing ever sets, so the
  // class filter silently passed every contest through regardless of the
  // student's class.
  const classFiltered = contests.filter((c: any) => {
    if (!userClass) return true;
    if (!c.targetClass) return true;
    return c.targetClass.includes(userClass) || c.targetClass.includes("all");
  });

  // Contests are no longer filtered by language — every student sees every
  // contest, and the AI lesson itself is generated lazily in each viewing
  // student's own preferredLanguage the first time they open it (see
  // functions/src/contestLesson.ts's getContestLesson).
  const limited = classFiltered.slice(0, 10);

  // Core filter: hide ended contests the student never joined
  const visibleContests = limited.filter((c: any) => {
    const end = getDate(c.endTime ?? c.endDate);
    const isEnded = end && end < now;
    const hasParticipated = !!joined[c.id] || !!completed[c.id];
    if (isEnded && !hasParticipated) return false;
    return true;
  });

  const live = visibleContests.filter((c: any) => {
    const s = getDate(c.startTime ?? c.startDate);
    const e = getDate(c.endTime   ?? c.endDate);
    return s && e && s <= now && now <= e;
  });
  // Excludes contests the student has already completed — mirrors
  // ContestCard's own `isUpcoming` derivation (`!isCompleted && ...`).
  // Without this, a contest reused/rescheduled for a later round (same id,
  // pushed-out start date, but an old completed[] entry still on record)
  // would show up under the Upcoming chip while its own card renders the
  // "✅ Completed" state — contradictory and confusing.
  const upcoming = visibleContests.filter((c: any) => {
    const s = getDate(c.startTime ?? c.startDate);
    return s && s > now && !completed[c.id];
  });
  const done = visibleContests.filter((c: any) => !!completed[c.id]);

  const data =
    chip === "all"      ? visibleContests.filter((c: any) => {
      const e = getDate(c.endTime ?? c.endDate);
      return !e || e >= now;   // "all" tab shows only active/upcoming
    })
    : chip === "live"      ? live
    : chip === "upcoming"  ? upcoming
    : done;

  const FILTER_TABS: ContestFilterTab[] = [
    { id: "all",       label: t("all") },
    { id: "live",      label: t("live") },
    { id: "upcoming",  label: t("upcoming") },
    { id: "completed", label: t("completed") },
  ];

  const bottomPad = Math.max(insets.bottom, 12) + 28;

  return (
    // edges={["top"]} — matches home.tsx: only apply safe area at the top
    // (notch/status bar). The tab bar already handles its own bottom inset,
    // and the ScrollView below adds its own bottomPad so the last contest
    // card clears the tab bar with room to spare.
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <Header />
      <BannerCarousel screen="vidyastar" />

      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        <ContestFilterTabs
          tabs={FILTER_TABS}
          active={chip}
          onChange={setChip}
          containerColor={colors.card}
          trackColor={colors.card}
          textColor={colors.textSecondary}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {contestsError ? (
          <ContestErrorState colors={colors} onRetry={retry} />
        ) : contestsLoading ? (
          <>
            <ContestCardSkeleton colors={colors} />
            <ContestCardSkeleton colors={colors} />
          </>
        ) : data.length === 0 ? (
          <EmptyContestState
            variant={chip as "all" | "live" | "upcoming" | "completed"}
            colors={colors}
            onViewUpcoming={chip === "live" ? () => setChip("upcoming") : undefined}
          />
        ) : (
          data.map((item: any) => (
            <ContestCard
              key={item.id}
              item={item}
              joined={joined}
              completed={completed}
              colors={colors}
              prize={item.periodKey ? topPrize(prizesByPeriod[item.periodKey]) : null}
              language={studentProfile?.preferredLanguage ?? "English"}
              onInsufficientBalance={setEarnMore}
            />
          ))
        )}
      </ScrollView>

      <EarnMoreVCoinsModal
        visible={!!earnMore}
        onClose={() => setEarnMore(null)}
        required={earnMore?.required ?? 0}
        balance={earnMore?.balance ?? 0}
        contestTitle={earnMore?.contestTitle}
      />
    </SafeAreaView>
  );
}
