// components/ShortLearnPreview.tsx — FIXED
//
// FIX: Removed status=="approved" filter — the posts collection has no admin
// approval flow so ALL student reels stay "pending" permanently.
// Now shows all non-rejected reels with postType=="reel" and isSkillBattle!=true.
// Uses a simple single-field where() to avoid composite index requirements.

import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";

import { db } from "@/lib/firebase";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";

export default function SkillShortPreview() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const [reels, setReels] = useState<any[]>([]);

  const fetchReels = useCallback(async () => {
    try {
      // Single-field where() — no composite index needed.
      // Filter out isSkillBattle posts client-side (field may be missing on old docs).
      // Filter out rejected posts client-side.
      const q = query(
        collection(db, "posts"),
        where("postType", "==", "reel"),
        orderBy("views", "desc"),
        limit(30)
      );
      const snap = await getDocs(q);
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() as any }))
        .filter(
          (item) =>
            item.isSkillBattle !== true &&   // exclude skill battles
            item.status        !== "rejected" // exclude rejected
        )
        .slice(0, 10);
      setReels(data);
    } catch (error) {
      console.log("ShortLearn error:", error);
      setReels([]);
    }
  }, []);

  useEffect(() => { fetchReels(); }, [fetchReels]);

  useFocusEffect(useCallback(() => { fetchReels(); }, [fetchReels]));

  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: "/reels",
          params: { postId: item.id },
        })
      }
      activeOpacity={0.8}
    >
      <Image
        source={{
          uri: item.thumbnail || "https://via.placeholder.com/120x180?text=Reel",
        }}
        style={styles.image}
      />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.8)"]} style={styles.gradient} />
      <View style={styles.playContainer}>
        <Ionicons name="play" size={16} color="#fff" />
      </View>
      <Text style={styles.views}>🔥 {item.views || 0}</Text>
      {item.title && (
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>📖 {t("shortLearningTitle")}</Text>
      {reels.length > 0 ? (
        <FlatList
          horizontal
          data={reels}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
        />
      ) : (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t("noLearningVideos")}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { marginVertical: 15, paddingHorizontal: 15 },
  title:        { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 12 },
  card:         { marginRight: 12, borderRadius: 14, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 5, backgroundColor: "#fff" },
  image:        { width: 120, height: 180, borderRadius: 12, backgroundColor: "#e5e7eb" },
  gradient:     { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12 },
  views:        { position: "absolute", bottom: 8, left: 8, backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 12, fontWeight: "600", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  playContainer:{ position: "absolute", top: "50%", left: "50%", marginLeft: -15, marginTop: -15, backgroundColor: "rgba(255,255,255,0.3)", width: 30, height: 30, borderRadius: 15, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff" },
  cardTitle:    { position: "absolute", bottom: 32, left: 8, right: 8, color: "#fff", fontSize: 11, fontWeight: "600", lineHeight: 14 },
  empty:        { height: 150, justifyContent: "center", alignItems: "center" },
  emptyText:    { color: "#94a3b8", fontSize: 14, fontWeight: "500" },
});