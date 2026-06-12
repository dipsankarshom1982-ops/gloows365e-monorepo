import { useEffect, useRef } from "react";
import {
  Dimensions,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { recordClick, recordImpression } from "@/services/adService";
import type { Ad } from "@/lib/ads/types";

const { height: H, width: W } = Dimensions.get("window");

interface Props {
  ad: Ad;
  isVisible: boolean;  // from parent FlatList onViewableItemsChanged
}

export default function SponsoredReelCard({ ad, isVisible }: Props) {
  const impressionFired = useRef(false);

  useEffect(() => {
    if (isVisible && !impressionFired.current) {
      impressionFired.current = true;
      recordImpression(ad.id, "reels");
    }
  }, [isVisible, ad.id]);

  const handleCta = async () => {
    await recordClick(ad.id, "reels");
    if (ad.ctaRoute) router.push(ad.ctaRoute as any);
    else if (ad.ctaUrl) Linking.openURL(ad.ctaUrl).catch(() => {});
  };

  return (
    <View style={S.container}>
      {/* Video placeholder — replace with expo-video when videoUrl is available */}
      <LinearGradient
        colors={["#1e1b4b", "#4f46e5", "#312e81"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top overlay */}
      <View style={S.topOverlay}>
        <View style={S.sponsoredBadge}>
          <Ionicons name="sparkles" size={11} color="#fbbf24" />
          <Text style={S.sponsoredText}>Sponsored</Text>
        </View>
      </View>

      {/* Center: ad visual placeholder */}
      <View style={S.centerContent}>
        <Text style={S.centerEmoji}>📚</Text>
        <Text style={S.centerTitle} numberOfLines={2}>{ad.title}</Text>
        <Text style={S.centerSponsor}>{ad.sponsorName}</Text>
      </View>

      {/* Bottom: CTA bar */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.88)"]}
        style={S.bottomOverlay}
      >
        <View style={S.bottomContent}>
          <View style={{ flex: 1 }}>
            <Text style={S.bottomTitle} numberOfLines={1}>{ad.title}</Text>
            <Text style={S.bottomSponsor} numberOfLines={1}>{ad.sponsorName}</Text>
          </View>
          {(ad.ctaRoute || ad.ctaUrl) && (
            <TouchableOpacity style={S.ctaBtn} onPress={handleCta} activeOpacity={0.85}>
              <Text style={S.ctaText}>{ad.ctaText || "Learn More"}</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const S = StyleSheet.create({
  container:      { width: W, height: H, position: "relative", backgroundColor: "#0a0a1a" },

  topOverlay:     { position: "absolute", top: 50, left: 16, right: 60 },
  sponsoredBadge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: "rgba(251,191,36,0.4)" },
  sponsoredText:  { color: "#fbbf24", fontSize: 11, fontWeight: "800" },

  centerContent:  { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  centerEmoji:    { fontSize: 64 },
  centerTitle:    { color: "#fff", fontSize: 22, fontWeight: "900", textAlign: "center", paddingHorizontal: 32 },
  centerSponsor:  { color: "rgba(255,255,255,0.65)", fontSize: 13 },

  bottomOverlay:  { position: "absolute", bottom: 0, left: 0, right: 0, paddingBottom: 80, paddingTop: 60 },
  bottomContent:  { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, gap: 12 },
  bottomTitle:    { color: "#fff", fontSize: 15, fontWeight: "800" },
  bottomSponsor:  { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  ctaBtn:         { backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, flexShrink: 0 },
  ctaText:        { color: "#1e1b4b", fontSize: 13, fontWeight: "800" },
});
