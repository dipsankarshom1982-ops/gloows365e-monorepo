// PATH: app/battle-details.tsx
// Phase 2D-3 — new Battle Details screen (Phase 2D-1 blueprint §9,
// Phase 2D-3 brief §13-26). The authoritative pre-participation info
// page: Challenge / Skill / Eligibility / Timeline / Rules / Reward /
// Fair Play, plus a CTA driven entirely by authoritative battle +
// submission state (resolveBattleExperience.ts's state machine).
//
// Route convention matches the existing app: a flat top-level file
// (same pattern as Createreelscreen.tsx, skillboard.tsx — not a nested
// [battleId] dynamic segment, since this codebase consistently pushes
// params rather than using path segments for this feature).
//
// NOT built here (explicitly out of scope — brief §38): Competition,
// Results, Winner Announcement, SkillBoard, Trophy Case, Battle History.
// The "View Results" and "Enter Competition" CTAs below navigate to the
// closest existing safe destination (the legacy /skillboard screen, or
// nowhere yet for canonical battles) rather than a screen that doesn't
// exist — see handleCTAPress().

import Header from "@/components/header";
import { BattleDetailsSkeleton } from "@/components/battle/SkeletonBlock";
import EmptyState from "@/components/battle/EmptyState";
import BattleStatusBadge from "@/components/battle/BattleStatusBadge";
import Countdown from "@/components/battle/Countdown";
import { fetchMySubmissionStatus } from "@/components/battle/fetchMySubmissionStatus";
import {
  buildBattleCardViewModel, classifyBattleEngine, isEligibleForClasses,
  normalizeEligibleClasses, resolveCTAState, CTA_COPY, type RawBattle,
} from "@/components/battle/resolveBattleExperience";
import type { BattleDetailsViewModel } from "@/components/battle/types";
import { useTheme } from "@/context/ThemeContext";
import { auth, db } from "@/lib/firebase";
import { getActiveSkillCategories, getActiveSkills } from "@/services/skillTaxonomyService";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ACCENT = "#ff9f43";

