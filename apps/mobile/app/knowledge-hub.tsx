// PATH: apps/mobile/app/knowledge-hub.tsx
// Thin standalone route for Knowledge Hub — previously only reachable as a
// section embedded in Home's feed (home.tsx's "knowledge_hub" case). Gives
// it its own /knowledge-hub route (parity with the web app's existing
// standalone /knowledge-hub page) so the Learn tab can link to it directly,
// without touching Home or KnowledgeHubSection itself.

import Header from "@/components/header";
import KnowledgeHubSection from "@/components/KnowledgeHubSection";
import { useTheme } from "@/context/ThemeContext";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function KnowledgeHubScreen() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Knowledge Hub" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <KnowledgeHubSection />
      </ScrollView>
    </SafeAreaView>
  );
}
