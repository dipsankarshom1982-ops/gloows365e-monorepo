// PATH: apps/mobile/app/(drawer)/_layout.tsx
// Changes:
//  • Removed LearnFunCoins and Pan-India learnScore rank
//  • Replaced with VCoins balance + VCoins annual rank
//  • Added surprise gift claim banner (if gift is available and unclaimed)
//  • Added Skill Boost drawer item

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
import { useStudentProfile, useFeatureFlags } from "@gloows/shared-logic";
import { INDIAN_LANGUAGES } from "@/app/language-settings";
import { auth, db } from "@/lib/firebase";
import { getLevelFromXP, XP_PER_LEVEL } from "@/lib/learnfun/constants";
import { ensureStudentId } from "@/services/studentIdService";
import TitleAvatar from "@/components/TitleAvatar";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getCountFromServer,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// Same detection used by app/index.tsx's boot-time routing — duplicated
// (not shared) to match that file's own convention. This is a defensive
// guard, not the primary routing mechanism: index.tsx already sends
// restart-education users straight to /restart-education/home and never
// into this (drawer) stack in the first place. This exists so that if a
// restart-education profile's studentProfile resolves while this layout
// is somehow already mounted (stale nav state, a deep link, app-state
// restore after being killed, etc.), they still can't end up looking at
// the main student app — they get bounced back out immediately.
const RESTART_TYPES = ["restartEducation", "restart_education", "restart"];
const RESTART_INDICATOR_FIELDS = ["lastClassPassed", "educationGapReason", "currentOccupation"];

