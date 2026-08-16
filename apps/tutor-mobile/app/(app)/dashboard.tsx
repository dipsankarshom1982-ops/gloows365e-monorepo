import { useEffect, useState } from "react";
import { router } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, TouchableOpacity, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { useTutorClasses, useTutorProfile, useTutorStudents } from "@gloows/shared-logic";
import { db } from "@/lib/firebase";
import { Button, Card, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

type Status = "Draft" | "Submitted" | "Under Review" | "Verified" | "Rejected" | "Suspended";

function isToday(ts: unknown): boolean {
  const d = (ts as { toDate?: () => Date } | undefined)?.toDate?.();
  if (!d) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

const BANNER: Record<Status, { key: string; color: string } | null> = {
  Draft:          { key: "verificationDraftBanner",    color: semantic.textSecondary },
  Submitted:      { key: "verificationPendingBanner",  color: semantic.warning },
  "Under Review": { key: "verificationPendingBanner",  color: semantic.warning },
  Verified:       { key: "verificationVerifiedBanner", color: semantic.success },
  Rejected:       { key: "verificationRejectedBanner", color: semantic.danger },
  Suspended:      null,
};

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { user, tutorProfile, profileLoading } = useTutorProfile();
  const { students } = useTutorStudents(user?.uid);
  const { classes } = useTutorClasses(user?.uid);
  const [status, setStatus] = useState<Status>("Draft");
  const todaysClasses = classes.filter((c) => c.status !== "Cancelled" && isToday(c.startTime));

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "tutorVerifications", user.uid), (snap) => {
      setStatus(snap.exists() ? (snap.data().status ?? "Draft") : "Draft");
    });
  }, [user]);

  if (profileLoading) return <LoadingState />;
  const banner = BANNER[status];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <View style={{ flex: 1, padding: spacing.xl }}>
        <Text style={{ fontSize: 24, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.xl }}>
          {t("goodMorning", { name: tutorProfile?.name ?? "" })}
        </Text>
        {banner && (
          <Card>
            <Text style={{ color: banner.color, fontWeight: "700", fontSize: 13 }}>{t(banner.key)}</Text>
            {(status === "Draft" || status === "Rejected") && (
              <View style={{ marginTop: spacing.md, alignSelf: "flex-start" }}>
                <Button title={t("completeVerification")} variant="secondary" onPress={() => router.push("/verification")} />
              </View>
            )}
          </Card>
        )}

        <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push("/students")}>
            <Card>
              <Text style={{ fontSize: 11, fontWeight: "700", color: semantic.textMuted, marginBottom: 4 }}>
                {t("activeStudentsLabel")}
              </Text>
              <Text style={{ fontSize: 24, fontWeight: "900", color: semantic.textPrimary }}>{students.length}</Text>
            </Card>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push("/classes")}>
            <Card>
              <Text style={{ fontSize: 11, fontWeight: "700", color: semantic.textMuted, marginBottom: 4 }}>
                {t("todaysClassesLabel")}
              </Text>
              <Text style={{ fontSize: 24, fontWeight: "900", color: semantic.textPrimary }}>{todaysClasses.length}</Text>
            </Card>
          </TouchableOpacity>
        </View>
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}
