// PATH: apps/mobile/app/glostore/index.tsx
// GloStore home — e-commerce style, category-wise sections (like Amazon/
// Flipkart's home page) instead of one big filterable grid, so students can
// actually see what's in each category at a glance instead of guessing from
// a flat "All" list. Tapping "See All →" on a section drills into the same
// screen filtered to just that category (?category=books), reusing the grid
// view below for that.

import { useTheme } from "@/context/ThemeContext";
import { useAppTranslation } from "@/context/LanguageContext";
import {
  CATEGORY_META,
  discountPct,
  fetchAllProducts,
  fetchProductsGroupedByCategory,
  type GloStoreCategory,
  type GloStoreCategorySection,
  type GloStoreProduct,
} from "@/lib/glostore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function GloStoreScreen() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  return category ? <CategoryGrid category={category as GloStoreCategory} /> : <StoreHome />;
}

// ─── Home — category sections ────────────────────────────────────────────────

function StoreHome() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const [sections, setSections]   = useState<GloStoreCategorySection[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => setSections(await fetchProductsGroupedByCategory());

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <Hero showBack={false} />
      {loading ? (
        <View style={S.center}><ActivityIndicator color="#f59e0b" size="large" /></View>
      ) : sections.length === 0 ? (
        <View style={S.center}>
          <Text style={S.emptyEmoji}>📦</Text>
          <Text style={[S.emptyText, { color: colors.textSecondary }]}>
            {t("gloStoreEmpty") ?? "No products here yet — check back soon!"}
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
        >
          {sections.map((section) => (
            <View key={section.category} style={S.section}>
              <View style={S.sectionHeader}>
                <Text style={[S.sectionTitle, { color: colors.text }]}>
                  {section.emoji} {section.label}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push(`/glostore?category=${section.category}` as any)}
                  style={S.seeAllBtn}
                >
                  <Text style={S.seeAllText}>See All</Text>
                  <Ionicons name="chevron-forward" size={14} color="#f59e0b" />
                </TouchableOpacity>
              </View>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={section.products.slice(0, 10)}
                keyExtractor={(p) => p.id}
                contentContainerStyle={S.sectionList}
                renderItem={({ item }) => <CompactCard product={item} colors={colors} />}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Category drill-down — filtered grid (unchanged from before) ────────────

function CategoryGrid({ category }: { category: GloStoreCategory }) {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const [products, setProducts] = useState<GloStoreProduct[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const meta = CATEGORY_META.find((c) => c.value === category);

  const load = async () => setProducts(await fetchAllProducts());

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = useMemo(() => products.filter((p) => p.category === category), [products, category]);

  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <Hero showBack title={meta ? `${meta.emoji} ${meta.label}` : "GloStore"} />
      {loading ? (
        <View style={S.center}><ActivityIndicator color="#f59e0b" size="large" /></View>
      ) : filtered.length === 0 ? (
        <View style={S.center}>
          <Text style={S.emptyEmoji}>📦</Text>
          <Text style={[S.emptyText, { color: colors.textSecondary }]}>
            {t("gloStoreEmpty") ?? "No products here yet — check back soon!"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          numColumns={2}
          keyExtractor={(p) => p.id}
          contentContainerStyle={S.grid}
          columnWrapperStyle={{ gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
          renderItem={({ item }) => <ProductCard product={item} colors={colors} />}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Shared hero ──────────────────────────────────────────────────────────────

function Hero({ showBack, title }: { showBack: boolean; title?: string }) {
  return (
    <LinearGradient colors={["#92400e", "#d97706", "#f59e0b"]} style={S.hero}>
      <View style={S.heroTopRow}>
        {showBack ? (
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
        ) : <View style={{ width: 36 }} />}
        <View style={S.heroBadge}>
          <Text style={S.heroBadgeText}>⭐ Admin Picked</Text>
        </View>
      </View>
      {title ? (
        <Text style={[S.heroTitle, { marginTop: 14 }]}>{title}</Text>
      ) : (
        <>
          <Text style={S.heroEmoji}>🛍️</Text>
          <Text style={S.heroTitle}>GloStore</Text>
          <Text style={S.heroSub}>Books, stationery & study essentials — handpicked for you</Text>
        </>
      )}
    </LinearGradient>
  );
}

// ─── Compact horizontal card (category sections) ─────────────────────────────

function CompactCard({ product, colors }: { product: GloStoreProduct; colors: any }) {
  const disc = discountPct(product.originalPrice, product.salePrice);
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push(`/glostore/${product.id}` as any)}
      style={[S.cCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={S.cImageWrap}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={S.cImage} resizeMode="cover" />
        ) : (
          <View style={[S.cImage, S.pImageFallback]}><Text style={{ fontSize: 24 }}>📦</Text></View>
        )}
        {disc > 0 && (
          <View style={S.pDiscBadge}><Text style={S.pDiscBadgeText}>{disc}% OFF</Text></View>
        )}
      </View>
      <View style={{ padding: 8, gap: 3 }}>
        <Text style={[S.cTitle, { color: colors.text }]} numberOfLines={2}>{product.title}</Text>
        <View style={S.pPriceRow}>
          <Text style={S.pSalePrice}>₹{product.salePrice}</Text>
          {product.originalPrice > product.salePrice && (
            <Text style={S.pOrigPrice}>₹{product.originalPrice}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Grid card (category drill-down) ─────────────────────────────────────────

function ProductCard({ product, colors }: { product: GloStoreProduct; colors: any }) {
  const disc = discountPct(product.originalPrice, product.salePrice);
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push(`/glostore/${product.id}` as any)}
      style={[S.pCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={S.pImageWrap}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={S.pImage} resizeMode="cover" />
        ) : (
          <View style={[S.pImage, S.pImageFallback]}>
            <Text style={{ fontSize: 30 }}>📦</Text>
          </View>
        )}
        {disc > 0 && (
          <View style={S.pDiscBadge}>
            <Text style={S.pDiscBadgeText}>{disc}% OFF</Text>
          </View>
        )}
      </View>
      <View style={{ padding: 10, gap: 4 }}>
        {!!product.badge && (
          <Text style={S.pBadge} numberOfLines={1}>{product.badge}</Text>
        )}
        <Text style={[S.pTitle, { color: colors.text }]} numberOfLines={2}>{product.title}</Text>
        <View style={S.pPriceRow}>
          <Text style={S.pSalePrice}>₹{product.salePrice}</Text>
          {product.originalPrice > product.salePrice && (
            <Text style={S.pOrigPrice}>₹{product.originalPrice}</Text>
          )}
        </View>
        {product.rating > 0 && (
          <Text style={[S.pRating, { color: colors.textSecondary }]}>
            ⭐ {product.rating.toFixed(1)} {product.reviewCount ? `(${product.reviewCount})` : ""}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },

  hero: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 22, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  heroBadge: { backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" },
  heroBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  heroEmoji: { fontSize: 40, marginTop: 10 },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: "900", marginTop: 2 },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600", marginTop: 4, maxWidth: 280 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingBottom: 60 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 13, fontWeight: "600" },

  section: { marginTop: 18 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAllText: { color: "#f59e0b", fontSize: 12, fontWeight: "700" },
  sectionList: { paddingHorizontal: 16, gap: 10 },

  cCard: { width: 128, borderRadius: 14, overflow: "hidden", borderWidth: 1 },
  cImageWrap: { position: "relative" },
  cImage: { width: "100%", height: 100 },
  cTitle: { fontSize: 12, fontWeight: "700", lineHeight: 15 },

  grid: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40, gap: 12 },
  pCard: { flex: 1, borderRadius: 16, overflow: "hidden", borderWidth: 1 },
  pImageWrap: { position: "relative" },
  pImage: { width: "100%", height: 120 },
  pImageFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(148,163,184,0.15)" },
  pDiscBadge: { position: "absolute", top: 8, left: 8, backgroundColor: "#dc2626", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  pDiscBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  pBadge: { color: "#f59e0b", fontSize: 10, fontWeight: "800" },
  pTitle: { fontSize: 13, fontWeight: "700", lineHeight: 17 },
  pPriceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  pSalePrice: { color: "#22c55e", fontSize: 15, fontWeight: "900" },
  pOrigPrice: { fontSize: 11, fontWeight: "600", textDecorationLine: "line-through", opacity: 0.6 },
  pRating: { fontSize: 10, fontWeight: "600" },
});
