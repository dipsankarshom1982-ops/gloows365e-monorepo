// PATH: components/vidyastar/ContestActions.tsx
//
// Presentational-only CTA block for a contest card. Every handler is
// supplied by ContestCard, which still owns all the real behaviour
// (joinContest Firestore writes, routing) — this component only decides
// what to render and how it looks, restyled for a clear primary/secondary
// hierarchy (brief: "there must be a clear primary action").
//
// Branch conditions mirror ContestCard's previous inline JSX exactly — see
// the vidyastar.tsx git history for the original combinations if this ever
// needs to be cross-checked against pre-redesign behaviour.

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";

interface PrimaryButtonProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: [string, string, ...string[]];
  onPress: () => void;
  loading?: boolean;
  loadingTitle?: string;
  disabled?: boolean;
}

export function PrimaryActionButton({ title, icon, colors, onPress, loading, loadingTitle, disabled }: PrimaryButtonProps) {
  const busy = !!loading;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} disabled={busy || disabled}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.primaryBtn, (busy || disabled) && s.disabled]}>
        {busy ? (
          <>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={[s.primaryText, { marginLeft: 8 }]}>{loadingTitle ?? "Please wait…"}</Text>
          </>
        ) : (
          <>
            <Text style={s.primaryText}>{title}</Text>
            <Ionicons name={icon} size={17} color="#fff" style={{ marginLeft: 8 }} />
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

interface SecondaryButtonProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

export function SecondaryActionButton({ title, icon, onPress }: SecondaryButtonProps) {
  return (
    <TouchableOpacity style={s.secondaryBtn} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={icon} size={15} color="#a5b4fc" />
      <Text style={s.secondaryText}>{title}</Text>
    </TouchableOpacity>
  );
}

export interface ContestActionsProps {
  isCompleted: boolean;
  isEnded: boolean;
  isJoined: boolean;
  isLive: boolean;
  isUpcoming: boolean;
  joining: boolean;
  labels: {
    viewResult: string;
    viewLeaderboard: string;
    viewLiveStandings: string;
    continueLesson: string;
    joinNow: string;
    joining: string;
    reserveSpot: string;
    reservingSpot: string;
  };
  onViewResult: () => void;
  onLeaderboard: () => void;    // ended (completed, or joined-but-not-completed) -> Starboard
  onLiveStandings: () => void;  // active + completed -> this contest's own leaderboard
  onContinueLesson: () => void;
  onJoinNow: () => void;
  onReserveSpot: () => void;
}

export default function ContestActions({
  isCompleted, isEnded, isJoined, isLive, isUpcoming, joining, labels,
  onViewResult, onLeaderboard, onLiveStandings, onContinueLesson, onJoinNow, onReserveSpot,
}: ContestActionsProps) {
  // Ended + participated -> View Result (primary) + Leaderboard (secondary)
  if (isCompleted && isEnded) {
    return (
      <>
        <PrimaryActionButton title={labels.viewResult} icon="bar-chart" colors={["#10b981", "#059669"]} onPress={onViewResult} />
        <SecondaryActionButton title={labels.viewLeaderboard} icon="trophy-outline" onPress={onLeaderboard} />
      </>
    );
  }

  // Ended + joined but never completed the quiz -> Leaderboard only
  if (isJoined && !isCompleted && isEnded) {
    return <SecondaryActionButton title={labels.viewLeaderboard} icon="trophy-outline" onPress={onLeaderboard} />;
  }

  // Still active + already completed the quiz -> View Result + live standings
  if (isCompleted && !isEnded) {
    return (
      <>
        <PrimaryActionButton title={labels.viewResult} icon="bar-chart" colors={["#10b981", "#059669"]} onPress={onViewResult} />
        <SecondaryActionButton title={labels.viewLiveStandings} icon="trophy-outline" onPress={onLiveStandings} />
      </>
    );
  }

  // Live + joined, quiz not yet completed -> Continue
  if (!isCompleted && isLive && isJoined) {
    return <PrimaryActionButton title={labels.continueLesson} icon="play" colors={["#4f46e5", "#3730a3"]} onPress={onContinueLesson} />;
  }

  // Live + not joined -> Join Now, strong attention color
  if (!isCompleted && isLive && !isJoined) {
    return (
      <PrimaryActionButton
        title={labels.joinNow}
        icon="flash"
        colors={["#f97316", "#ef4444"]}
        loading={joining}
        loadingTitle={labels.joining}
        onPress={onJoinNow}
      />
    );
  }

  // Upcoming + not joined -> Reserve Spot (real join action; a generic
  // "Set Reminder" secondary CTA was requested in the brief but no
  // reminder/notification-scheduling feature exists in this codebase —
  // see the redesign report for that as a recommended future addition
  // rather than a faked button here).
  if (isUpcoming && !isJoined) {
    return (
      <PrimaryActionButton
        title={labels.reserveSpot}
        icon="calendar"
        colors={["#6366f1", "#4f46e5"]}
        loading={joining}
        loadingTitle={labels.reservingSpot}
        onPress={onReserveSpot}
      />
    );
  }

  return null;
}

const s = StyleSheet.create({
  primaryBtn:   { paddingVertical: 13, borderRadius: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", minHeight: 48 },
  disabled:     { opacity: 0.75 },
  primaryText:  { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },
  // Solid dark-neutral background (not theme-tinted) — the card body itself
  // switches between a light and dark surface with the app theme, so a
  // translucent overlay would wash out to near-invisible text contrast in
  // light mode. An opaque navy fill keeps contrast consistent either way.
  secondaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 11, borderRadius: 14, marginTop: 8, minHeight: 44,
    backgroundColor: "#1e1b4b", borderWidth: 1, borderColor: "rgba(99,102,241,0.35)",
  },
  secondaryText: { color: "#c7d2fe", fontSize: 13, fontWeight: "700" },
});
