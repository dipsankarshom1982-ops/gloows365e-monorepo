// PATH: apps/mobile/components/shikshahub/InstantTutorSheet.tsx
// ShikshaHub redesign — the Instant Tutor hero flow (spec sections 5–7).
//
// There is no server-side broadcast/auto-match engine (see
// functions/src/instantHelp.ts's header comment: direct-request model
// only, one student -> one tutor). This flow stays honest about that: it
// ranks currently-online, subject-matching tutors client-side by rating/
// experience (all real fields) and sends the request to exactly one of
// them via the existing requestInstantHelpCall, same as picking that tutor
// from their profile directly. Nothing here invents a matching algorithm
// the backend doesn't have, or a live number that isn't a real query.
//
// The optional "what do you need help with" description has nowhere to
// live server-side (requestInstantHelp takes only tutorUid+serviceId) —
// rather than collect it and silently drop it, it's relayed to the tutor
// as an opening chat message via the existing sendTutorMessageCall, best
// effort, so it's never fake functionality.
//
// "Notify me when a tutor is available" from the design spec is
// deliberately not implemented — there's no notification infrastructure
// behind it, and promising one would be fake functionality.

import { useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useStudentProfile } from "@gloows/shared-logic";
import type { TutorService } from "@gloows/shared-logic";
import {
  fetchAllInstantHelpServices,
  deriveInstantHelpSubjects,
  rankInstantHelpMatches,
  requestInstantHelpCall,
  sendTutorMessageCall,
  type MarketplaceTutor,
  type InstantHelpCandidate,
} from "@/lib/shikshahub";

type Step = "subject" | "level" | "describe" | "matching" | "match" | "nomatch";

const LEVELS: { key: string; label: string; min?: number; max?: number }[] = [
  { key: "6-8", label: "Class 6–8", min: 6, max: 8 },
  { key: "9-10", label: "Class 9–10", min: 9, max: 10 },
  { key: "11-12", label: "Class 11–12", min: 11, max: 12 },
  { key: "college", label: "College" },
  { key: "other", label: "Other" },
];