export default function DrawerLayout() {
  const router = useRouter();
  const { colors } = useTheme();
  const { languageName } = useLanguage();
  const { drawerItem } = useFeatureFlags();
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();

  const { studentProfile, profileLoading: loading } = useStudentProfile();

  useEffect(() => {
    if (!studentProfile) return;
    const profile = studentProfile as Record<string, any>;
    const isRestartUser =
      (profile.profileType && RESTART_TYPES.includes(profile.profileType)) ||
      RESTART_INDICATOR_FIELDS.some((f) => f in profile);
    if (isRestartUser) {
      router.replace("/restart-education/home" as any);
    }
  }, [studentProfile]);

  const [vCoins,        setVCoins]        = useState<number>(0);
  const [vCoinRank,     setVCoinRank]     = useState<number | null>(null);
  const [giftAvailable, setGiftAvailable] = useState(false);
  const [giftClaimed,   setGiftClaimed]   = useState(false);
  const [studentIdCopied, setStudentIdCopied] = useState(false);

  // Self-heal: any account that predates this feature (or whose
  // registration-time ensureStudentId() call failed non-fatally) still
  // won't have a studentId on their profile — request one the first time
  // the drawer sees that gap. Idempotent server-side, and the ref guard
  // keeps this to one call per mount even though studentProfile updates
  // (e.g. vCoins ticking) re-run this effect.
  const studentIdRequestedRef = useRef(false);
  useEffect(() => {
    if (loading || !studentProfile || studentProfile.studentId) return;
    if (studentIdRequestedRef.current) return;
    studentIdRequestedRef.current = true;
    ensureStudentId().catch(() => { studentIdRequestedRef.current = false; });
  }, [loading, studentProfile]);

  const currentYear = new Date().getFullYear();

  // Listen to user doc for vCoins balance (gift is its own effect below —
  // it moved off users/{uid}.surpriseGift onto prizeClaims).
  // FIX (bug report — "all updated v-coins must be shown in drawer and
  // v-coins page properly"): there are two separate, disconnected balance
  // fields on users/{uid} — vCoinsBalance (written by services/
  // vCoinsService.ts's creditVCoins(), used for reels/videos/contests/
  // registration) and vCoins (written by a separate backend Cloud
  // Function, claimVCoinReward, used by the Daily Streak Quiz). Nothing
  // reconciles them. This used to read vCoins alone, so any coins earned
  // through the other pipeline never showed here. hooks/useVCoins.ts,
  // VCoinsHeaderBadge (via services/vCoinsService.ts), and this drawer now
  // all sum both fields the same way.
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setVCoins((d.vCoinsBalance ?? 0) + (d.vCoins ?? 0));
    });

    return () => unsub();
  }, []);

  // Surprise Gift banner — prizeClaims/{id} docs (periodType
  // "surprise_gift"), same collection/workflow as VidyaStar Starboard
  // prizes (apps/mobile/app/my-prizes.tsx, apps/admin's PrizeDeliveries.tsx
  // and VCoinLeaderboard.tsx). Reuses the exact same query shape
  // my-prizes.tsx already uses (uid ==, orderBy wonAt desc) so it needs no
  // index beyond the one that query already relies on — filtering down to
  // this year's gift happens client-side instead of adding a second
  // equality clause that'd need its own composite index.
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(collection(db, "prizeClaims"), where("uid", "==", user.uid), orderBy("wonAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const gift = snap.docs
        .map((d) => d.data())
        .find((g) => g.periodType === "surprise_gift" && g.periodKey === `surprise_gift_${currentYear}`);
      setGiftAvailable(!!gift);
      setGiftClaimed(!!gift && gift.status !== "unclaimed");
    }, () => {
      setGiftAvailable(false);
      setGiftClaimed(false);
    });

    return () => unsub();
  }, [currentYear]);

  // Compute annual VCoins rank
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

  const name         = studentProfile?.name               || auth.currentUser?.email?.split("@")[0] || "Student";
  const school       = studentProfile?.school             || t("yourSchool") || "Your School";
  const studentClass = studentProfile?.class              || "";
  const language     = studentProfile?.preferredLanguage  || "English";
  const district     = studentProfile?.location?.district || "";
  const state        = studentProfile?.location?.state    || "";
  const profilePic   = studentProfile?.profilePic         || null;
  const studentTitle = (studentProfile as Record<string, any> | null | undefined)?.title as string | undefined;
  const studentId    = studentProfile?.studentId;

  const handleCopyStudentId = async () => {
    if (!studentId) return;
    await Clipboard.setStringAsync(studentId);
    setStudentIdCopied(true);
    setTimeout(() => setStudentIdCopied(false), 1500);
  };

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
                  {profilePic ? (
                    <Image source={{ uri: profilePic }} style={styles.avatar} />
                  ) : (
                    // FIX (bug report — avatar problem): same fallback fix
                    // as header.tsx — no more random pravatar.cc image.
                    <TitleAvatar title={studentTitle} size={70} style={styles.avatar} />
                  )}

                  <Text style={styles.name}>{name}</Text>

                  {/* Student ID — auto-assigned, human-readable (e.g.
                      GLS000123), stable for the account's lifetime. Tap to
                      copy for support/reference use. Shown once assigned;
                      the self-heal effect above requests one for accounts
                      that don't have it yet, so this appears within a
                      moment even for pre-existing users. */}
                  {!!studentId && (
                    <TouchableOpacity
                      style={styles.studentIdBadge}
                      onPress={handleCopyStudentId}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="id-card-outline" size={12} color="#c7d2fe" />
                      <Text style={styles.studentIdText}>{studentId}</Text>
                      <Ionicons
                        name={studentIdCopied ? "checkmark" : "copy-outline"}
                        size={11}
                        color={studentIdCopied ? "#34D399" : "#818cf8"}
                      />
                    </TouchableOpacity>
                  )}

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
                      <Text style={styles.rankViewText}>{t("walletLabel") ?? "Wallet"}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Surprise Gift Banner — visually separated from the
                      V-Coins Rank banner above (extra marginTop on
                      giftBanner) and its own "Wallet" vs. gift-emoji+title
                      framing, so the two aren't mistaken for one control. */}
                  {giftAvailable && (
                    <TouchableOpacity
                      style={[
                        styles.giftBanner,
                        giftClaimed && styles.giftBannerClaimed,
                      ]}
                      onPress={() => router.push("/my-prizes")}
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
              {drawerItem("starboard") && (
                <DrawerItem icon="trophy-outline" label={t("Starboard")}
                 onPress={() => router.push("/starboard")} colors={colors} />
              )}
              {drawerItem("myPrizes") && (
                <DrawerItem icon="gift-outline" label={t("myPrizes")}
                 onPress={() => router.push("/my-prizes" as any)} colors={colors} />
              )}
              {drawerItem("wallet") && (
                <DrawerItem icon="wallet-outline" label={t("wallet")}
                  onPress={() => router.push("/vcoins/wallet")} colors={colors} />
              )}
              {drawerItem("dailyStreakQuiz") && (
                <DailyStreakQuizDrawerItem
                  onPress={() => router.push("/daily-streak-quiz" as any)}
                  colors={colors}
                  t={t}
                />
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
              {drawerItem("skillboost") && (
                <DrawerItem icon="flash-outline" label={t("skillBoost")}
                  onPress={() => router.push("/(drawer)/(tabs)/skillboost")} colors={colors} />
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
                <SkillBoardItem onPress={() => router.push("/skillboard")} t={t} />
              )}
              {drawerItem("glostore") && (
                <GloStoreItem onPress={() => router.push("/glostore" as any)} />
              )}
            </View>
          </ScrollView>

          {/* LOGOUT — pinned at bottom */}
          <TouchableOpacity
            style={[styles.logout, { backgroundColor: "rgba(248,113,113,0.08)", borderColor: colors.border, marginBottom: insets.bottom }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#F87171" />
            <Text style={styles.logoutText}>{t("logout")}</Text>
          </TouchableOpacity>

        </SafeAreaView>
      )}
    >
      <Drawer.Screen name="(tabs)" options={{ title: "Home" }} />
    </Drawer>
  );
}

function SkillBoardItem({ onPress, t }: { onPress: () => void; t: (key: string) => string }) {
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
          <Text style={styles.skillBoardLabel}>{t("skillBoard")}</Text>
        </View>
        <View style={styles.skillBoardBadge}>
          <Text style={styles.skillBoardBadgeText}>⭐ TOP</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// 🔥 Daily Streak Quiz — flame + quiz icon combo, sits just below Wallet
// (the app's "Coins/Rewards" engagement section) per spec §1.
function DailyStreakQuizDrawerItem({ onPress, colors, t }: { onPress: () => void; colors: any; t: (key: string) => string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.streakQuizItem, { backgroundColor: colors.background, borderColor: "rgba(249,115,22,0.3)" }]}
    >
      <View style={styles.streakQuizIconStack}>
        <Ionicons name="help-circle" size={20} color="#f97316" />
        <Text style={styles.streakQuizFlame}>🔥</Text>
      </View>
      <Text style={[styles.label, { color: colors.text }]}>{t("dailyStreakQuiz")}</Text>
      <View style={styles.streakQuizBadge}>
        <Text style={styles.streakQuizBadgeText}>NEW</Text>
      </View>
    </TouchableOpacity>
  );
}

// 🛍️ GloStore — admin-curated affiliate products (books, stationery, kits).
// Same treatment as Skill Board: its own gold gradient pill so it stands
// out from the plain list items, since it's a monetization surface.
function GloStoreItem({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.skillBoardWrapper}>
      <LinearGradient
        colors={["#7c2d12", "#ea580c", "#fb923c"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.skillBoardGradient}
      >
        <View style={styles.skillBoardLeft}>
          <Ionicons name="storefront" size={22} color="#fff" />
          <Text style={styles.skillBoardLabel}>GloStore</Text>
        </View>
        <View style={styles.skillBoardBadge}>
          <Text style={styles.skillBoardBadgeText}>🛍️ SHOP</Text>
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
  studentIdBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4, marginTop: 4,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  studentIdText: { color: "#c7d2fe", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
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
  giftBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#d97706", borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14, width: "100%",
    // Extra breathing room from the V-Coins Rank banner right above (whose
    // own "Wallet" button was easy to tap by mistake thinking it was this
    // gift banner) — was 6, clearly too tight given the two are the same
    // width and nearly touching.
    marginTop: 16,
  },
  giftBannerClaimed: { backgroundColor: "#4B5563" },
  giftEmoji: { fontSize: 22 },
  giftTitle: { color: "#fff", fontSize: 13, fontWeight: "800" },
  giftSub:   { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "500" },
  menu:     { marginTop: 20 },
  item:     { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  label:    { marginLeft: 15, fontSize: 15 },
  streakQuizItem: {
    flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 10,
    borderRadius: 12, borderWidth: 1, marginVertical: 4,
  },
  streakQuizIconStack: { width: 24, alignItems: "center" },
  streakQuizFlame: { fontSize: 11, marginTop: -4 },
  streakQuizBadge: {
    marginLeft: "auto", backgroundColor: "#f97316", borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  streakQuizBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
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