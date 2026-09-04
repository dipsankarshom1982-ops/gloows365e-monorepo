// PATH: components/vidyastar/ContestCard.tsx
//
// Redesigned, compact contest card — extracted from vidyastar.tsx. All
// business logic (join flow, routing, status derivation) is unchanged from
// the original inline ContestCard; only the presentation was rebuilt:
//   - compact horizontal hero (icon + title, instead of stacked emoji/
//     title/tagline) targeting ~150-170px instead of the old ~220px+
//   - prize/fee/spots collapsed into one ContestMetadata row instead of
//     three separately-padded boxes
//   - status communicated via ContestStatusBadge (icon + text + tone, not
//     color alone)
//   - CTA hierarchy via ContestActions (clear primary vs. secondary)

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { joinContest } from "@/services/joinContest";
import { useCountdown, formatCountdown, formatCountdownDHM } from "@/hooks/useCountdown";
import { useContestBanner } from "@/hooks/useContestBanner";
import { useAppTranslation } from "@/context/LanguageContext";

import ContestStatusBadge from "./ContestStatusBadge";
import ContestMetadata, { type ContestMetadataItem } from "./ContestMetadata";
import ContestActions from "./ContestActions";
import { getDate, formatChipDate, TWO_DAYS_MS } from "./contestDateUtils";

export type PrizeType = "gift_voucher" | "physical" | "vcoin";
export interface PrizeRow { rankMin: number; rankMax: number; prizeType: PrizeType; prizeValue: string; medalEmoji: string; badge: string; }

export function formatPrize(row: PrizeRow): string {
  return row.prizeType === "vcoin" ? `${row.prizeValue} V-Coins` : row.prizeValue;
}
export function topPrize(rows: PrizeRow[] | undefined): PrizeRow | null {
  if (!rows?.length) return null;
  return [...rows].sort((a, b) => a.rankMin - b.rankMin)[0];
}

interface Props {
  item: any;
  joined: Record<string, boolean>;
  completed: Record<string, any>;
  colors: any;
  prize: PrizeRow | null;
  language: string;
  onInsufficientBalance: (v: { required: number; balance: number; contestTitle?: string }) => void;
}

