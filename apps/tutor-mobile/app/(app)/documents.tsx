// apps/tutor-mobile/app/(app)/documents.tsx
// "My Documents" — mirrors apps/tutor/src/app/(app)/documents/page.tsx.
// Upload uses expo-document-picker, this app's established pattern (see
// components/onboarding/Step4Qualifications.tsx) — a separate local copy
// rather than a shared import, same reasoning as PhoneVerifyModal's.

import { useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";
import { Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { colors, semantic, spacing } from "@gloows/tutor-ui";
import { useTutorProfile } from "@gloows/shared-logic";
import type { TutorOnboardingDocument } from "@gloows/shared-logic";
import { db, storage } from "@/lib/firebase";
import { Badge, Card, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const MAX_DOC_BYTES = 10 * 1024 * 1024;

type DocCategory = "qualification" | "experience" | "certificate";
type FieldName = "qualificationDocuments" | "experienceDocuments" | "additionalCertificates";

const SECTIONS: { category: DocCategory; field: FieldName; multiple: boolean; titleKey: string; hintKey: string }[] = [
  { category: "qualification", field: "qualificationDocuments", multiple: false, titleKey: "ob4QualificationDocTitle", hintKey: "ob4QualificationDocHint" },
  { category: "experience", field: "experienceDocuments", multiple: false, titleKey: "ob4ExperienceDocTitle", hintKey: "ob4ExperienceDocHint" },
  { category: "certificate", field: "additionalCertificates", multiple: true, titleKey: "ob4CertificatesTitle", hintKey: "ob4CertificatesHint" },
];

function statusTone(status: TutorOnboardingDocument["status"]): "default" | "success" | "warning" | "danger" {
  if (status === "verified") return "success";
  if (status === "rejected") return "danger";
  if (status === "under_review" || status === "submitted") return "warning";
  return "default";
}

function statusKey(status: TutorOnboardingDocument["status"]): string {
  switch (status) {
    case "verified": return "dashDocStatusVerified";
    case "rejected": return "dashDocStatusRejected";
    case "under_review": return "dashDocStatusUnderReview";
    case "submitted": return "dashDocStatusSubmitted";
    default: return "dashDocStatusNotSubmitted";
  }
}

function formatDate(ts: unknown): string {
  const d = (ts as { toDate?: () => Date } | undefined)?.toDate?.();
  if (!d) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentSection({
  uid, category, field, multiple, titleKey, hintKey, docs, t,
}: {
  uid: string; category: DocCategory; field: FieldName; multiple: boolean;
  titleKey: string; hintKey: string; docs: TutorOnboardingDocument[]; t: (k: string, o?: any) => string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // QA fix — see apps/tutor's documents/page.tsx counterpart: only
  // relevant for single-document categories, not `multiple` ones.
  const approvedLocked = !multiple && docs.some((d) => d.status === "verified" || d.status === "under_review");

  async function saveDocs(next: TutorOnboardingDocument[]) {
    await setDoc(doc(db, "tutors", uid), { [field]: next, updatedAt: new Date() }, { merge: true });
  }

  async function handlePick() {
    const result = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"], multiple: false });
    if (result.canceled || !result.assets?.[0]) return;
    const file = result.assets[0];
    if ((file.size ?? 0) > MAX_DOC_BYTES) { setError(t("dashDocTooLargeError")); return; }

    setError(null);
    setUploading(true);
    try {
      const storagePath = `tutorDocuments/${uid}/${category}_${Date.now()}_${file.name}`;
      const response = await fetch(file.uri);
      const blob = await response.blob();
      await uploadBytes(ref(storage, storagePath), blob);
      const url = await getDownloadURL(ref(storage, storagePath));
      // QA fix — see apps/tutor's documents/page.tsx counterpart: only a
      // single-document (non-multiple) category is ever a "replacement".
      const version = multiple ? 1 : (docs[0]?.version ?? 0) + 1;
      const newDoc: TutorOnboardingDocument = {
        name: file.name, storagePath: url, status: "submitted",
        mimeType: file.mimeType, fileSize: file.size, version, uploadedAt: new Date(),
      };
      const previous = multiple ? null : docs[0];
      await saveDocs(multiple ? [...docs, newDoc] : [newDoc]);
      // QA fix — see apps/tutor's documents/page.tsx counterpart: clean
      // up the replaced file so it isn't left as a still-downloadable
      // orphan with no Firestore reference.
      if (previous) {
        try { await deleteObject(ref(storage, previous.storagePath)); } catch { /* best-effort */ }
      }
    } catch {
      setError(t("dashDocUploadFailedError"));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(index: number) {
    const target = docs[index];
    await saveDocs(docs.filter((_, i) => i !== index));
    if (target) { try { await deleteObject(ref(storage, target.storagePath)); } catch { /* best-effort */ } }
  }

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={{ fontSize: 14, fontWeight: "900", color: semantic.textPrimary }}>{t(titleKey)}</Text>
      <Text style={{ fontSize: 12, color: semantic.textMuted, marginTop: 2, marginBottom: spacing.sm }}>{t(hintKey)}</Text>

      {docs.map((d, i) => (
        <View key={d.storagePath} style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.slate[700], backgroundColor: semantic.background, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: semantic.textSecondary }}>📎 {d.name}</Text>
              <Text style={{ fontSize: 11, color: semantic.textMuted, marginTop: 2 }}>
                {formatDate(d.uploadedAt)}{d.fileSize ? ` · ${formatSize(d.fileSize)}` : ""}{d.version ? ` · v${d.version}` : ""}
              </Text>
            </View>
            <Badge tone={statusTone(d.status)} label={t(statusKey(d.status))} />
          </View>
          {d.status === "rejected" && d.rejectionReason && (
            <Text style={{ fontSize: 12, color: colors.danger, marginTop: 6 }}>{d.rejectionReason}</Text>
          )}
          <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
            <TouchableOpacity onPress={() => Linking.openURL(d.storagePath)}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: semantic.accent }}>{t("dashDocView")}</Text>
            </TouchableOpacity>
            {d.status !== "verified" && d.status !== "under_review" && (
              <TouchableOpacity onPress={() => handleDelete(i)}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.slate[500] }}>{t("dashDocDelete")}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}

      {(multiple || docs.length === 0) && !approvedLocked && (
        <TouchableOpacity onPress={handlePick} disabled={uploading}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: semantic.accent, opacity: uploading ? 0.5 : 1 }}>
            {uploading ? t("ob4Uploading") : docs.length > 0 ? (multiple ? t("ob4AddAnother") : t("dashDocReplace")) : t("ob4UploadFile")}
          </Text>
        </TouchableOpacity>
      )}
      {approvedLocked && docs.length > 0 && !multiple && (
        <Text style={{ fontSize: 12, color: colors.slate[600] }}>{t("dashDocLockedNote")}</Text>
      )}
      {error && <Text style={{ fontSize: 12, color: colors.danger, fontWeight: "600", marginTop: 6 }}>{error}</Text>}
    </Card>
  );
}

export default function DocumentsScreen() {
  const { t } = useTranslation();
  const { user, tutorProfile, profileLoading } = useTutorProfile();

  if (profileLoading || !user || !tutorProfile) return <LoadingState />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: semantic.textPrimary, marginBottom: 2 }}>{t("dashDocumentsTitle")}</Text>
        <Text style={{ fontSize: 13, color: semantic.textSecondary, marginBottom: spacing.lg }}>{t("dashDocumentsSubtitle")}</Text>

        {SECTIONS.map((s) => (
          <DocumentSection
            key={s.field}
            uid={user.uid}
            category={s.category}
            field={s.field}
            multiple={s.multiple}
            titleKey={s.titleKey}
            hintKey={s.hintKey}
            docs={(tutorProfile[s.field] as TutorOnboardingDocument[] | undefined) ?? []}
            t={t}
          />
        ))}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}
