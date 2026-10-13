// PATH: apps/mobile/components/ReportVideoModal.tsx
//
// Student-facing "Report Video" flow for Skill Battle reels. Shared by
// both reels feed screens (app/reels.tsx and
// app/(drawer)/(tabs)/reels.tsx) so the reporting UI/logic exists in
// exactly one place rather than being pasted into each nearly-identical
// screen.
//
// SECURITY: the ONLY Firestore-adjacent call this file makes is the
// trusted `reportSkillBattleContent` Cloud Function callable — it never
// writes to `skillBattleReports` directly (firestore.rules already deny
// that unconditionally; see functions/src/moderation/reporting.ts).
// Reporter identity comes from the callable's own context.auth server-
// side — there is no reporterUid field on this callable's input at all
// for a client to forge. Category values below are the EXACT strings
// reporting.ts's VALID_CATEGORIES accepts — do not add or rename one
// here without updating that backend set too.
//
// The description field is plain React Native <Text> — RN has no HTML
// rendering path for a string prop, so there is no injection surface to
// defend against here on the client; the admin-side display
// (SkillBattleModeration.tsx) renders it the same safe way.

import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export type ReportContentType = "post" | "submission";

// Exact category values functions/src/moderation/reporting.ts's
// VALID_CATEGORIES accepts — see that file's header before changing any
// of these strings.
const REPORT_CATEGORIES: { value: string; label: string }[] = [
  { value: "copyright", label: "Copyright / stolen content" },
  { value: "reuploaded", label: "Reuploaded or copied video" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "harassment", label: "Harassment" },
  { value: "violence", label: "Violence" },
  { value: "dangerous_activity", label: "Dangerous activity" },
  { value: "spam", label: "Spam" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Other" },
];

const MAX_NOTE_LENGTH = 500;

// reportSkillBattleContent's own required fields — see that file's
// SubmitReportInput. `note` (not "description") is the backend's actual
// field name for the optional free-text details.
const reportSkillBattleContentFn = httpsCallable<
  { contentType: ReportContentType; contentId: string; battleId: string; category: string; note?: string },
  { reportId: string; quarantined: boolean }
>(functions, "reportSkillBattleContent");

interface ReportVideoModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: ReportContentType;
  contentId: string;
  battleId: string;
  colors: any;
}

