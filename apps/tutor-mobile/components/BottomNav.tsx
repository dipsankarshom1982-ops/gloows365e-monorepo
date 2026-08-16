// apps/tutor-mobile/components/BottomNav.tsx
// RN counterpart to apps/tutor/src/components/BottomNav.tsx — see its
// header comment for the Phase 1d nav redesign reasoning.

import { colors, semantic, spacing } from "@gloows/tutor-ui";
import { signOut } from "firebase/auth";
import { router, usePathname } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity, View } from "react-native";
import { auth } from "@/lib/firebase";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/students",  label: "Students",  icon: "🧑‍🎓" },
  { href: "/classes",   label: "Classes",   icon: "🗓️" },
] as const;

const MORE_PREFIXES = ["/batches", "/profile", "/verification", "/more"];

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const moreActive = MORE_PREFIXES.some((p) => pathname?.startsWith(p));

  return (
    <View style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      flexDirection: "row", justifyContent: "space-around", alignItems: "center",
      backgroundColor: semantic.surface, borderTopWidth: 1, borderTopColor: colors.slate[700],
      paddingTop: spacing.sm, paddingBottom: spacing.xl, paddingHorizontal: spacing.md,
    }}>
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <TouchableOpacity key={l.href} onPress={() => router.push(l.href)} style={{ alignItems: "center", gap: 2 }}>
            <Text style={{ fontSize: 16 }}>{l.icon}</Text>
            <Text style={{ fontSize: 11, fontWeight: "700", color: active ? semantic.accent : semantic.textMuted }}>{l.label}</Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity onPress={() => router.push("/more")} style={{ alignItems: "center", gap: 2 }}>
        <Text style={{ fontSize: 16 }}>☰</Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: moreActive ? semantic.accent : semantic.textMuted }}>{t("moreNavLabel")}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { signOut(auth); router.replace("/welcome"); }} style={{ alignItems: "center", gap: 2 }}>
        <Text style={{ fontSize: 16 }}>🚪</Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: semantic.textMuted }}>{t("logout")}</Text>
      </TouchableOpacity>
    </View>
  );
}