export default function BattleDetailsScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ battleId?: string }>();
  const battleId = params.battleId;

  const [details, setDetails] = useState<BattleDetailsViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!battleId) { setError("Missing battle."); setLoading(false); return; }
    setError("");
    try {
      const [battleSnap, studentSnap, skills, categories] = await Promise.all([
        getDoc(doc(db, "skillBattles", battleId)),
        auth.currentUser ? getDoc(doc(db, "students", auth.currentUser.uid)) : Promise.resolve(null),
        getActiveSkills(),
        getActiveSkillCategories(),
      ]);

      if (!battleSnap.exists()) {
        setError("This battle is currently unavailable.");
        setLoading(false);
        return;
      }
      const raw = { id: battleSnap.id, ...battleSnap.data() } as RawBattle;
      const card = buildBattleCardViewModel(raw, { skills, categories });
      const eligibleClasses = normalizeEligibleClasses(raw.eligibleClasses);
      const studentClass = studentSnap?.exists() ? String(studentSnap.data()?.class ?? "") : "";
      const isEligible = studentSnap ? isEligibleForClasses(studentClass, eligibleClasses) : null;

      const uid = auth.currentUser?.uid;
      const mySubmissionStatus = uid ? await fetchMySubmissionStatus(raw, uid) : "NONE";

      const cta = resolveCTAState({
        engine: card.engine, status: card.status, isEligible,
        mySubmissionStatus: mySubmissionStatus === "WITHDRAWN" ? "NONE" : mySubmissionStatus,
      });

      setDetails({
        ...card,
        description: raw.description,
        eligibilityLabel: eligibleClasses.length > 0
          ? `Class ${eligibleClasses[0]}${eligibleClasses.length > 1 ? `–${eligibleClasses[eligibleClasses.length - 1]}` : ""}`
          : "Open to all classes",
        isEligible,
        timeline: {
          opensAt: raw.startDate ? new Date(raw.startDate) : null,
          submissionDeadline: card.deadline,
          resultsAt: null, // brief §19 — no authoritative results-date field exists; never invented
        },
        mySubmissionStatus,
        rejectionReason: undefined,
        cta,
      });
    } catch {
      setError("Couldn't load this battle. Try again.");
    } finally {
      setLoading(false);
    }
  }, [battleId]);

  useEffect(() => { load(); }, [load]);

  const handleCTAPress = () => {
    if (!details) return;
    switch (details.cta) {
      case "SUBMIT":
        router.push({
          pathname: "/Createreelscreen",
          params: { battleId: details.id, battleTitle: details.title, battleType: "sponsored", month: "" },
        });
        return;
      case "PENDING_MODERATION":
      case "REJECTED":
        // "My Submission Status" already lives inside Createreelscreen
        // today (brief §25) — reuse it rather than build a second status
        // view in this phase.
        router.push({ pathname: "/Createreelscreen", params: { battleId: details.id, battleTitle: details.title, battleType: "sponsored", month: "" } });
        return;
      case "APPROVED_COMPETING":
        // Phase 2D-5 — canonical battles now have a real Competition
        // screen (submissions/battle-ranking-engine-aware). Legacy battles
        // keep their existing status view (Createreelscreen) unchanged —
        // this CTA state is shared by both engines (resolveCTAState isn't
        // engine-gated here), so the split happens on navigation, not by
        // adding a second engine-detection mechanism.
        if (details.engine === "canonical") {
          router.push({ pathname: "/battle-competition" as any, params: { battleId: details.id } });
        } else {
          router.push({ pathname: "/Createreelscreen", params: { battleId: details.id, battleTitle: details.title, battleType: "sponsored", month: "" } });
        }
        return;
      case "VIEW_RESULTS":
        if (details.engine === "legacy") {
          router.push({ pathname: "/skillboard", params: { battleId: details.id } });
        } else {
          // Phase 2D-5 — the Competition screen self-detects `final` from
          // Phase 2C's own APIs (battleResults existence) and renders the
          // locked leaderboard; no separate Results screen exists yet
          // (explicitly out of scope — Phase 2D-6).
          router.push({ pathname: "/battle-competition" as any, params: { battleId: details.id } });
        }
        return;
      case "COMING_SOON":
        Alert.alert("Coming Soon", "Submissions for this battle open soon.");
        return;
      default:
        return;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header hideMenu />
        <BattleDetailsSkeleton />
      </SafeAreaView>
    );
  }

  if (error || !details) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header hideMenu />
        <EmptyState emoji="⚠️" title={error || "This battle is currently unavailable."} actionLabel="Retry" onAction={load} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header hideMenu />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Challenge hero (§15) */}
        <LinearGradient colors={["#2a1500", "#1a0e00"]} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {details.skill ? (
            <Text style={styles.skillLabel}>🎯 {details.skill.name}</Text>
          ) : null}
          <Text style={styles.heroTitle}>{details.title}</Text>
          {details.description ? <Text style={styles.heroDesc} numberOfLines={4}>{details.description}</Text> : null}
          <View style={styles.heroFooter}>
            {details.reward ? <Text style={styles.heroReward}>🏆 {details.reward.label}</Text> : null}
            <BattleStatusBadge status={details.status} />
          </View>
          {details.status === "LIVE" && (
            <View style={styles.heroTimer}>
              <Ionicons name="time-outline" size={13} color="#ffd166" />
              <Countdown deadline={details.deadline} />
            </View>
          )}
        </LinearGradient>

        {/* Skill + Category (§16) */}
        {details.skill && (
          <Card title="Skill">
            <Row label="Skill" value={`🎤 ${details.skill.name}`} />
            {details.skill.categoryName ? <Row label="Category" value={details.skill.categoryName} /> : null}
          </Card>
        )}

        {/* Eligibility (§17/§18 — privacy-safe scope, never exact location) */}
        <Card title="Eligibility">
          <Row label="Classes" value={details.eligibilityLabel} />
          <Row label="Scope" value={details.scope?.label ?? "All India"} />
          {details.isEligible === true && (
            <Text style={styles.eligibleYes}>✓ You are eligible</Text>
          )}
          {details.isEligible === false && (
            <Text style={styles.eligibleNo}>You are not eligible for this battle.</Text>
          )}
        </Card>

        {/* Timeline (§19) */}
        <Card title="Battle Timeline">
          {details.timeline.opensAt ? (
            <Row label="Opens" value={formatDate(details.timeline.opensAt)} />
          ) : null}
          <Row label="Submission deadline" value={details.timeline.submissionDeadline ? formatDate(details.timeline.submissionDeadline) : "Ongoing"} />
          <Row label="Results" value="Results will be announced after finalization." />
        </Card>

        {/* Rules (§20) */}
        <Card title="Rules">
          <BulletText>Open to eligible students in the classes/scope shown above.</BulletText>
          <BulletText>One submission per student per battle.</BulletText>
          <BulletText>Videos must follow Gloows365's content guidelines and be your own original work.</BulletText>
          <BulletText>Every submission is reviewed before it appears in the competition.</BulletText>
          <BulletText>Final results and winners are determined by Gloows365's competition system.</BulletText>
        </Card>

        {/* Scoring explanation (§21) — matches Phase 2C's actual V1 inputs exactly */}
        <Card title="How Scoring Works">
          <BulletText good>Verified views</BulletText>
          <BulletText good>Verified likes</BulletText>
          <BulletText good>Participation</BulletText>
          <Text style={styles.scoringNote}>
            Fair-play protections help prevent artificial engagement from affecting results.
          </Text>
        </Card>

        {/* Reward (§22) */}
        <Card title="🏆 Rewards">
          <Row label="Winner" value={details.reward?.label ?? "To be announced"} />
          <Text style={styles.scoringNote}>Top performers may also earn SkillBoard achievements.</Text>
        </Card>

        {/* Fair Play (§23) */}
        <Card title="Fair Play">
          <BulletText>One student can submit once per battle.</BulletText>
          <BulletText>Artificial engagement is not allowed.</BulletText>
          <BulletText>Self-engagement is not counted.</BulletText>
          <BulletText>Suspicious activity may be excluded from results.</BulletText>
          <BulletText>Final results are determined by Gloows365's competition system.</BulletText>
        </Card>

        {/* Submission status (§25), if any */}
        {details.mySubmissionStatus && details.mySubmissionStatus !== "NONE" && (
          <Card title="Your Submission">
            <SubmissionStatusRow status={details.mySubmissionStatus} />
          </Card>
        )}

        <View style={{ height: 8 }} />
      </ScrollView>

      <View style={[styles.ctaBar, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={handleCTAPress}
          disabled={details.cta === "NOT_ELIGIBLE" || details.cta === "CANCELLED" || details.cta === "SUBMISSIONS_CLOSED"}
          accessibilityRole="button"
          accessibilityLabel={CTA_COPY[details.cta]}
          style={({ pressed }) => [
            styles.ctaBtn,
            { backgroundColor: ctaEnabled(details.cta) ? ACCENT : "rgba(255,255,255,0.12)" },
            pressed && ctaEnabled(details.cta) && { opacity: 0.88 },
          ]}
        >
          <Text style={[styles.ctaText, { color: ctaEnabled(details.cta) ? "#fff" : "rgba(255,255,255,0.5)" }]}>
            {CTA_COPY[details.cta]}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ctaEnabled(cta: BattleDetailsViewModel["cta"]): boolean {
  return cta === "SUBMIT" || cta === "PENDING_MODERATION" || cta === "APPROVED_COMPETING"
    || cta === "REJECTED" || cta === "VIEW_RESULTS" || cta === "COMING_SOON";
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function BulletText({ children, good }: { children: string; good?: boolean }) {
  return (
    <Text style={styles.bullet}>
      <Text style={{ color: good ? "#06d6a0" : ACCENT }}>{good ? "✓ " : "• "}</Text>
      {children}
    </Text>
  );
}

function SubmissionStatusRow({ status }: { status: NonNullable<BattleDetailsViewModel["mySubmissionStatus"]> }) {
  const cfg: Record<string, { text: string; color: string }> = {
    PENDING_MODERATION: { text: "✓ Submitted — Under review", color: "#f39c12" },
    APPROVED: { text: "✅ Approved — You're competing!", color: "#2ecc71" },
    REJECTED: { text: "❌ Submission not approved", color: "#e74c3c" },
  };
  const c = cfg[status];
  if (!c) return null;
  return <Text style={{ color: c.color, fontSize: 13, fontWeight: "800" }}>{c.text}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 14, paddingBottom: 24 },
  hero: { borderRadius: 20, padding: 18, gap: 8 },
  skillLabel: { color: "#ffd166", fontSize: 12, fontWeight: "800" },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "900", lineHeight: 28 },
  heroDesc: { color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 19 },
  heroFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  heroReward: { color: "#06d6a0", fontSize: 16, fontWeight: "900" },
  heroTimer: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },

  card: { backgroundColor: "rgba(255,255,255,0.035)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 14, gap: 10 },
  cardTitle: { fontSize: 13, fontWeight: "900", color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rowLabel: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.5)" },
  rowValue: { fontSize: 13, fontWeight: "800", color: "#fff", flexShrink: 1, textAlign: "right" },
  bullet: { fontSize: 12.5, lineHeight: 19, color: "rgba(255,255,255,0.75)" },
  scoringNote: { fontSize: 11, color: "rgba(255,255,255,0.45)", fontStyle: "italic", marginTop: 2 },
  eligibleYes: { color: "#06d6a0", fontSize: 13, fontWeight: "800", marginTop: 2 },
  eligibleNo: { color: "#ff6b9d", fontSize: 13, fontWeight: "800", marginTop: 2 },

  ctaBar: { padding: 14, borderTopWidth: 1 },
  ctaBtn: { paddingVertical: 15, borderRadius: 14, alignItems: "center" },
  ctaText: { fontSize: 15, fontWeight: "900" },
});
