// PATH: components/TitleAvatar.tsx
//
// Fallback avatar shown wherever a student hasn't got a real profilePic yet.
// Mirrors the web app's Title-derived silhouette (lib/avatars.ts there) but
// as a native component — React Native's <Image> can't render the SVG data
// URIs the web version uses, so this renders a plain colored circle + an
// Ionicons person glyph instead. Purely a display-time fallback: never
// written to Firestore, so it can't end up mismatched or broken on the
// other platform — see register.tsx's FIX comment for the fuller reasoning.

import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { genderFromTitle } from "@/lib/avatars";

interface Props {
  title?: string | null;
  size?: number;
  style?: any;
}

export default function TitleAvatar({ title, size = 40, style }: Props) {
  const isFemale = genderFromTitle(title) === "female";
  const bg = isFemale ? "#EC4899" : "#6366F1";
  const iconColor = isFemale ? "#FCE7F3" : "#E0E7FF";

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Ionicons name="person" size={size * 0.62} color={iconColor} style={{ marginTop: size * 0.1 }} />
    </View>
  );
}
