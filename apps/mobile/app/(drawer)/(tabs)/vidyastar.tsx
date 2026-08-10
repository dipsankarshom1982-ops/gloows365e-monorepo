import { useTheme } from "@/context/ThemeContext";
import { useStudentProfile } from "@gloows/shared-logic";
import { useContests } from "@/hooks/useContests";
import { useUserContests } from "@/hooks/useUserContests";
import { joinContest } from "@/services/joinContest";
import { db } from "@/lib/firebase";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Header from "@/components/header";
import EarnMoreVCoinsModal from "@/components/EarnMoreVCoinsModal";
import BannerCarousel from "@/components/BannerCarousel";
import { useCountdown, formatCountdown, formatCountdownDHM } from "@/hooks/useCountdown";
import { useContestBanner } from "@/hooks/useContestBanner";
import { useAppTranslation } from "@/context/LanguageContext";

const { width } = Dimensions.get("window");

const getDate = (t: any): Date | null => {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t.seconds) return new Date(t.seconds * 1000);
  if (typeof t === "string" && t.length > 0) return new Date(t);
  return null;
};

// "12 Aug 2026" — plain calendar date, no time, for completed/upcoming chips.
const formatChipDate = (d: Date): string =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

// Prizes live only in VidyaStar Config (vidyastarConfig/{periodKey}.prizeRows)
// — Create Contest's old free-text Prize field was removed since it
// duplicated this. The card teaser shows the top (lowest rankMin) tier.
type PrizeType = "gift_voucher" | "physical" | "vcoin";
interface PrizeRow { rankMin: number; rankMax: number; prizeType: PrizeType; prizeValue: string; medalEmoji: string; badge: string; }

function formatPrize(row: PrizeRow): string {
  return row.prizeType === "vcoin" ? `${row.prizeValue} V-Coins` : row.prizeValue;
}
function topPrize(rows: PrizeRow[] | undefined): PrizeRow | null {
  if (!rows?.length) return null;
  return [...rows].sort((a, b) => a.rankMin - b.rankMin)[0];
}

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

// 🔥 Ultra Premium Chip
const Chip = ({ label, active, onPress, colors }: any) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    style={[
      styles.chipBase,
      active
        ? styles.chipActive
        : { backgroundColor: colors.card, borderColor: colors.border },
    ]}
  >
    <Text style={[styles.chipText, { color: active ? "#fff" : colors.accent }]}>{label}</Text>
  </TouchableOpacity>
);

