// PATH: apps/mobile/components/GloStorePreviewSection.tsx
// Home flash-card strip for admin-added affiliate products.
// Mirrors the layout/behaviour of SeekhoPreviewSection: a horizontally
// scrolling row of gradient cards under a section header with a
// "View All" link. Tapping a card opens that exact product inside
// GloStore (app/glostore/[productId].tsx); "View All"/"Explore" opens
// the full store (app/glostore/index.tsx).

import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { discountPct, fetchFeaturedProducts, type GloStoreProduct } from "@/lib/glostore";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const CARD_W = 148;

// Rotating gradient backdrops so cards without a great product photo (or
// while the image is loading) still look intentional, same trick used by
// SeekhoPreviewSection's category tiles.
const BACKDROPS: [string, string][] = [
  ["#1e40af", "#3b82f6"],
  ["#7c2d12", "#ea580c"],
  ["#831843", "#db2777"],
  ["#064e3b", "#059669"],
  ["#4c1d95", "#7c3aed"],
];

export default function GloStorePreviewSection() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const [products, setProducts] = useState<GloStoreProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchFeaturedProducts()
      .then((p) => alive && setProducts(p))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (!loading && products.length === 0) return null;

  return (
    <View style={S.section}>
      <View style={S.header}>
        <View style={{ flex: 1 }}>
          <View style={S.titleRow}>
            <Text style={S.storeEmoji}>🛍️</Text>
            <Text style={[S.sectionTitle, { color: colors.text }]}>
              {t("gloStorePreviewTitle") ?? "GloStore"}
            </Text>
          </View>
          <Text style={[S.sectionSub, { color: colors.textSecondary }]}>
            {t("gloStorePreviewSub") ?? "Handpicked books & study essentials"}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/glostore" as any)}>
          <Text style={S.viewAll}>{t("viewAll") ?? "View All"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.scrollContent}
      >
        {products.map((p, i) => {
          const disc = discountPct(p.originalPrice, p.salePrice);
          const backdrop = BACKDROPS[i % BACKDROPS.length];
          return (
            <TouchableOpacity
              key={p.id}
              activeOpacity={0.85}
              onPress={() => router.push(`/glostore/${p.id}` as any)}
              style={S.cardWrap}
            >
              <View style={S.card}>
                {p.imageUrl ? (
                  <Image source={{ uri: p.imageUrl }} style={S.image} resizeMode="cover" />
                ) : (
                  <LinearGradient colors={backdrop} style={S.image} />
                )}

                {disc > 0 && (
                  <View style={S.discBadge}>
                    <Text style={S.discBadgeText}>{disc}% OFF</Text>
                  </View>
                )}

                {!!p.badge && (
                  <View style={S.tagBadge}>
                    <Text style={S.tagBadgeText}>{p.badge}</Text>
                  </View>
                )}

                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.88)"]}
                  style={S.scrim}
                />

                <View style={S.infoBlock}>
                  <Text style={S.cardTitle} numberOfLines={2}>{p.title}</Text>
                  <View style={S.priceRow}>
                    <Text style={S.salePrice}>₹{p.salePrice}</Text>
                    {p.originalPrice > p.salePrice && (
                      <Text style={S.origPrice}>₹{p.originalPrice}</Text>
                    )}
                  </View>
                  <View style={S.buyBtn}>
                    <Text style={S.buyBtnText}>Buy Now →</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  section: { marginVertical: 16 },
  header: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    paddingHorizontal: 16, marginBottom: 12,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  storeEmoji: { fontSize: 18 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  sectionSub: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  viewAll: { fontSize: 13, fontWeight: "700", color: "#f59e0b", marginTop: 4 },

  scrollContent: { paddingLeft: 16, paddingRight: 4, paddingBottom: 8 },

  cardWrap: { marginRight: 12 },
  card: {
    width: CARD_W,
    height: 190,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#111827",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  image: { ...StyleSheet.absoluteFillObject },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" },

  discBadge: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: "#dc2626", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3,
  },
  discBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  tagBadge: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: "rgba(245,158,11,0.92)", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3,
  },
  tagBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },

  infoBlock: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 10, gap: 4 },
  cardTitle: { color: "#fff", fontSize: 12, fontWeight: "800", lineHeight: 15 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  salePrice: { color: "#4ade80", fontSize: 14, fontWeight: "900" },
  origPrice: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "600", textDecorationLine: "line-through" },
  buyBtn: {
    marginTop: 2, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8,
    paddingVertical: 5, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  buyBtnText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
