import { useTheme } from "@/context/ThemeContext";
import { db } from "@/lib/firebase";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W   = SCREEN_W - 32;
const ITEM_GAP = 12;

interface AdItem {
  id: string;
  title?: string;
  description?: string;
  imageUrl: string;
  sponsorName?: string;
  label?: string;
  actionType?: "internal" | "external" | "none";
  targetRoute?: string;
  externalUrl?: string;
  isActive: boolean;
  startDate?: any;
  endDate?: any;
  order?: number;
}

// ─── Single ad card ───────────────────────────────────────────
function AdCard({ item }: { item: AdItem }) {
  const handlePress = () => {
    if (item.actionType === "internal" && item.targetRoute) {
      router.push(item.targetRoute as any);
    } else if (item.actionType === "external" && item.externalUrl) {
      Linking.openURL(item.externalUrl).catch(() => {});
    }
  };

  return (
    <TouchableOpacity
      style={S.adCard}
      onPress={handlePress}
      activeOpacity={item.actionType === "none" ? 1 : 0.9}
    >
      <Image
        source={{ uri: item.imageUrl || "https://via.placeholder.com/400x200?text=Ad" }}
        style={S.adImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.72)"]}
        style={S.adGradient}
      />
      {/* Sponsored label */}
      <View style={S.sponsoredBadge}>
        <Text style={S.sponsoredText}>{item.label || "Sponsored"}</Text>
      </View>
      {/* Text overlay */}
      {(item.title || item.sponsorName) ? (
        <View style={S.adTextBox}>
          {item.title      && <Text style={S.adTitle}   numberOfLines={1}>{item.title}</Text>}
          {item.sponsorName && <Text style={S.adSponsor} numberOfLines={1}>{item.sponsorName}</Text>}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Main carousel ────────────────────────────────────────────
export default function HomeAdsCarousel() {
  const { colors } = useTheme();
  const [ads,        setAds]        = useState<AdItem[]>([]);
  const [currentDot, setCurrentDot] = useState(0);
  const flatRef = useRef<FlatList>(null);
  const idxRef  = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, "homeAds"),
          where("isActive", "==", true)
        ));
        const now = new Date();
        const data = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((ad: AdItem) => {
            if (ad.startDate && ad.endDate) {
              const s = ad.startDate.toDate?.() ?? new Date(ad.startDate);
              const e = ad.endDate.toDate?.()   ?? new Date(ad.endDate);
              return now >= s && now <= e;
            }
            return true;
          })
          .sort((a: AdItem, b: AdItem) => (a.order ?? 99) - (b.order ?? 99));
        setAds(data);
      } catch {
        setAds([]);
      }
    })();
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (ads.length <= 1) return;
    const timer = setInterval(() => {
      const next = (idxRef.current + 1) % ads.length;
      flatRef.current?.scrollToOffset({
        offset: next * (CARD_W + ITEM_GAP),
        animated: true,
      });
      idxRef.current = next;
      setCurrentDot(next);
    }, 3500);
    return () => clearInterval(timer);
  }, [ads.length]);

  if (ads.length === 0) return null;

  return (
    <View style={[S.section, { backgroundColor: colors.background }]}>
      <FlatList
        ref={flatRef}
        horizontal
        data={ads}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AdCard item={item} />}
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
      {/* Dot indicator */}
      {ads.length > 1 && (
        <View style={S.dots}>
          {ads.map((_, i) => (
            <View
              key={i}
              style={[
                S.dot,
                { backgroundColor: i === currentDot ? "#6366f1" : colors.border, width: i === currentDot ? 16 : 6 },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  section: { marginVertical: 10 },

  adCard:    { width: CARD_W, height: 180, borderRadius: 16, overflow: "hidden", position: "relative" },
  adImage:   { width: CARD_W, height: 180 },
  adGradient:{ position: "absolute", left: 0, right: 0, bottom: 0, height: 110 },

  sponsoredBadge: {
    position: "absolute", top: 10, right: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
  },
  sponsoredText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  adTextBox: { position: "absolute", bottom: 12, left: 14, right: 14 },
  adTitle:   { color: "#fff", fontSize: 14, fontWeight: "800" },
  adSponsor: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 },

  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5, marginTop: 10 },
  dot:  { height: 6, borderRadius: 3 },
});
