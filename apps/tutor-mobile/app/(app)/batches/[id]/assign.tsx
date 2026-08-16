// apps/tutor-mobile/app/(app)/batches/[id]/assign.tsx
// Mirrors apps/tutor's batches/assign/page.tsx — checked state derived
// live from useBatchStudents, immediate-write-per-toggle.

import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { arrayRemove, arrayUnion, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { semantic, spacing } from "@gloows/tutor-ui";
import { useBatchStudents, useTutorProfile, useTutorStudents } from "@gloows/shared-logic";
import type { TutorStudent } from "@gloows/shared-logic";
import { db } from "@/lib/firebase";
import { Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

export default function AssignStudentsScreen() {
  const { t } = useTranslation();
  const { user } = useTutorProfile();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { students: allStudents, loading: rosterLoading } = useTutorStudents(user?.uid);
  const { students: assigned, loading: assignedLoading } = useBatchStudents(user?.uid, id);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const assignedIds = new Set(assigned.map((s) => s.id));

  async function toggle(studentId: string, isAssigned: boolean) {
    if (pending.has(studentId)) return;
    setPending((p) => new Set(p).add(studentId));
    try {
      await updateDoc(doc(db, "tutorStudents", studentId), {
        batchIds: isAssigned ? arrayRemove(id) : arrayUnion(id),
        updatedAt: serverTimestamp(),
      });
    } finally {
      setPending((p) => { const next = new Set(p); next.delete(studentId); return next; });
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: semantic.background }}>
      <View style={{ flex: 1, padding: spacing.xl, paddingBottom: 100 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: semantic.textPrimary, marginBottom: spacing.xl }}>
          {t("assignStudentsTitle")}
        </Text>

        {(rosterLoading || assignedLoading) ? (
          <LoadingState />
        ) : allStudents.length === 0 ? (
          <EmptyState title={t("noStudentsToAssignTitle")} subtitle={t("noStudentsToAssignSubtitle")} />
        ) : (
          <FlatList
            data={allStudents}
            keyExtractor={(s) => s.id!}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
            renderItem={({ item }: { item: TutorStudent }) => {
              const isAssigned = assignedIds.has(item.id);
              const isPending  = pending.has(item.id!);
              return (
                <TouchableOpacity disabled={isPending} onPress={() => toggle(item.id!, isAssigned)} style={{ opacity: isPending ? 0.5 : 1 }}>
                  <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View>
                      <Text style={{ fontWeight: "700", color: semantic.textPrimary, fontSize: 14 }}>{item.name}</Text>
                      <Text style={{ fontSize: 12, color: semantic.textMuted, marginTop: 2 }}>
                        {[item.class, item.school].filter(Boolean).join(" · ") || "—"}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 18 }}>{isAssigned ? "✅" : "⬜"}</Text>
                  </Card>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}
