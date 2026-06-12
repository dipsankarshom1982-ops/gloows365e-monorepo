import { useEffect, useRef } from "react";
import {
  Dimensions,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { recordClick, recordImpression } from "@/services/adService";
import { useTheme } from "@/context/ThemeContext";
import type { Ad } from "@/lib/ads/types";

const { width: SCREEN_W } = Dimensions.get("window");

interface Props {
  ad: Ad;
  module: string;
  classLevel?: string;
  style?: object;
}

export default function FeedAdCard({ ad, module, classLevel = "all", style }: Props) {
  const { colors } = useTheme();
  const impressionFired = useRef(false);

  // Fire impression on first render
  useEffect(() => {
    if (!impressionFired.current) {
      impressionFired.current = true;
      recordImpression(ad.id, module, classLevel);
    }
  }, [ad.id, module, classLevel]);

  const handlePress = async () => {
    await recordClick(ad.id, module);
    if (ad.ctaRoute) {
      router.push(ad.ctaRoute as any);
    } else if (ad.ctaUrl) {
      Linking.openURL(ad.ctaUrl).catch(() => {});
    }
  };

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={[S.wrapper, style]}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.9}
        style={S.card}
      >
        {/* Background Image */}
        <Image
          source={{ uri: ad.imageUrl || "https://via.placeholder.com/400x200?text=Ad" }}
          style={S.image}
          resizeMode="cover"
        />

        {/* Bottom gradient scrim */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.82)"]}
          style={S.scrim}
        />

        {/* Top: Sponsored badge */}
        <View style={S.topRow}>
          <View style={S.sponsoredBadge}>
            <Ionicons name="sparkles" size={10} color="#fbbf24" />
            <Text style={S.sponsoredText}>{ad.adCategory === "scholarship" ? "Scholarship" : "Sponsored"}</Text>
          </View>
        </View>

        {/* Bottom: ad info + CTA */}
        <View style={S.bottomRow}>
          <View style={S.textBlock}>
            <Text style={S.sponsorName} numberOfLines={1}>{ad.sponsorName}</Text>
            <Text style={S.adTitle}     numberOfLines={2}>{ad.title}</Text>
          </View>

          {(ad.ctaRoute || ad.ctaUrl) && (
            <View style={S.ctaBtn}>
              <Text style={S.ctaText} numberOfLines={1}>{ad.ctaText || "Learn More"}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  wrapper:      { marginHorizontal: 16, marginVertical: 10 },
  card:         { height: 190, borderRadius: 18, overflow: "hidden", position: "relative" },
  image:        { ...StyleSheet.absoluteFillObject },
  scrim:        { position: "absolute", left: 0, right: 0, bottom: 0, height: 120 },

  topRow:       { position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row" },
  sponsoredBadge:{
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
  },
  sponsoredText:{ color: "#fbbf24", fontSize: 10, fontWeight: "700" },

  bottomRow:    { position: "absolute", bottom: 14, left: 14, right: 14, flexDirection: "row", alignItems: "flex-end", gap: 10 },
  textBlock:    { flex: 1 },
  sponsorName:  { color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "500", marginBottom: 2 },
  adTitle:      { color: "#fff", fontSize: 14, fontWeight: "800", lineHeight: 20 },

  ctaBtn:       {
    backgroundColor: "#fff",
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10,
    flexShrink: 0,
  },
  ctaText:      { color: "#1e1b4b", fontSize: 11, fontWeight: "800" },
});
