// PATH: apps/mobile/components/shikshahub/InitialsAvatar.tsx
// ShikshaHub redesign — production-safe tutor avatar. Real profile photo
// when the tutor has one; otherwise a deterministic initials avatar (never
// a floating emoji in an empty box) so every card and hero surface always
// has a legible, consistent identity mark.

import { Image, StyleSheet, Text, View } from "react-native";

const PALETTE = ["#0f766e", "#4f46e5", "#b45309", "#be123c", "#0369a1", "#7c3aed"];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "T";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function InitialsAvatar({
  name,
  uri,
  size = 56,
}: {
  name: string;
  uri?: string | null;
  size?: number;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[S.image, { width: size, height: size, borderRadius: size / 2 }]}
        resizeMode="cover"
      />
    );
  }
  const label = name?.trim() || "Tutor";
  return (
    <View
      style={[
        S.fallback,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colorFor(label) },
      ]}
    >
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: size * 0.36 }}>{initialsFor(label)}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  image: { backgroundColor: "rgba(148,163,184,0.2)" },
  fallback: { alignItems: "center", justifyContent: "center" },
});
