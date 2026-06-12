// PATH: app/(drawer)/_layout.tsx
// Changes:
//  • Removed LearnFunCoins and Pan-India learnScore rank
//  • Replaced with VCoins balance + VCoins annual rank
//  • Added surprise gift claim banner (if gift is available and unclaimed)

import { Drawer } from "expo-router/drawer";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "@/context/ThemeContext";
import { useLanguage, useAppTranslation } from "@/context/LanguageContext";
import { useStudentProfile } from "@/context/StudentProfileContext";
import { useFeatureFlags } from "@/context/FeatureFlagsContext";
import { INDIAN_LANGUAGES } from "@/app/language-settings";
import { auth, db } from "@/lib/firebase";
import { getLevelFromXP, XP_PER_LEVEL } from "@/lib/learnfun/constants";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getCountFromServer,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function DrawerLayout() {
  const router = useRouter();
  const { colors } = useTheme();
  const { languageName } = useLanguage();
  const { drawerItem } = useFeatureFlags();
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();

  const { studentProfile, profileLoading: loading } = useStudentProfile();

  // VCoins balance (real-time from users/{uid})
  const [vCoins, setVCoins] = useState<number>(0);
  // Annual VCoins rank
  const [vCoinRank, setVCoinRank] = useState<number | null>(null);
  // Surprise gift state
  const [giftAvailable, setGiftAvailable] = useState(false);
  const [giftClaimed, setGiftClaimed] = useState(false);

  const currentYear = new Date().getFullYear();

  // Listen to user doc for vCoins balance + gift
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      const bal = d.vCoins ?? 0;
      setVCoins(bal);

      // Gift: admin sets surpriseGift.year + surpriseGift.available
      const gift = d.surpriseGift;
      if (gift && gift.available && gift.year === currentYear) {
        setGiftAvailable(true);
        setGiftClaimed(!!gift.claimed);
      } else {
        setGiftAvailable(false);
        setGiftClaimed(false);
      }
    });

    return () => unsub();
  }, []);

  // Compute annual VCoins rank: count users with more yearlyVCoins than current user
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const yearField = `vCoinsYear_${currentYear}`;
    const score = studentProfile?.[yearField] ?? 0;

    getCountFromServer(
      query(
        collection(db, "users"),
        where(`vCoinsYear_${currentYear}`, ">", score)
      )
    )
      .then((r) => setVCoinRank(r.data().count + 1))
      .catch(() => setVCoinRank(null));
  }, [studentProfile]);

  // Derive LearnFun XP stats
  const learnXP   = studentProfile?.LearnFunXP ?? 0;
  const level     = getLevelFromXP(learnXP);
  const xpInLevel = learnXP % XP_PER_LEVEL;
  const xpPct     = Math.min((xpInLevel / XP_PER_LEVEL) * 100, 100);

  const name         = studentProfile?.name         || auth.currentUser?.email?.split("@")[0] || "Student";
  const school       = studentProfile?.school       || t("yourSchool") || "Your School";
  const studentClass = studentProfile?.class        || "";
  const language     = studentProfile?.preferredLanguage || "English";
  const district     = studentProfile?.location?.district || "";
  const state        = studentProfile?.location?.state    || "";
  const profilePic   = studentProfile?.profilePic   || null;

  const handleLogout = async () => {
    if (auth.currentUser?.email) {
      await AsyncStorage.setItem("lastEmail", auth.currentUser.email);
    }
    await signOut(auth);
    router.replace("/login");
  };

  return (
    <Drawer
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: colors.background,
          width: 300,
        },
      }}
      drawerContent={() => (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* PROFILE CARD */}
            <LinearGradient
              colors={["#1e1b4b", "#3730a3"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileCard}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : (
                <>
                  <Image
                    source={{
                      uri: profilePic || "https://i.pravatar.cc/150?u=" + (auth.currentUser?.email || "user"),
                    }}
                    style={styles.avatar}
                  />

                  <Text style={styles.name}>{name}</Text>

                  <View style={styles.infoBox}>
                    <Text style={styles.infoText}>🏫 {school}</Text>
                    {!!studentClass && <Text style={styles.infoText}>📚 Class {studentClass}</Text>}
                    <Text style={styles.infoText}>🗣️ {language}</Text>
                    {!!district && !!state && (
                      <Text style={styles.infoText}>📍 {district}, {state}</Text>
                    )}
                  </View>

                  {/* V-Coins + XP + Level stats */}
                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <Text style={styles.statEmoji}>🪙</Text>
                      <Text style={styles.statValue}>{vCoins}</Text>
                      <Text style={styles.statLabel}>{t("vCoinsLabel") ?? "V-Coins"}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                      <Text style={styles.statEmoji}>⚡</Text>
                      <Text style={styles.statValue}>{learnXP}</Text>
                      <Text style={styles.statLabel}>{t("xpLabel") ?? "XP"}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                      <Text style={styles.statEmoji}>🎮</Text>
                      <Text style={styles.statValue}>Lv {level}</Text>
                      <Text style={styles.statLabel}>{t("levelLabel") ?? "Level"}</Text>
                    </View>
                  </View>

                  {/* XP progress bar */}
                  <View style={styles.xpBarRow}>
                    <Text style={styles.xpBarLabel}>{t("xpToNextLevel") ?? "XP to next level"}</Text>
                    <Text style={styles.xpBarLabel}>{xpInLevel}/{XP_PER_LEVEL}</Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${xpPct}%` }]} />
                  </View>

                  {/* V-Coins Annual Rank */}
                  <View style={styles.rankBanner}>
                    <Text style={styles.rankTrophy}>🏆</Text>
                    <View>
                      <Text style={styles.rankLabel}>{t("vCoinsRankLabel") ?? "V-Coins Rank"} {currentYear}</Text>
                      <Text style={styles.rankValue}>
                        {vCoinRank !== null ? `#${vCoinRank}` : "—"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.rankViewBtn}
                      onPress={() => router.push("/vcoins/wallet")}
                    >
                      <Text style={styles.rankViewText}>{t("viewLabel") ?? "View"}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Surprise Gift Banner */}
                  {giftAvailable && (
                    <TouchableOpacity
                      style={[
                        styles.giftBanner,
                        giftClaimed && styles.giftBannerClaimed,
                      ]}
                      onPress={() => router.push("/vcoins/claim-gift")}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.giftEmoji}>🎁</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.giftTitle}>
                          {giftClaimed ? (t("giftClaimed") ?? "Gift Claimed!") : (t("surpriseGiftWaiting") ?? "Surprise Gift Waiting!")}
                        </Text>
                        <Text style={styles.giftSub}>
                          {giftClaimed
                            ? (t("giftOnItsWay") ?? "Your gift is on its way")
                            : (t("tapToClaimReward") ?? "Tap to claim your reward")}
                        </Text>
                      </View>
                      {!giftClaimed && (
                        <Ionicons name="chevron-forward" size={18} color="#fff" />
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}
            </LinearGradient>

            {/* MENU */}
            <View style={styles.menu}>
              {drawerItem("home") && (
                <DrawerItem icon="home" label={t("home")}
                  onPress={() => router.push("/(drawer)/(tabs)/home")} active colors={colors} />
              )}
              {drawerItem("leaderboard") && (
                <DrawerItem icon="trophy-outline" label={t("leaderboard")}
                  onPress={() => router.push("/leaderboard")} colors={colors} />
              )}
              {drawerItem("wallet") && (
                <DrawerItem icon="wallet-outline" label={t("wallet")}
                  onPress={() => router.push("/vcoins/wallet")} colors={colors} />
              )}
              {drawerItem("settings") && (
                <DrawerItem icon="settings-outline" label={t("settings")}
                  onPress={() => router.push("/settings")} colors={colors} />
              )}
              {drawerItem("dashboard") && (
                <DrawerItem icon="grid-outline" label={t("dashboard")}
                  onPress={() => router.push("/dashboard")} colors={colors} />
              )}
              {drawerItem("aiguru") && (
                <DrawerItem icon="school-outline" label={t("aiGuru")}
                  onPress={() => router.push("/ai-guru")} colors={colors} />
              )}
              {drawerItem("learnfun") && (
                <DrawerItem icon="book-outline" label={t("learnFunLabel") ?? "LearnFun"}
                  onPress={() => router.push("/(drawer)/(tabs)/learnFun")} colors={colors} />
              )}

              {/* Language selector */}
              {drawerItem("language") && (
                <TouchableOpacity
                  style={[styles.langItem, { backgroundColor: colors.background }]}
                  onPress={() => router.push("/language-settings" as any)}
                >
                  <View style={[styles.langIconBox, { backgroundColor: `${colors.accent}20` }]}>
                    <Ionicons name="globe-outline" size={18} color={colors.accent} />
                  </View>
                  <View style={styles.langTextBlock}>
                    <Text style={[styles.langItemLabel, { color: colors.text }]}>{t("language")}</Text>
                    {(() => {
                      const lang = INDIAN_LANGUAGES.find((l) => l.name === languageName);
                      return (
                        <Text style={[styles.langItemSub, { color: colors.accent }]}>
                          {lang ? `${lang.native} · ${lang.name}` : languageName}
                        </Text>
                      );
                    })()}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}

              {drawerItem("skillboard") && (
                <SkillBoardItem onPress={() => router.push("/skillboard")} />
              )}
            </View>
          </ScrollView>

          {/* LOGOUT — pinned at bottom */}
          <TouchableOpacity
            style={[styles.logout, { backgroundColor: `${colors.text}10`, marginBottom: insets.bottom }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#F87171" />
            <Text style={[styles.logoutText, { color: colors.text }]}>{t("logout")}</Text>
          </TouchableOpacity>

        </SafeAreaView>
      )}
    >
      <Drawer.Screen name="(tabs)" options={{ title: "Home" }} />
    </Drawer>
  );
}

function SkillBoardItem({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.skillBoardWrapper}>
      <LinearGradient
        colors={["#92400e", "#d97706", "#fbbf24"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.skillBoardGradient}
      >
        <View style={styles.skillBoardLeft}>
          <Ionicons name="trophy" size={22} color="#fff" />
          <Text style={styles.skillBoardLabel}>Skill Board</Text>
        </View>
        <View style={styles.skillBoardBadge}>
          <Text style={styles.skillBoardBadgeText}>⭐ TOP</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function DrawerItem({ icon, label, onPress, active, colors }: any) {
  return (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: active ? `${colors.accent}20` : colors.background }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={active ? colors.accent : colors.textSecondary} />
      <Text style={[styles.label, { color: active ? colors.accent : colors.text }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 12 },
  profileCard: {
    borderRadius: 20, padding: 20, alignItems: "center", gap: 8,
  },
  avatar: { width: 70, height: 70, borderRadius: 35, marginBottom: 4 },
  name: { color: "#fff", fontSize: 17, fontWeight: "800" },
  infoBox: { alignItems: "center", marginVertical: 4 },
  infoText: { color: "#c7d2fe", fontSize: 12, marginVertical: 2, fontWeight: "500" },
  statsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginTop: 8, backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 12, width: "100%",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  statBox:    { flex: 1, alignItems: "center", gap: 3 },
  statEmoji:  { fontSize: 18 },
  statValue:  { color: "#fff", fontWeight: "800", fontSize: 15 },
  statLabel:  { color: "#a5b4fc", fontSize: 10, fontWeight: "600" },
  statDivider: { width: 1, height: 38, backgroundColor: "rgba(255,255,255,0.2)" },
  xpBarRow: {
    flexDirection: "row", justifyContent: "space-between", width: "100%", paddingHorizontal: 2,
  },
  xpBarLabel: { color: "#c7d2fe", fontSize: 10, fontWeight: "600" },
  progressBar: { height: 8, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 6, width: "100%" },
  progressFill: { height: "100%", backgroundColor: "#818cf8", borderRadius: 6 },
  rankBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 16, width: "100%", marginTop: 4,
    borderWidth: 1, borderColor: "rgba(251,191,36,0.4)",
  },
  rankTrophy: { fontSize: 24 },
  rankLabel:  { color: "#fde68a", fontSize: 11, fontWeight: "600" },
  rankValue:  { color: "#fff", fontSize: 20, fontWeight: "800" },
  rankViewBtn: {
    marginLeft: "auto", backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  rankViewText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  // Surprise gift banner
  giftBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#d97706", borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14, width: "100%",
    marginTop: 6,
  },
  giftBannerClaimed: { backgroundColor: "#4B5563" },
  giftEmoji: { fontSize: 22 },
  giftTitle: { color: "#fff", fontSize: 13, fontWeight: "800" },
  giftSub:   { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "500" },

  menu:     { marginTop: 20 },
  item:     { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  label:    { marginLeft: 15, fontSize: 15 },
  langItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  langIconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  langTextBlock: { flex: 1 },
  langItemLabel: { fontSize: 15, fontWeight: "600" },
  langItemSub:   { fontSize: 12, fontWeight: "600", marginTop: 1 },
  logout: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 15, paddingHorizontal: 20,
    borderTopWidth: 1, borderColor: "#222",
  },
  logoutText: { color: "#F87171", marginLeft: 10, fontSize: 16, fontWeight: "600" },
  skillBoardWrapper: {
    marginVertical: 6, borderRadius: 14, overflow: "hidden",
    shadowColor: "#d97706", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 8, elevation: 6,
  },
  skillBoardGradient: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 14, paddingHorizontal: 16,
  },
  skillBoardLeft:      { flexDirection: "row", alignItems: "center", gap: 12 },
  skillBoardLabel:     { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
  skillBoardBadge:     {
    backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)",
  },
  skillBoardBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
