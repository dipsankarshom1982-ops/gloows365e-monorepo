import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import * as DocumentPicker from "expo-document-picker";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { useTutorProfile } from "@gloows/shared-logic";
import { db, storage, functions } from "@/lib/firebase";
import { Badge, Button, Card, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

type Status = "Draft" | "Submitted" | "Under Review" | "Verified" | "Rejected" | "Suspended";
type DocRef = { name: string; storagePath: string };

const submitTutorVerificationFn = httpsCallable<{ documents: DocRef[] }, { status: Status }>(
  functions, "submitTutorVerification"
);

const STATUS_TONE: Record<Status, "default" | "success" | "warning" | "danger"> = {
  Draft: "default", Submitted: "warning", "Under Review": "warning",
  Verified: "success", Rejected: "danger", Suspended: "danger",
};

export default function VerificationScreen() {
  const { t } = useTranslation();
  const { user } = useTutorProfile();

  const [verification, setVerification] = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [picked, setPicked]       = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "tutorVerifications", user.uid), (snap) => {
      setVerification(snap.exists() ? snap.data() : null);
      setLoading(false);
    });
  }, [user]);

  async function handlePick() {
    const result = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"], multiple: true });
    if (!result.canceled) setPicked(result.assets);
  }

  async function handleSubmit() {
    if (!user || picked.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const documents: DocRef[] = await Promise.all(picked.map(async (file) => {
        const storagePath = `tutorDocuments/${user.uid}/${Date.now()}_${file.name}`;
        const response = await fetch(file.uri);
        const blob = await response.blob();
        await uploadBytes(ref(storage, storagePath), blob);
        return { name: file.name, storagePath };
      }));
      await submitTutorVerificationFn({ documents });
      setPicked([]);
    } catch (err: any) {
      setError(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const status: Status = verification?.status ?? "Draft";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary, marginBottom: 4 }}>{t("verificationTitle")}</Text>
        <Text style={{ color: semantic.textMuted, fontSize: 13, marginBottom: spacing.xl }}>{t("verificationSubtitle")}</Text>

        {loading ? <LoadingState /> : (
          <Card style={{ marginBottom: spacing.xl }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: semantic.textMuted, fontSize: 12, fontWeight: "700" }}>Status</Text>
              <Badge label={t(`status${status.replace(" ", "")}`)} tone={STATUS_TONE[status]} />
            </View>
            {status === "Rejected" && verification?.rejectionReason && (
              <Text style={{ color: semantic.danger, fontSize: 12, marginTop: spacing.sm }}>
                {t("rejectionReasonLabel")}: {verification.rejectionReason}
              </Text>
            )}
          </Card>
        )}

        {(status === "Draft" || status === "Rejected") && (
          <>
            <Button title={t("uploadDocument")} variant="secondary" onPress={handlePick} />
            {picked.length > 0 && (
              <View style={{ marginTop: spacing.md, marginBottom: spacing.md }}>
                {picked.map((f) => <Text key={f.uri} style={{ color: semantic.textMuted, fontSize: 12 }}>📎 {f.name}</Text>)}
              </View>
            )}
            {error && <Text style={{ color: semantic.danger, fontSize: 12, fontWeight: "700", marginVertical: spacing.sm }}>{error}</Text>}
            <View style={{ marginTop: spacing.md }}>
              <Button title={uploading ? t("loading") : t("submitForReview")} onPress={handleSubmit} loading={uploading} disabled={picked.length === 0} />
            </View>
          </>
        )}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}
