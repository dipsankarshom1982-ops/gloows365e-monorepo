// PATH: app/(drawer)/(tabs)/home.tsx

import { useFeatureFlags } from "@/context/FeatureFlagsContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useAdFeed } from "@/hooks/useAdFeed";
import { useAdFrequency } from "@/hooks/useAdFrequency";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import FeedAdCard from "@/components/ads/FeedAdCard";
import ScholarshipAdCard from "@/components/ads/ScholarshipAdCard";
import PostCard from "@/components/FeedPostCard";
import Header from "@/components/header";
import Stories from "@/components/Story";

import DiscoverPreviewSection from "@/components/DiscoverPreviewSection";
import HomeAdsCarousel from "@/components/HomeAdsCarousel";
import KnowledgeHubSection from "@/components/KnowledgeHubSection";
import ReferralCard from "@/components/ReferralCard";
import SeekhoPreviewSection from "@/components/SeekhoPreviewSection";
import ShortLearnPreview from "@/components/ShortLearnPreview";
import SkillBattlePreviewSection from "@/components/SkillBattlePreviewSection";
import SkillShortPreview from "@/components/SkillShortPreview";
import VidyaStarPreviewSection from "@/components/VidyaStarPreviewSection";

import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

export default function Home() {
  const { colors }                 = useTheme();
  const { t }                      = useAppTranslation();
  const { homeSection, homeFlags } = useFeatureFlags();
  const [posts, setPosts]          = useState<any[]>([]);

  const { currentAd: feedAd }        = useAdFeed({ module: "home", adType: "feed" });
  const { currentAd: scholarshipAd } = useAdFeed({ module: "home", adType: "scholarship" });
  const { canShowAd }                = useAdFrequency();

  const fetchPosts = useCallback(async () => {
    try {
      const getHomeFeed = httpsCallable<
        { classLevel?: string },
        { banners: unknown[]; posts: any[] }
      >(functions, "getHomeFeed");
      const { data } = await getHomeFeed({});
      const filtered = data.posts.filter(
        (p: any) => p.postType === "photo" || p.postType === "video"
      );
      setPosts(filtered);
    } catch {
      setPosts([]);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const feedData = useMemo(() => {
    const feed: any[] = [];
    let postIndex = 0;

    if (homeSection("stories"))          feed.push({ type: "stories" });
    if (homeSection("aiguru"))           feed.push({ type: "aiguru" });
    if (homeSection("creator_reels"))    feed.push({ type: "creator_reels" });
    if (homeSection("skillshorts"))      feed.push({ type: "skillshorts" });
    if (homeSection("referral"))         feed.push({ type: "referral" });
    if (homeSection("skillbattle"))      feed.push({ type: "skillbattle_preview" });
    if (homeSection("home_ads"))         feed.push({ type: "home_ads" });
    if (homeSection("vidya_star"))       feed.push({ type: "vidya_star" });
    if (homeSection("seekho_preview"))   feed.push({ type: "seekho_preview" });
    if (homeSection("scholarship_ad"))   feed.push({ type: "scholarship_ad" });
    if (homeSection("discover_preview")) feed.push({ type: "discover_preview" });
    if (homeSection("knowledge_hub"))    feed.push({ type: "knowledge_hub" });

    const showPosts = homeSection("feed_posts");
    const showAds   = homeSection("feed_ads");
    const showLearn = homeSection("learning");

    while (postIndex < posts.length) {
      if (showPosts && postIndex < posts.length) feed.push({ type: "post", data: posts[postIndex++] });
      if (showPosts && postIndex < posts.length) feed.push({ type: "post", data: posts[postIndex++] });
      if (showAds)   feed.push({ type: "ad" });
      if (showLearn) feed.push({ type: "learning" });
      if (showAds)   feed.push({ type: "ad" });
      if (showPosts && postIndex < posts.length) feed.push({ type: "post", data: posts[postIndex++] });
      if (showPosts && postIndex < posts.length) feed.push({ type: "post", data: posts[postIndex++] });
      if (!showPosts) break;
    }

    return feed;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeFlags, posts]);

  const renderItem = ({ item }: { item: any }) => {
    switch (item.type) {

      case "stories":
        return <Stories />;

      case "aiguru":
        return (
          <TouchableOpacity
            onPress={() => router.push("/ai-guru")}
            activeOpacity={0.88}
            style={styles.aiWrap}
          >
            <LinearGradient
              colors={["#0f0c29", "#302b63", "#24243e"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.aiBox}
            >
              <View style={styles.aiOrb} />
              <View style={styles.aiTopRow}>
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>✨ {t("poweredByAI") ?? "Powered by AI"}</Text>
                </View>
                <View style={styles.aiLiveTag}>
                  <View style={styles.aiPulseDot} />
                  <Text style={styles.aiLiveText}>{t("onlineLabel") ?? "Online"}</Text>
                </View>
              </View>
              <View style={styles.aiMain}>
                <Text style={styles.aiEmoji}>🤖</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiTitle}>{t("aiGuru")}</Text>
                  <Text style={styles.aiSubtitle}>{t("aiGuruSubtitle")}</Text>
                </View>
              </View>
              <View style={styles.aiChipsRow}>
                {[t("askAnything"), t("instantAnswers"), t("studyHelp")].map((f) => (
                  <View key={f} style={styles.aiChip}>
                    <Text style={styles.aiChipText}>{f}</Text>
                  </View>
                ))}
              </View>
              <LinearGradient
                colors={["#6366f1", "#8b5cf6"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.aiCta}
              >
                <Text style={styles.aiCtaText}>{t("startChatting")}</Text>
              </LinearGradient>
            </LinearGradient>
          </TouchableOpacity>
        );

      case "post":
        return <PostCard data={item.data} />;

      case "ad":
        return feedAd && canShowAd()
          ? <FeedAdCard ad={feedAd} module="home" key={feedAd.id} style={{ marginVertical: 4 }} />
          : null;

      case "creator_reels":
        return <SkillShortPreview showCreatorReels showBattleReels={false} />;

      case "skillshorts":
        return <SkillShortPreview showCreatorReels={false} showBattleReels />;

      case "referral":
        return <ReferralCard />;

      case "learning":
        return <ShortLearnPreview />;

      case "skillbattle_preview":
        return <SkillBattlePreviewSection />;

      case "home_ads":
        return <HomeAdsCarousel />;

      case "vidya_star":
        return <VidyaStarPreviewSection />;

      case "seekho_preview":
        return <SeekhoPreviewSection />;

      case "scholarship_ad":
        return scholarshipAd
          ? <ScholarshipAdCard ad={scholarshipAd} module="home" />
          : null;

      case "discover_preview":
        return <DiscoverPreviewSection />;

      case "knowledge_hub":
        return <KnowledgeHubSection />;

      default:
        return null;
    }
  };

  return (
    // edges={["top"]} — only apply safe area at the top (notch/status bar).
    // Tab bar handles its own bottom inset, so omitting "bottom" here
    // removes the extra gap that was appearing above the tab bar.
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <Header />
      <FlatList
        data={feedData}
        extraData={homeFlags}
        renderItem={renderItem}
        keyExtractor={(_, i) => i.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  listContent: { paddingBottom: 80 },

  aiWrap:      { marginHorizontal: 15, marginVertical: 10, borderRadius: 20, elevation: 8, shadowColor: "#6366f1", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
  aiBox:       { borderRadius: 20, padding: 18, overflow: "hidden", borderWidth: 1, borderColor: "rgba(99,102,241,0.35)" },
  aiOrb:       { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(99,102,241,0.18)", top: -40, right: -40 },
  aiTopRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  aiBadge:     { backgroundColor: "rgba(99,102,241,0.25)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "rgba(139,92,246,0.4)" },
  aiBadgeText: { color: "#a5b4fc", fontSize: 11, fontWeight: "700" },
  aiLiveTag:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(16,185,129,0.15)", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "rgba(16,185,129,0.3)" },
  aiPulseDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10b981" },
  aiLiveText:  { color: "#10b981", fontSize: 11, fontWeight: "700" },
  aiMain:      { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  aiEmoji:     { fontSize: 44 },
  aiTitle:     { color: "#fff", fontWeight: "900", fontSize: 22, letterSpacing: 0.3 },
  aiSubtitle:  { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "500", marginTop: 2 },
  aiChipsRow:  { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  aiChip:      { backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  aiChipText:  { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600" },
  aiCta:       { borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  aiCtaText:   { color: "#fff", fontSize: 14, fontWeight: "800", letterSpacing: 0.3 },
});