export default function ContestCard({ item, joined, completed, colors, prize, language, onInsufficientBalance }: Props) {
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
  // "View Leaderboard" (ended contests) points at Starboard — the overall
  // India leaderboard — rather than this contest's own final standings
  // screen; "View Live Standings" (still-active contests) keeps going to
  // the per-contest leaderboard. Unchanged from the pre-redesign behaviour.
  const goToStarboard = () => router.push("/starboard" as any);

  // Metadata row — prize / entry / spots / topic / date, whichever apply.
  const metaItems: ContestMetadataItem[] = [];
  if (item.joinedCount != null || item.totalSpots != null) {
    metaItems.push({ icon: "people-outline", text: `${item.joinedCount ?? 0} / ${item.totalSpots ?? "∞"} joined` });
  }
  if (isCompleted) {
    if (item.description || item.title) metaItems.push({ icon: "book-outline", text: item.description || item.title });
    if (end || start) metaItems.push({ icon: "calendar-outline", text: formatChipDate((end ?? start)!) });
  }

  const statusTone = isLive ? "live" : isCompleted ? "completed" : isUpcoming ? "upcoming" : null;
  const statusLabel = isLive ? t("live") : isCompleted ? t("completed") : isUpcoming ? t("upcoming") : "";

  return (
    <View style={[styles.cardContainer, { shadowColor: colors.text }]}>
      {/* ── Compact hero: icon + title side-by-side instead of stacked ── */}
      <LinearGradient
        colors={[banner?.gradientStart ?? "#1a0a2e", banner?.gradientEnd ?? "#7c3aed"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.bannerHeader}
      >
        {statusTone && (
          <View style={styles.bannerTopRow}>
            <ContestStatusBadge tone={statusTone} label={statusLabel} />
          </View>
        )}
        <View style={styles.bannerMainRow}>
          <View style={styles.bannerIconWrap}>
            <Text style={styles.bannerEmoji}>{banner?.emoji ?? "🌟"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle} numberOfLines={2}>{item.title}</Text>
            {!!banner?.tagline && (
              <Text style={styles.bannerTagline} numberOfLines={1}>{banner.tagline}</Text>
            )}
          </View>
        </View>
      </LinearGradient>

      <View style={[styles.cardBody, { backgroundColor: colors.card }]}>
        {/* PRIZE — kept as its own line (brand gold, deserves emphasis) */}
        {prize && (
          <View style={styles.prizeRow}>
            <MaterialCommunityIcons name="trophy-outline" size={16} color="#f59e0b" />
            <Text style={[styles.prizeLabel, { color: colors.textSecondary }]}>{t("prizePool")}</Text>
            <Text style={[styles.prizeValue, { color: colors.text }]}>{formatPrize(prize)}</Text>
          </View>
        )}

        {/* SPONSOR / ENTRY FEE — compact single-line badge, never dominant */}
        {item.isSponsored ? (
          <View style={styles.sponsorRow}>
            <View style={styles.sponsoredBadge}>
              <Ionicons name="sparkles" size={11} color="#059669" />
              <Text style={styles.sponsoredText} numberOfLines={1}>
                Sponsored{item.sponsorName ? ` by ${item.sponsorName}` : ""}
              </Text>
            </View>
            <View style={styles.freeChip}>
              <Text style={styles.freeChipText}>Free</Text>
            </View>
          </View>
        ) : vCoinFee > 0 ? (
          <View style={styles.feeBadge}>
            <Ionicons name="logo-bitcoin" size={12} color="#b45309" />
            <Text style={styles.feeText}>{vCoinFee} V-Coins to join</Text>
          </View>
        ) : (
          <View style={styles.freeBadge}>
            <Ionicons name="checkmark-circle" size={12} color="#059669" />
            <Text style={styles.freeText}>Free to join</Text>
          </View>
        )}

        {/* METADATA — spots / topic / date, one compact flowing row */}
        {metaItems.length > 0 && (
          <ContestMetadata items={metaItems} textColor={colors.textSecondary} iconColor={colors.textSecondary} />
        )}

        {/* PROGRESS BAR — live contests only */}
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

        {/* Upcoming — countdown (<2 days) or plain start date otherwise */}
        {isUpcoming && (
          <View style={[styles.timerBadge, !isWithinTwoDays && styles.dateBadge]}>
            <Ionicons name={isWithinTwoDays ? "time-outline" : "calendar-outline"} size={15} color={isWithinTwoDays ? "#f59e0b" : "#4f46e5"} />
            <Text style={[styles.timerText, !isWithinTwoDays && styles.dateText]}>
              {isWithinTwoDays
                ? (startsIn != null ? `Starts in ${formatCountdownDHM(startsIn)}` : (t("startsSoon") ?? "Starting soon"))
                : `Starts ${formatChipDate(start!)}`}
            </Text>
          </View>
        )}

        {/* CTA */}
        <View style={styles.ctaWrapper}>
          <ContestActions
            isCompleted={isCompleted}
            isEnded={isEnded}
            isJoined={isJoined}
            isLive={isLive}
            isUpcoming={isUpcoming}
            joining={joining}
            labels={{
              viewResult: t("viewResult"),
              viewLeaderboard: t("viewLeaderboard") ?? "View Leaderboard",
              viewLiveStandings: t("viewLiveStandings") ?? "View Live Standings",
              continueLesson: "Continue Lesson",
              joinNow: t("joinNow"),
              joining: t("joining") ?? "Joining…",
              reserveSpot: t("reserveSpot"),
              reservingSpot: t("reservingSpot") ?? "Reserving your spot…",
            }}
            onViewResult={goToResult}
            onLeaderboard={goToStarboard}
            onLiveStandings={goToLeaderboard}
            onContinueLesson={goToLesson}
            onJoinNow={async () => { const ok = await handleJoin(); if (ok) goToLesson(); }}
            onReserveSpot={handleJoin}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 18, borderRadius: 24, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 5,
  },
  bannerHeader: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  bannerTopRow: { flexDirection: "row", justifyContent: "flex-end" },
  bannerMainRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  bannerIconWrap: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center", justifyContent: "center",
  },
  bannerEmoji: { fontSize: 24 },
  bannerTitle: { color: "#fff", fontSize: 16, fontWeight: "800", lineHeight: 20 },
  bannerTagline: { color: "rgba(255,255,255,0.75)", fontSize: 11.5, marginTop: 3 },

  cardBody: { padding: 18, gap: 10 },

  prizeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  prizeLabel: { fontSize: 13 },
  prizeValue: { fontSize: 14, fontWeight: "800", marginLeft: "auto" },

  sponsorRow: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" },
  sponsoredBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#d1fae5", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, maxWidth: 220 },
  sponsoredText: { fontSize: 11, fontWeight: "800", color: "#059669" },
  freeChip: { backgroundColor: "#ecfdf5", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  freeChipText: { fontSize: 11, fontWeight: "800", color: "#059669" },

  feeBadge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: "#fffbeb", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: "#fde68a" },
  feeText: { fontSize: 11, fontWeight: "800", color: "#b45309" },
  freeBadge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: "#ecfdf5", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  freeText: { fontSize: 11, fontWeight: "800", color: "#059669" },

  progressContainer: { marginTop: 2 },
  progressBarBg: { height: 6, backgroundColor: "#e5e7eb", borderRadius: 3, overflow: "hidden" },
  progressBarFill: { height: "100%", backgroundColor: "#4f46e5" },
  progressTimeText: { fontSize: 11, color: "#9ca3af", marginTop: 4, textAlign: "right" },

  timerBadge: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, backgroundColor: "#fffbeb", borderRadius: 14, borderWidth: 1, borderColor: "#fef3c7" },
  timerText: { color: "#d97706", fontWeight: "700", fontSize: 13 },
  dateBadge: { backgroundColor: "rgba(99,102,241,0.08)", borderColor: "#e0e7ff" },
  dateText: { color: "#4f46e5" },

  ctaWrapper: { marginTop: 2, gap: 0 },
});
