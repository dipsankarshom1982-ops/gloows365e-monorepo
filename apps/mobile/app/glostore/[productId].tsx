// PATH: apps/mobile/app/glostore/[productId].tsx
// Specific-item landing page. This is where a home flash card sends the
// user: /glostore/{productId}. "Buy Now" hands off to the real Amazon /
// Flipkart affiliate link in the device browser.

import { useTheme } from "@/context/ThemeContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { discountPct, fetchProductById, recordProductClick, recordProductView, type GloStoreProduct } from "@/lib/glostore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PLATFORM_META: Record<string, { label: string; color: string; icon: string }> = {
  amazon:   { label: "Amazon India", color: "#f59e0b", icon: "🛒" },
  flipkart: { label: "Flipkart",     color: "#2563eb", icon: "🛍️" },
  other:    { label: "Store",        color: "#64748b", icon: "🔗" },
};

export default function GloStoreProductScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const [product, setProduct] = useState<GloStoreProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!productId) return;
    fetchProductById(productId)
      .then((p) => {
        if (p) { setProduct(p); recordProductView(productId); } // fire-and-forget
        else setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [productId]);

  const handleBuyNow = async () => {
    if (!product?.affiliateUrl) return;
    recordProductClick(product.id); // fire-and-forget
    try {
      await Linking.openURL(product.affiliateUrl);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[S.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color="#f59e0b" size="large" />
      </SafeAreaView>
    );
  }

  if (notFound || !product) {
    return (
      <SafeAreaView style={[S.center, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 40 }}>🤔</Text>
        <Text style={[S.notFoundText, { color: colors.textSecondary }]}>
          {t("gloStoreProductGone") ?? "This item isn't available anymore."}
        </Text>
        <TouchableOpacity style={S.backLink} onPress={() => router.replace("/glostore" as any)}>
          <Text style={S.backLinkText}>{t("browseGloStore") ?? "Browse GloStore"}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const disc = discountPct(product.originalPrice, product.salePrice);
  const platform = PLATFORM_META[product.platform] ?? PLATFORM_META.other;

  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Image + back button */}
        <View style={S.imageWrap}>
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={S.image} resizeMode="cover" />
          ) : (
            <LinearGradient colors={["#92400e", "#f59e0b"]} style={S.image} />
          )}
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          {disc > 0 && (
            <View style={S.discBadge}>
              <Text style={S.discBadgeText}>{disc}% OFF</Text>
            </View>
          )}
        </View>

        <View style={{ padding: 20, gap: 12 }}>
          <View style={S.row}>
            <View style={[S.platformChip, { backgroundColor: `${platform.color}22`, borderColor: `${platform.color}66` }]}>
              <Text style={{ fontSize: 12 }}>{platform.icon}</Text>
              <Text style={[S.platformText, { color: platform.color }]}>{platform.label}</Text>
            </View>
            {!!product.badge && (
              <View style={S.tagChip}>
                <Text style={S.tagChipText}>{product.badge}</Text>
              </View>
            )}
          </View>

          <Text style={[S.title, { color: colors.text }]}>{product.title}</Text>

          {product.rating > 0 && (
            <Text style={[S.ratingText, { color: colors.textSecondary }]}>
              ⭐ {product.rating.toFixed(1)} · {product.reviewCount} {t("reviews") ?? "reviews"}
            </Text>
          )}

          <View style={S.priceRow}>
            <Text style={S.salePrice}>₹{product.salePrice}</Text>
            {product.originalPrice > product.salePrice && (
              <Text style={S.origPrice}>₹{product.originalPrice}</Text>
            )}
          </View>

          {!!product.description && (
            <Text style={[S.description, { color: colors.textSecondary }]}>{product.description}</Text>
          )}

          {(product.targetClass?.length || product.targetSubject) && (
            <View style={S.metaRow}>
              {!!product.targetClass?.length && product.targetClass[0] !== "all" && (
                <Text style={[S.metaChip, { color: colors.textSecondary, borderColor: colors.border }]}>
                  📚 Class {product.targetClass.join(", ")}
                </Text>
              )}
              {!!product.targetSubject && (
                <Text style={[S.metaChip, { color: colors.textSecondary, borderColor: colors.border }]}>
                  {product.targetSubject}
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Buy Now CTA */}
      <View style={[S.ctaBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <TouchableOpacity onPress={handleBuyNow} activeOpacity={0.88} style={{ borderRadius: 16, overflow: "hidden" }}>
          <LinearGradient colors={["#92400e", "#d97706", "#f59e0b"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.ctaBtn}>
            <Text style={S.ctaText}>
              {t("buyNowOn") ?? "Buy Now on"} {platform.label} →
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  notFoundText: { fontSize: 14, fontWeight: "600" },
  backLink: { marginTop: 4, backgroundColor: "#f59e0b", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  backLinkText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  imageWrap: { position: "relative" },
  image: { width: "100%", height: 280 },
  backBtn: { position: "absolute", top: 14, left: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  discBadge: { position: "absolute", top: 14, right: 16, backgroundColor: "#dc2626", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  discBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  platformChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  platformText: { fontSize: 11, fontWeight: "800" },
  tagChip: { backgroundColor: "rgba(245,158,11,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(245,158,11,0.4)" },
  tagChipText: { color: "#f59e0b", fontSize: 11, fontWeight: "800" },

  title: { fontSize: 20, fontWeight: "900", lineHeight: 27 },
  ratingText: { fontSize: 12, fontWeight: "600" },

  priceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  salePrice: { color: "#22c55e", fontSize: 26, fontWeight: "900" },
  origPrice: { fontSize: 15, fontWeight: "600", textDecorationLine: "line-through", opacity: 0.55 },

  description: { fontSize: 13, lineHeight: 20, fontWeight: "500" },

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  metaChip: { fontSize: 11, fontWeight: "700", borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },

  ctaBar: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, borderTopWidth: 1 },
  ctaBtn: { paddingVertical: 16, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: 0.3 },
});
