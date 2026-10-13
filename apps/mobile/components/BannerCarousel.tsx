import { useTheme } from "@/context/ThemeContext";
import { db } from "@/lib/firebase";
import { router } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Linking,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

// Renders admin-uploaded banners (Banners.tsx in the admin panel) targeted
// at a specific screen. Mirrors web components/BannerCarousel.tsx and the
// styling of this app's own components/HomeAdsCarousel.tsx, but reads from
// the `banners` collection (previously write-only — nothing ever rendered
// it) instead of `homeAds`.

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W   = SCREEN_W - 32;
const ITEM_GAP = 12;

export type BannerScreen = "home" | "vidyastar" | "skillbattle";

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  targetScreen?: string;
  ctaUrl?: string;
  order: number;
  isActive: boolean;
}

// No separate internal/external field on a banner (just one ctaUrl) — a
// leading "/" is treated as an in-app route, anything else opens in the
// device browser, same convention as HomeAdsCarousel's actionType split.
function handlePress(b: Banner) {
  if (!b.ctaUrl) return;
  if (b.ctaUrl.startsWith("/")) router.push(b.ctaUrl as any);
  else Linking.openURL(b.ctaUrl).catch(() => {});
}

function BannerCard({ item }: { item: Banner }) {
  return (
    <TouchableOpacity style={S.card} onPress={() => handlePress(item)} activeOpacity={item.ctaUrl ? 0.9 : 1}>
      <Image source={{ uri: item.imageUrl }} style={S.image} resizeMode="cover" />
    </TouchableOpacity>
  );
}

export default function BannerCarousel({ screen }: { screen: BannerScreen }) {
  const { colors } = useTheme();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentDot, setCurrentDot] = useState(0);
  const flatRef = useRef<FlatList>(null);
  const idxRef  = useRef(0);

  useEffect(() => {
    getDocs(collection(db, "banners")).then((snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }) as Banner)
        .filter((b) => b.isActive && (b.targetScreen === screen || b.targetScreen === "all"))
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
      setBanners(data);
    }).catch(() => setBanners([]));
  }, [screen]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      const next = (idxRef.current + 1) % banners.length;
      flatRef.current?.scrollToOffset({ offset: next * (CARD_W + ITEM_GAP), animated: true });
      idxRef.current = next;
      setCurrentDot(next);
    }, 3500);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) return null;

  return (
    <View style={[S.section, { backgroundColor: colors.background }]}>
      <FlatList
        ref={flatRef}
        horizontal
        data={banners}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <BannerCard item={item} />}
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + ITEM_GAP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 16, gap: ITEM_GAP }}
        getItemLayout={(_, index) => ({
          length: CARD_W + ITEM_GAP,
          offset: (CARD_W + ITEM_GAP) * index,
          index,
        })}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + ITEM_GAP));
          idxRef.current = idx;
          setCurrentDot(idx);
        }}
      />
      {banners.length > 1 && (
        <View style={S.dots}>
          {banners.map((_, i) => (
            <View
              key={i}
              style={[S.dot, { backgroundColor: i === currentDot ? "#6366f1" : colors.border, width: i === currentDot ? 16 : 6 }]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  section: { marginVertical: 10 },
  card:    { width: CARD_W, height: 150, borderRadius: 16, overflow: "hidden" },
  image:   { width: CARD_W, height: 150 },
  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5, marginTop: 10 },
  dot:  { height: 6, borderRadius: 3 },
});
