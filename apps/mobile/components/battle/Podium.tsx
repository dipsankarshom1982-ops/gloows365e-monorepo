// PATH: components/battle/Podium.tsx
// Phase 2D-6 — extracted from battle-competition.tsx (Phase 2D-5) so
// Competition and the new Results screen share ONE podium implementation
// instead of two independently-maintained copies (brief §21 "use existing
// shared battle components where appropriate").
//
// Presentation ONLY: every entry passed in must already carry an
// authoritative `.rank` (1/2/3) from the locked battleResults doc — this
// component never derives rank from array position, never computes a
// score, and never decides who's a winner. It only lays out whatever
// three entries its caller already filtered.

import { StyleSheet, Text, View } from "react-native";

const ACCENT = "#ff9f43";

export interface PodiumEntry {
  submissionId: string;
  studentName: string;
  score: number;
  rank: number; // authoritative — always 1, 2, or 3 by the time it reaches here
}

function medalFor(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

export default function Podium({ entries }: { entries: PodiumEntry[] }) {
  // Visual order left-to-right: 2nd / 1st / 3rd — matches the legacy
  // SkillBoard podium's language (skillboard.tsx's renderPodium).
  const byRank = (r: number) => entries.find((e) => e.rank === r);
  const ordered = [byRank(2), byRank(1), byRank(3)].filter(Boolean) as PodiumEntry[];
  if (ordered.length === 0) return null;

  return (
    <View style={styles.row}>
      {ordered.map((e) => (
        <View
          key={e.submissionId}
          style={styles.item}
          accessibilityLabel={`Rank ${e.rank}: ${e.studentName}, ${e.score} points`}
        >
          <View style={[styles.avatar, e.rank === 1 && styles.avatarLarge]}>
            <Text style={styles.initial}>{e.studentName.charAt(0).toUpperCase() || "S"}</Text>
          </View>
          <Text style={styles.medal}>{medalFor(e.rank)}</Text>
          <Text style={styles.name} numberOfLines={1}>{e.studentName}</Text>
          <Text style={styles.score}>{e.score} pts</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 10 },
  item: { alignItems: "center", flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,159,67,0.18)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: ACCENT },
  avatarLarge: { width: 54, height: 54, borderRadius: 27 },
  initial: { color: ACCENT, fontSize: 17, fontWeight: "900" },
  medal: { fontSize: 14, marginTop: 2 },
  name: { color: "#fff", fontSize: 11, fontWeight: "800", marginTop: 2, maxWidth: 80 },
  score: { color: "#ffd166", fontSize: 11, fontWeight: "800" },
});