export default function ReportVideoModal({
  visible, onClose, contentType, contentId, battleId, colors,
}: ReportVideoModalProps) {
  const [category, setCategory] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<"form" | "success">("form");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reset = () => {
    setCategory(null);
    setNote("");
    setSubmitting(false);
    setPhase("form");
    setErrorMsg(null);
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    // Guards against a required-but-missing category and against a
    // repeated tap while a request is already in flight — the submit
    // button is also disabled in that state (see below), this is the
    // second layer.
    if (!category || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const trimmedNote = note.trim();
      await reportSkillBattleContentFn({
        contentType,
        contentId,
        battleId,
        category,
        // Optional per the backend (Step 5: "do not require a description
        // unless the existing backend requires it" — it doesn't) — an
        // empty/whitespace-only value is simply omitted, not sent as "".
        note: trimmedNote ? trimmedNote.slice(0, MAX_NOTE_LENGTH) : undefined,
      });
      setPhase("success");
    } catch (e: any) {
      // Never surface e.message/stack/Firebase internals directly — map
      // every known code to one of the plain, pre-approved messages
      // (Step 10). code arrives as e.g. "functions/already-exists".
      const code: string = e?.code || e?.details?.code || "";
      if (code.includes("already-exists")) {
        setErrorMsg("You've already reported this video.");
      } else if (code.includes("unauthenticated")) {
        setErrorMsg("Please log in to report a video.");
      } else if (code.includes("not-found")) {
        setErrorMsg("This video is no longer available.");
      } else if (code.includes("permission-denied")) {
        setErrorMsg("You can't report this content right now.");
      } else if (code.includes("resource-exhausted") || code.includes("cancelled")) {
        setErrorMsg("Please wait a moment before trying again.");
      } else if (code.includes("unavailable") || code.includes("deadline-exceeded") || /network/i.test(e?.message ?? "")) {
        setErrorMsg("We couldn't submit your report. Please check your connection and try again.");
      } else {
        // Covers invalid-argument and anything unrecognized — a real
        // invalid-category here would be a client bug (the picker only
        // ever sends a known-valid value), not something to explain in
        // backend terms to a student.
        setErrorMsg("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          {phase === "success" ? (
            <View style={styles.successWrap} accessibilityRole="alert" accessibilityLiveRegion="polite">
              <Text style={{ fontSize: 40 }}>✅</Text>
              <Text style={[styles.successTitle, { color: colors.text }]}>Report submitted</Text>
              <Text style={[styles.successText, { color: colors.textSecondary }]}>
                Thank you. We&apos;ve received your report and will review the content.
              </Text>
              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: colors.accent }]}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Done"
                hitSlop={8}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Report Video</Text>
                <TouchableOpacity onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close report dialog" hitSlop={8}>
                  <Text style={[styles.close, { color: colors.accent }]}>Close</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Help us keep Skill Battle safe and fair.
              </Text>

              <ScrollView style={styles.reasonList} showsVerticalScrollIndicator={false}>
                {REPORT_CATEGORIES.map((c) => {
                  const selected = category === c.value;
                  return (
                    <TouchableOpacity
                      key={c.value}
                      style={[
                        styles.reasonRow,
                        { borderColor: selected ? colors.accent : colors.border },
                        selected && { backgroundColor: `${colors.accent}15` },
                      ]}
                      onPress={() => setCategory(c.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={c.label}
                      hitSlop={4}
                    >
                      <View style={[styles.radioOuter, { borderColor: selected ? colors.accent : colors.border }]}>
                        {selected && <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />}
                      </View>
                      <Text style={[styles.reasonText, { color: colors.text }]}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.fieldLabel, { color: colors.text }]}>Additional details (optional)</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Tell us briefly what is wrong with this video."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                maxLength={MAX_NOTE_LENGTH}
                style={[styles.noteInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                accessibilityLabel="Additional details"
                accessibilityHint="Optional. Briefly describe what is wrong with this video."
              />
              <Text style={[styles.charCount, { color: colors.textSecondary }]}>{note.length}/{MAX_NOTE_LENGTH}</Text>

              <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
                Reports are reviewed by Gloows365. False or abusive reports may be ignored.
              </Text>

              {errorMsg && (
                <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="assertive">
                  {errorMsg}
                </Text>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.accent, opacity: category && !submitting ? 1 : 0.5 }]}
                disabled={!category || submitting}
                onPress={handleSubmit}
                accessibilityRole="button"
                accessibilityLabel="Submit Report"
                accessibilityState={{ disabled: !category || submitting, busy: submitting }}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitBtnText}>Submit Report</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  card: { minHeight: "45%", maxHeight: "85%", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { fontSize: 18, fontWeight: "800" },
  close: { fontSize: 14, fontWeight: "700", paddingVertical: 4, paddingHorizontal: 4 },
  subtitle: { fontSize: 13, marginBottom: 14 },

  reasonList: { maxHeight: 280, marginBottom: 12 },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, minHeight: 48 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  reasonText: { fontSize: 14, fontWeight: "600", flex: 1 },

  fieldLabel: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  noteInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 13, minHeight: 70, textAlignVertical: "top" },
  charCount: { textAlign: "right", fontSize: 11, marginTop: 4 },

  disclaimer: { fontSize: 11, lineHeight: 16, marginTop: 14, marginBottom: 10 },
  errorText: { color: "#e74c3c", fontSize: 12, fontWeight: "700", marginBottom: 10, textAlign: "center" },

  submitBtn: { minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 4 },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  successWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 30, gap: 10 },
  successTitle: { fontSize: 18, fontWeight: "800" },
  successText: { fontSize: 13, textAlign: "center", paddingHorizontal: 20, lineHeight: 19 },
  doneBtn: { marginTop: 14, minHeight: 44, paddingHorizontal: 32, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  doneBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
