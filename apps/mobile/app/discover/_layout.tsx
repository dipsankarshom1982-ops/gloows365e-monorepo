import { useTheme } from "@/context/ThemeContext";
import { isPrimaryClassLevel, useStudentProfile } from "@gloows/shared-logic";
import { Stack, useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Discover is a college/career/scholarship advisor and isn't offered to
// Class 3–5 (the server also refuses them — see functions/src/discover.ts).
// The home and AI Guru entries are already hidden for them; this covers a
// deep link, so they see a friendly message here instead of the Discover
// screens or a raw 403. Every other class gets the stack unchanged.
export default function DiscoverLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  const { studentProfile } = useStudentProfile();

  if (!isPrimaryClassLevel(studentProfile?.class)) {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 }}>
        <Text style={{ fontSize: 48 }} accessibilityElementsHidden>🧭</Text>
        <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "900", textAlign: "center", color: colors.text }}>
          Discover isn't available for your class yet
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 21, textAlign: "center", color: colors.textSecondary }}>
          Discover is made for older students exploring colleges and careers. Try AI Guru, the Daily Quiz and more instead!
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={{ marginTop: 12, backgroundColor: "#4f46e5", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28 }}
        >
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