// Completed contest's topic / date pills
const InfoChip = ({ icon, text, colors }: any) => (
  <View style={[styles.infoChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <Text style={styles.infoChipIcon}>{icon}</Text>
    <Text style={[styles.infoChipText, { color: colors.textSecondary }]} numberOfLines={1}>{text}</Text>
  </View>
);

// Upcoming contest's countdown (<2 days) / start-date (>=2 days) badge —
// amber "timer" tone for the countdown, neutral indigo "date" tone otherwise.
const TimerBadge = ({ icon = "time-outline", text, tone = "timer" }: any) => (
  <View style={[styles.timerBadge, tone === "date" && styles.dateBadge]}>
    <Ionicons name={icon} size={18} color={tone === "date" ? "#4f46e5" : "#f59e0b"} />
    <Text style={[styles.timerText, tone === "date" && styles.dateText]}>{text}</Text>
  </View>
);

// 🔥 Modern Action Button
// `loading` swaps the label/icon for a spinner + loadingTitle so a tap on
// Reserve Spot / Join Now (both fire an async Firestore write via
// joinContest) gives immediate feedback that something is happening,
// rather than looking unresponsive until the request resolves.
const ActionButton = ({ title, onPress, colors, icon, loading, disabled, loadingTitle }: any) => {
  const isBusy = !!loading;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} disabled={isBusy || disabled}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.actionBtn, (isBusy || disabled) && styles.actionBtnDisabled]}>
        {isBusy ? (
          <>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={[styles.actionBtnText, { marginLeft: 8 }]}>{loadingTitle ?? "Please wait…"}</Text>
          </>
        ) : (
          <>
            <Text style={styles.actionBtnText}>{title}</Text>
            <Ionicons name={icon} size={18} color="#fff" style={{ marginLeft: 8 }} />
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

// Banner header uses the real per-contest AI banner (unique emoji/gradient/
// tagline, generated by getContestLesson — see hooks/useContestBanner.ts)
// instead of a flat white header, so each contest actually looks distinct.
// Falls back to a generic purple gradient + star until that's generated
// (lazily, the first time anyone in the viewer's language opens it).
const ContestCard = ({ item, joined, completed, colors, prize, language, onInsufficientBalance }: any) => {
  const router = useRouter();
  const { t } = useAppTranslation();
  const userId = getAuth().currentUser?.uid;
  const banner = useContestBanner(item.id, language);
  const isJoined    = !!joined[item.id];
  const isCompleted = !!completed[item.id];
  const now   = new Date();
  const start = getDate(item.startTime ?? item.startDate);
  const end   = getDate(item.endTime   ?? item.endDate);
  const isLive   = !!(start && start <= now && (!end || end > now));
  const isEnded  = !!(end && end < now);

  const endsIn   = useCountdown(isLive && end ? end.getTime() : null);
  const startsIn = useCountdown(!isLive && !isEnded && start ? start.getTime() : null);
  const isUpcoming      = !isCompleted && !isLive && !!start && start > now;
  const isWithinTwoDays = isUpcoming && start!.getTime() - now.getTime() <= TWO_DAYS_MS;

  const progress =
    isLive && start && end
      ? ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100
      : 0;

  const vCoinFee = item.isSponsored ? 0 : Math.max(0, Number(item.vCoinEntryFee) || 0);
  const [joining, setJoining] = useState(false);

  // Returns true if the student is now (or already was) joined — false if
  // the join was blocked by an insufficient V-Coins balance, in which case
  // onInsufficientBalance has already been fired to show the earn-more sheet.
  const handleJoin = async (): Promise<boolean> => {
    if (!userId) { Alert.alert(t("loginRequired")); return false; }
    setJoining(true);
    try {
      const result = await joinContest(userId, item);
      if (result.status === "insufficient_balance") {
        onInsufficientBalance({ required: result.required, balance: result.balance, contestTitle: item.title });
        return false;
      }
      return true;
    } catch (err: any) {
      const code = String(err?.code ?? "");
      if (code.endsWith("not-found")) {
        Alert.alert(
          t("contestUnavailableTitle") ?? "Contest unavailable",
          t("contestUnavailableBody") ?? "This contest is no longer available. Pull to refresh and try another one."
        );
      } else if (code.endsWith("failed-precondition")) {
        Alert.alert(
          t("contestClosedTitle") ?? "Contest closed",
          t("contestClosedBody") ?? "This contest is no longer active."
        );
      } else if (code.endsWith("resource-exhausted")) {
        Alert.alert(
          t("contestFullTitle") ?? "Contest full",
          t("contestFullBody") ?? "This contest has reached its maximum number of participants."
        );
      } else {
        Alert.alert(
          t("joinFailedTitle") ?? "Couldn't join",
          t("joinFailedBody") ?? "Something went wrong. Please try again."
        );
      }
      return false;
    } finally {
      setJoining(false);
    }
  };

  const goToLesson = () =>
    router.push({ pathname: "/contest/lesson", params: { contestId: item.id } });

  const goToResult = () =>
    router.push({ pathname: "/contest/result", params: { contestId: item.id } });

  const goToLeaderboard = () =>
    router.push({ pathname: "/contest/leaderboard", params: { contestId: item.id } });
  // "View Leaderboard" (ended contests) now points at Starboard — the
  // overall India leaderboard — rather than this contest's own final
  // standings screen; "View Live Standings" (still-active contests) keeps
  // going to the per-contest leaderboard, unchanged.
  const goToStarboard = () => router.push("/starboard" as any);

  return (
    <View style={[styles.cardContainer, { shadowColor: colors.text }]}>
      <LinearGradient
        colors={[banner?.gradientStart ?? "#1a0a2e", banner?.gradientEnd ?? "#7c3aed"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.bannerHeader}
      >
        <View style={styles.bannerTopRow}>
          {isLive ? (
            <View style={styles.liveBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.liveText}>{t("live").toUpperCase()}</Text>
            </View>
          ) : <View />}
          {isCompleted && (
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#6ee7b7" />
              <Text style={styles.doneText}>{t("completed")}</Text>
            </View>
          )}
        </View>
        <Text style={styles.bannerEmoji}>{banner?.emoji ?? "🌟"}</Text>
        <Text style={styles.bannerTitle} numberOfLines={2}>{item.title}</Text>
        {!!banner?.tagline && (
          <Text style={styles.bannerTagline} numberOfLines={2}>{banner.tagline}</Text>
        )}
      </LinearGradient>

      <View style={[styles.cardBody, { backgroundColor: colors.card }]}>
        {/* PRIZE INFO */}
        {prize && (
          <View style={[styles.prizeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="trophy-outline" size={20} color="#f59e0b" />
            <Text style={[styles.prizeLabel, { color: colors.textSecondary }]}>{t("prizePool")}</Text>
            <Text style={[styles.prizeValue, { color: colors.text }]}>{formatPrize(prize)}</Text>
          </View>
        )}

        {/* V-COINS ENTRY FEE / SPONSORED */}
        {item.isSponsored ? (
          <View style={styles.sponsoredBadge}>
            <Ionicons name="star" size={13} color="#059669" />
            <Text style={styles.sponsoredText}>
              🎉 Sponsored{item.sponsorName ? ` by ${item.sponsorName}` : ""} — Free Entry
            </Text>
          </View>
        ) : vCoinFee > 0 ? (
          <View style={styles.feeBadge}>
            <Text style={styles.feeEmoji}>🪙</Text>
            <Text style={styles.feeText}>{vCoinFee} V-Coins to join</Text>
          </View>
        ) : (
          <View style={styles.freeBadge}>
            <Text style={styles.freeText}>✅ Free to join</Text>
          </View>
        )}

        {/* SPOTS */}
        {(item.joinedCount != null || item.totalSpots != null) && (
          <View style={styles.spotsRow}>
            <Ionicons name="people-outline" size={15} color={colors.textSecondary} />
            <Text style={[styles.spotsText, { color: colors.textSecondary }]}>
              {item.joinedCount ?? 0} / {item.totalSpots ?? "∞"} joined
            </Text>
          </View>
        )}

        {/* COMPLETED — topic + date chips */}
        {isCompleted && (
          <View style={styles.infoChipRow}>
            <InfoChip icon="📚" text={item.description || item.title} colors={colors} />
            {(end || start) && <InfoChip icon="📅" text={formatChipDate((end ?? start)!)} colors={colors} />}
          </View>
        )}

        {/* PROGRESS BAR */}
        {isLive && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
            <Text style={[styles.progressTimeText, { color: colors.textSecondary }]}>
              {endsIn != null ? `⏰ ${formatCountdown(endsIn)} left` : t("endingSoon")}
            </Text>
          </View>
        )}

        {/* CTA SECTION */}
        <View style={styles.ctaWrapper}>
          {/* Ended + participated → View Result + Leaderboard */}
          {isCompleted && isEnded && (
            <>
              <ActionButton
                title={t("viewResult")}
                colors={["#10b981", "#059669"]}
                icon="stats-chart"
                onPress={goToResult}
              />
              <TouchableOpacity style={styles.leaderLink} onPress={goToStarboard} activeOpacity={0.8}>
                <Ionicons name="podium-outline" size={14} color="#a5b4fc" />
                <Text style={styles.leaderLinkText}>{t("viewLeaderboard") ?? "View Leaderboard"}</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Ended + joined but didn't complete quiz */}
          {isJoined && !isCompleted && isEnded && (
            <TouchableOpacity style={styles.leaderLink} onPress={goToStarboard} activeOpacity={0.8}>
              <Ionicons name="podium-outline" size={14} color="#a5b4fc" />
              <Text style={styles.leaderLinkText}>{t("viewLeaderboard") ?? "View Leaderboard"}</Text>
            </TouchableOpacity>
          )}

          {/* Active contest — completed quiz → result + live standings */}
          {isCompleted && !isEnded && (
            <>
              <ActionButton
                title={t("viewResult")}
                colors={["#10b981", "#059669"]}
                icon="stats-chart"
                onPress={goToResult}
              />
              <TouchableOpacity style={styles.leaderLink} onPress={goToLeaderboard} activeOpacity={0.8}>
                <Ionicons name="podium-outline" size={14} color="#a5b4fc" />
                <Text style={styles.leaderLinkText}>{t("viewLiveStandings") ?? "View Live Standings"}</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Active contest — joined, not yet completed */}
          {!isCompleted && isLive && isJoined && (
            <ActionButton
              title="Continue Lesson"
              colors={["#4f46e5", "#3730a3"]}
              icon="play"
              onPress={goToLesson}
            />
          )}

          {/* Active contest — not joined. The lesson itself is generated
              lazily (in the student's own language) the moment they open
              it, so there's no "lesson not ready" state to gate on here
              anymore — Join always leads straight to it. */}
          {!isCompleted && isLive && !isJoined && (
            <ActionButton
              title={t("joinNow")}
              colors={["#6366f1", "#4f46e5"]}
              icon="flash"
              loading={joining}
              loadingTitle={t("joining") ?? "Joining…"}
              onPress={async () => {
                const ok = await handleJoin();
                if (ok) goToLesson();
              }}
            />
          )}

          {/* Upcoming — starting within 2 days: live day/hour/minute
              countdown timer. Further out: the plain start date instead
              (a live countdown that's still a day+ away isn't useful, and
              "coming in 2 days" is exactly the window the timer should
              appear in). */}
          {isUpcoming && (
            isWithinTwoDays
              ? <TimerBadge text={startsIn != null ? `Starts in ${formatCountdownDHM(startsIn)}` : t("startsSoon")} />
              : <TimerBadge icon="calendar-outline" tone="date" text={`Starts ${formatChipDate(start!)}`} />
          )}

          {/* Upcoming — not joined: Reserve Spot, alongside the timer/date
              badge above (both near and far upcoming contests still need a
              way to actually join). */}
          {isUpcoming && !isJoined && (
            <ActionButton
              title={t("reserveSpot")}
              colors={["#6366f1", "#4f46e5"]}
              icon="calendar"
              loading={joining}
              loadingTitle={t("reservingSpot") ?? "Reserving your spot…"}
              onPress={handleJoin}
            />
          )}
        </View>
      </View>
    </View>
  );
};

export default function ShikshastarScreen() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const { contests = [], loading: contestsLoading } = useContests();
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

  if (contestsLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header />
      <BannerCarousel screen="vidyastar" />
      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(["all", "live", "upcoming", "completed"] as const).map((c) => (
            <Chip
              key={c}
              label={t(c === "all" ? "all" : c === "live" ? "live" : c === "upcoming" ? "upcoming" : "completed")}
              active={chip === c}
              onPress={() => setChip(c)}
              colors={colors}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {data.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {chip === "completed"
                ? "You haven't completed any contests yet."
                : "No contests available right now."}
            </Text>
          </View>
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
        <View style={{ height: 40 }} />
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

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  chipBase: { paddingVertical: 10, paddingHorizontal: 20, marginRight: 10, borderRadius: 30, borderWidth: 1 },
  chipActive:   { backgroundColor: "#4f46e5", borderColor: "#4f46e5", elevation: 4 },
  chipText: { fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  cardContainer: {
    marginBottom: 18, borderRadius: 24, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08, shadowRadius: 15, elevation: 6,
  },
  bannerHeader: { padding: 18, paddingBottom: 16 },
  bannerTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  bannerEmoji: { fontSize: 36, marginBottom: 6 },
  bannerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  bannerTagline: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontStyle: "italic", marginTop: 4 },
  cardBody: { padding: 20 },
  liveBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(239,68,68,0.25)", borderWidth: 1, borderColor: "rgba(252,165,165,0.4)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ef4444", marginRight: 4 },
  liveText: { fontSize: 10, fontWeight: "800", color: "#fecaca" },
  doneBadge: { flexDirection: "row", alignItems: "center" },
  doneText: { fontSize: 12, color: "#6ee7b7", fontWeight: "700", marginLeft: 4 },
  prizeRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 10, borderRadius: 14, borderWidth: 1, borderColor: "#f3f4f6" },
  prizeLabel: { fontSize: 14, color: "#6b7280", marginLeft: 8 },
  prizeValue: { fontSize: 15, fontWeight: "700", color: "#1f2937", marginLeft: "auto" },
  sponsoredBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, alignSelf: "flex-start", backgroundColor: "#d1fae5", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  sponsoredText: { fontSize: 11, fontWeight: "800", color: "#059669" },
  feeBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, alignSelf: "flex-start", backgroundColor: "#fffbeb", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: "#fde68a" },
  feeEmoji: { fontSize: 12 },
  feeText: { fontSize: 11, fontWeight: "800", color: "#b45309" },
  freeBadge: { marginTop: 8, alignSelf: "flex-start", backgroundColor: "#ecfdf5", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  freeText: { fontSize: 11, fontWeight: "800", color: "#059669" },
  spotsRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 },
  spotsText: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  progressContainer: { marginTop: 15 },
  progressBarBg: { height: 8, backgroundColor: "#e5e7eb", borderRadius: 4, overflow: "hidden" },
  progressBarFill: { height: "100%", backgroundColor: "#4f46e5" },
  progressTimeText: { fontSize: 11, color: "#9ca3af", marginTop: 4, textAlign: "right" },
  lessonBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10, alignSelf: "flex-start", backgroundColor: "#ede9fe", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  lessonBadgeText: { fontSize: 11, color: "#6366f1", fontWeight: "700" },
  ctaWrapper: { marginTop: 16 },
  actionBtn: { paddingVertical: 14, borderRadius: 16, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  actionBtnDisabled: { opacity: 0.75 },
  actionBtnText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.5 },
  timerBadge: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 12, backgroundColor: "#fffbeb", borderRadius: 16, borderWidth: 1, borderColor: "#fef3c7" },
  timerText: { color: "#d97706", fontWeight: "700", marginLeft: 8 },
  dateBadge: { backgroundColor: "rgba(99,102,241,0.08)", borderColor: "#e0e7ff" },
  dateText: { color: "#4f46e5" },
  infoChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  infoChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, maxWidth: "100%" },
  infoChipIcon: { fontSize: 12 },
  infoChipText: { fontSize: 11, fontWeight: "700" },
  leaderLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 12, backgroundColor: "#1e1b4b", borderWidth: 1, borderColor: "#6366f133", marginTop: 8 },
  leaderLinkText: { color: "#a5b4fc", fontSize: 12, fontWeight: "700" },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: "#6b7280", fontSize: 14, fontWeight: "600", textAlign: "center" },
});