export default function InstantTutorSheet({
  visible,
  onClose,
  tutors,
  colors,
  t,
  onBrowseSubject,
}: {
  visible: boolean;
  onClose: () => void;
  tutors: MarketplaceTutor[];
  colors: any;
  t: (key: string) => string | undefined;
  onBrowseSubject: (subject: string) => void;
}) {
  const { studentProfile } = useStudentProfile();
  const [step, setStep] = useState<Step>("subject");
  const [services, setServices] = useState<TutorService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [subject, setSubject] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [candidates, setCandidates] = useState<InstantHelpCandidate[]>([]);
  const [matchIndex, setMatchIndex] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!visible) return;
    setStep("subject");
    setSubject(null);
    setDescription("");
    setErrorMsg("");
    setMatchIndex(0);
    setCandidates([]);
    setServicesLoading(true);

    const cls = studentProfile?.class;
    const n = typeof cls === "number" ? cls : typeof cls === "string" ? Number(cls) : NaN;
    const preset = Number.isFinite(n) ? LEVELS.find((l) => l.min != null && l.max != null && n >= l.min && n <= l.max) : null;
    setLevel(preset?.key ?? null);

    fetchAllInstantHelpServices().then(setServices).catch(() => setServices([])).finally(() => setServicesLoading(false));
  }, [visible, studentProfile?.class]);

  const subjects = useMemo(() => deriveInstantHelpSubjects(tutors, services), [tutors, services]);

  const alternativeTutor = useMemo(() => {
    if (!subject) return null;
    return tutors.find((tu) => tu.subjects.includes(subject) && !tu.isOnlineForInstantHelp)
      ?? tutors.find((tu) => tu.subjects.includes(subject))
      ?? null;
  }, [tutors, subject]);

  function pickSubject(s: string) {
    setSubject(s);
    setStep("level");
  }

  function pickLevel(key: string | null) {
    setLevel(key);
    setStep("describe");
  }

  function findMyTutor() {
    if (!subject) return;
    setStep("matching");
    const ranked = rankInstantHelpMatches(tutors, services, subject);
    setCandidates(ranked);
    setMatchIndex(0);
    setTimeout(() => setStep(ranked.length > 0 ? "match" : "nomatch"), 900);
  }

  async function handleConnect() {
    const candidate = candidates[matchIndex];
    if (!candidate?.service?.id) return;
    setConnecting(true);
    setErrorMsg("");
    try {
      await requestInstantHelpCall(candidate.tutor.uid, candidate.service.id);
      const levelLabel = LEVELS.find((l) => l.key === level)?.label;
      if (description.trim()) {
        const msg = `⚡ Instant Help request — ${subject}${levelLabel ? " · " + levelLabel : ""}\n${description.trim()}`;
        sendTutorMessageCall(candidate.tutor.uid, msg).catch(() => {});
      }
      // No local "waiting" UI here — components/InstantHelpBar.tsx (mounted
      // globally) picks up the new pending request from anywhere in the app.
      onClose();
    } catch (e: any) {
      setErrorMsg(e?.message ?? (t("instantHelpConnectFailed") ?? "Could not connect right now. Please try another tutor."));
    } finally {
      setConnecting(false);
    }
  }

  function viewProfile(uid: string) {
    onClose();
    router.push({ pathname: "/shikshahub/[uid]", params: { uid } } as any);
  }

  function goBack() {
    setErrorMsg("");
    if (step === "level") setStep("subject");
    else if (step === "describe") setStep("level");
    else if (step === "match" || step === "nomatch") setStep("describe");
  }

  const candidate = candidates[matchIndex];
  const showBack = step === "level" || step === "describe" || step === "match" || step === "nomatch";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={S.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[S.sheet, { backgroundColor: colors.card }]}>
        <View style={[S.handle, { backgroundColor: colors.border }]} />

        <View style={S.headerRow}>
          {showBack ? (
            <TouchableOpacity onPress={goBack} style={S.backBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
          ) : <View style={S.backBtn} />}
          <Text style={[S.heading, { color: colors.text }]}>⚡ {t("shikshaHubInstantTutor") ?? "Instant Tutor"}</Text>
          <TouchableOpacity onPress={onClose} style={S.backBtn}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
          {step === "subject" && (
            <View>
              <Text style={[S.stepTitle, { color: colors.text }]}>
                {t("shikshaHubPickSubject") ?? "What subject do you need help with?"}
              </Text>
              {servicesLoading ? (
                <ActivityIndicator color="#14b8a6" style={{ marginTop: 20 }} />
              ) : subjects.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 24, gap: 10 }}>
                  <Text style={{ fontSize: 32 }}>😴</Text>
                  <Text style={[S.emptyText, { color: colors.textSecondary }]}>
                    {t("shikshaHubNoOneOnline") ?? "No tutors are online for Instant Help right now."}
                  </Text>
                  <TouchableOpacity style={S.linkBtn} onPress={onClose}>
                    <Text style={S.linkBtnText}>{t("shikshaHubBrowseInstead") ?? "Browse regular tutors instead"}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={S.chipWrap}>
                  {subjects.map((s) => (
                    <TouchableOpacity key={s} onPress={() => pickSubject(s)} style={[S.pickCard, { borderColor: colors.border }]}>
                      <Text style={[S.pickCardText, { color: colors.text }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {step === "level" && (
            <View>
              <Text style={[S.stepTitle, { color: colors.text }]}>
                {t("shikshaHubPickLevel") ?? "Which class or level?"}
              </Text>
              <View style={S.chipWrap}>
                {LEVELS.map((l) => (
                  <TouchableOpacity
                    key={l.key}
                    onPress={() => pickLevel(l.key)}
                    style={[S.pickCard, { borderColor: colors.border }, level === l.key && S.pickCardActive]}
                  >
                    <Text style={[S.pickCardText, { color: colors.text }, level === l.key && S.pickCardTextActive]}>{l.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={S.skipBtn} onPress={() => pickLevel(null)}>
                <Text style={[S.skipBtnText, { color: colors.textSecondary }]}>{t("shikshaHubSkip") ?? "Skip"}</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === "describe" && (
            <View>
              <Text style={[S.stepTitle, { color: colors.text }]}>
                {t("shikshaHubDescribeNeed") ?? "What do you need help with?"}
              </Text>
              <Text style={[S.stepSubtitle, { color: colors.textSecondary }]}>
                {t("shikshaHubDescribeOptional") ?? "Optional — describe your question or topic"}
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={t("shikshaHubDescribePlaceholder") ?? "e.g. I need help understanding trigonometry"}
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={300}
                style={[S.textArea, { color: colors.text, borderColor: colors.border }]}
              />
              <TouchableOpacity style={S.primaryBtn} onPress={findMyTutor}>
                <Text style={S.primaryBtnText}>⚡ {t("shikshaHubFindMyTutor") ?? "Find My Tutor"}</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === "matching" && (
            <View style={{ alignItems: "center", paddingVertical: 40, gap: 14 }}>
              <ActivityIndicator color="#14b8a6" size="large" />
              <Text style={[S.stepTitle, { color: colors.text, textAlign: "center" }]}>
                {t("shikshaHubMatching") ?? "Finding the best available tutor for you…"}
              </Text>
            </View>
          )}

          {step === "match" && candidate && (
            <View style={{ gap: 12 }}>
              <View style={[S.matchCard, { borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[S.matchName, { color: colors.text }]}>{candidate.tutor.name || "Tutor"}</Text>
                  <Text style={S.verifiedTick}>✓</Text>
                </View>
                {candidate.tutor.ratingAverage != null && candidate.tutor.ratingCount > 0 && (
                  <Text style={[S.matchLine, { color: colors.textSecondary }]}>
                    ⭐ {candidate.tutor.ratingAverage.toFixed(1)} · {candidate.tutor.ratingCount} {t("shikshaHubReviews") ?? "Reviews"}
                  </Text>
                )}
                <Text style={[S.matchLine, { color: colors.textSecondary }]}>🎓 {candidate.service.subject}</Text>
                {candidate.tutor.teachingExperienceYears != null && (
                  <Text style={[S.matchLine, { color: colors.textSecondary }]}>
                    🧑‍🏫 {candidate.tutor.teachingExperienceYears} {t("shikshaHubYearsExp") ?? "years experience"}
                  </Text>
                )}
                <Text style={S.onlineLine}>🟢 {t("shikshaHubAvailableNow") ?? "Available Now"}</Text>
                {candidate.service.creditsPerMinute != null && (
                  <Text style={[S.matchPrice, { color: colors.text }]}>
                    {candidate.service.creditsPerMinute} {t("creditsPerMinuteSuffix") ?? "credits/min"}
                  </Text>
                )}
              </View>

              {errorMsg ? <Text style={S.errorText}>{errorMsg}</Text> : null}

              <TouchableOpacity
                style={[S.primaryBtn, connecting && { opacity: 0.6 }]}
                onPress={handleConnect}
                disabled={connecting}
              >
                <Text style={S.primaryBtnText}>
                  {connecting ? (t("shikshaHubConnecting") ?? "Connecting…") : (t("shikshaHubConnectNow") ?? "Connect Now")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => viewProfile(candidate.tutor.uid)}>
                <Text style={[S.linkBtnText, { textAlign: "center" }]}>{t("shikshaHubViewProfile") ?? "View Profile"}</Text>
              </TouchableOpacity>
              {matchIndex < candidates.length - 1 && (
                <TouchableOpacity onPress={() => setMatchIndex((i) => i + 1)}>
                  <Text style={[S.skipBtnText, { color: colors.textSecondary, textAlign: "center" }]}>
                    {t("shikshaHubTrySomeoneElse") ?? "Try someone else"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {step === "nomatch" && (
            <View style={{ gap: 12 }}>
              <View style={{ alignItems: "center", paddingVertical: 12, gap: 8 }}>
                <Text style={{ fontSize: 32 }}>🤔</Text>
                <Text style={[S.stepTitle, { color: colors.text, textAlign: "center" }]}>
                  {t("shikshaHubNoMatch") ?? "No matching tutor is available right now"}
                </Text>
              </View>

              <TouchableOpacity style={S.primaryBtn} onPress={() => { if (subject) onBrowseSubject(subject); onClose(); }}>
                <Text style={S.primaryBtnText}>{t("shikshaHubBrowseOthers") ?? "Browse Other Tutors"}</Text>
              </TouchableOpacity>
              {alternativeTutor && (
                <TouchableOpacity style={[S.secondaryFullBtn, { borderColor: colors.border }]} onPress={() => viewProfile(alternativeTutor.uid)}>
                  <Text style={[S.secondaryFullBtnText, { color: colors.text }]}>{t("shikshaHubScheduleSession") ?? "Schedule a Session"}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => { setSubject(null); setStep("subject"); }}>
                <Text style={[S.linkBtnText, { textAlign: "center" }]}>{t("shikshaHubChangeSubject") ?? "Change Subject"}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingBottom: 30, maxHeight: "88%" },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  heading: { fontSize: 16, fontWeight: "900" },

  stepTitle: { fontSize: 16, fontWeight: "800", marginBottom: 4 },
  stepSubtitle: { fontSize: 12, fontWeight: "600", marginBottom: 12 },
  emptyText: { fontSize: 13, fontWeight: "600", textAlign: "center" },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  pickCard: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  pickCardActive: { backgroundColor: "rgba(20,184,166,0.15)", borderColor: "#14b8a6" },
  pickCardText: { fontSize: 13, fontWeight: "700" },
  pickCardTextActive: { color: "#0d9488" },

  skipBtn: { alignSelf: "center", marginTop: 16 },
  skipBtnText: { fontSize: 12.5, fontWeight: "700" },

  textArea: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 13, fontWeight: "500", minHeight: 90, textAlignVertical: "top", marginBottom: 16 },

  primaryBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center", backgroundColor: "#0f766e" },
  primaryBtnText: { color: "#fff", fontSize: 14.5, fontWeight: "800" },
  secondaryFullBtn: { borderWidth: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  secondaryFullBtnText: { fontSize: 13.5, fontWeight: "700" },
  linkBtn: { marginTop: 4 },
  linkBtnText: { fontSize: 12.5, fontWeight: "700", color: "#0d9488" },

  matchCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 4, backgroundColor: "rgba(20,184,166,0.06)" },
  matchName: { fontSize: 18, fontWeight: "900" },
  verifiedTick: { fontSize: 14, fontWeight: "900", color: "#14b8a6" },
  matchLine: { fontSize: 12.5, fontWeight: "600" },
  onlineLine: { fontSize: 12, fontWeight: "800", color: "#10b981", marginTop: 4 },
  matchPrice: { fontSize: 16, fontWeight: "900", marginTop: 6 },
  errorText: { fontSize: 12, fontWeight: "600", color: "#ef4444" },
});
