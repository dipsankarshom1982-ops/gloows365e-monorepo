// apps/tutor-mobile/app/(app)/students/index.tsx
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { useTutorProfile, useTutorStudents } from "@gloows/shared-logic";
import type { TutorStudent } from "@gloows/shared-logic";
import { Button, Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

export default function StudentsScreen() {
  const { t } = useTranslation();
  const { user } = useTutorProfile();
  const { students, loading } = useTutorStudents(user?.uid);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <View style={{ flex: 1, padding: spacing.xl, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xl }}>
          <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary }}>{t("studentsTitle")}</Text>
          <View style={{ width: 140 }}>
            <Button title={t("addStudent")} variant="secondary" onPress={() => router.push("/students/new")} />
          </View>
        </View>

        {loading ? (
          <LoadingState />
        ) : students.length === 0 ? (
          <EmptyState title={t("noStudentsTitle")} subtitle={t("noStudentsSubtitle")} />
        ) : (
          <FlatList
            data={students}
            keyExtractor={(s) => s.id!}
            ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
            renderItem={({ item }: { item: TutorStudent }) => (
              <TouchableOpacity onPress={() => router.push(`/students/${item.id}`)}>
                <Card>
                  <Text style={{ fontWeight: "700", color: semantic.textPrimary }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: semantic.textMuted, marginTop: 4 }}>
                    {[item.class, item.school, item.board].filter(Boolean).join(" · ") || "—"}
                  </Text>
                  {item.subjects && item.subjects.length > 0 && (
                    <Text style={{ fontSize: 12, color: semantic.textMuted, marginTop: 2 }}>{item.subjects.join(", ")}</Text>
                  )}
                </Card>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}
