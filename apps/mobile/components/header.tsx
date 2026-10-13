// PATH: components/header.tsx

import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

import VCoinsHeaderBadge from "@/components/VCoinsHeaderBadge";
import TitleAvatar from "@/components/TitleAvatar";
import { useTheme } from "@/context/ThemeContext";
import { auth, db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";

type Props = {
  title?: string;
  hideMenu?: boolean;
  hideTitle?: boolean;
};

// Module-scoped (not per-mount) so the reload() network call happens once
// per app session instead of on every screen that renders <Header/>, and so
// a dismissal sticks while navigating between tabs. Both reset naturally on
// app restart — exactly the "dismissible for this session" behaviour the
// soft-gate reminder is meant to have.
let emailReloadedThisSession = false;
let verifyBannerDismissed = false;

// ─── Brand logo component ─────────────────────────────────────────────────────
function BrandLogo() {
  const { isDarkMode } = useTheme();

  return (
    <View style={logo.wrap}>
      {/* Gloows — gradient text effect using two colored spans */}
      <Text style={logo.gloows}>
        <Text style={{ color: isDarkMode ? "#A5B4FC" : "#4F46E5" }}>Gl</Text>
        <Text style={{ color: isDarkMode ? "#F1F5F9" : "#1E293B" }}>oows</Text>
      </Text>

      {/* 365 — gradient pill */}
      <LinearGradient
        colors={["#6366F1", "#8B5CF6", "#EC4899"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={logo.pill}
      >
        <Text style={logo.pillText}>365</Text>
      </LinearGradient>

      {/* E — amber superscript */}
      <Text style={logo.eTag}>E</Text>
    </View>
  );
}

const logo = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  gloows: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  pill: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  pillText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  eTag: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FBBF24",
    marginBottom: 8,
    letterSpacing: 0,
  },
});

// ─── Main Header ──────────────────────────────────────────────────────────────

export default function Header({
  title,
  hideMenu = false,
  hideTitle = false,
}: Props) {
  const { colors, isDarkMode } = useTheme();
  const navigation = useNavigation<any>();
  const router = useRouter();

  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [studentTitle, setStudentTitle] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [emailVerified, setEmailVerified] = useState(auth.currentUser?.emailVerified ?? true);
  const [bannerDismissed, setBannerDismissed] = useState(verifyBannerDismissed);

  // Soft-gate reminder — never blocks navigation or feature access, just
  // nudges. Firebase's client SDK doesn't push emailVerified changes to
  // auth.currentUser on its own, so a reload() is needed to notice a
  // verification click that happened elsewhere; done once per app session.
  useEffect(() => {
    if (!auth.currentUser || emailReloadedThisSession) return;
    emailReloadedThisSession = true;
    auth.currentUser.reload()
      .then(() => setEmailVerified(auth.currentUser?.emailVerified ?? true))
      .catch(() => { /* ignore — keep cached value */ });
  }, []);

  // 📸 Fetch profile picture from database
  useEffect(() => {
    const fetchProfilePic = async () => {
      try {
        if (!auth.currentUser) return;
        const studentDoc = await getDoc(doc(db, "students", auth.currentUser.uid));
        if (studentDoc.exists()) {
          const d = studentDoc.data();
          if (d?.profilePic) setProfilePic(d.profilePic);
          if (d?.title) setStudentTitle(d.title);
        }
      } catch (error) {
        console.log("Error fetching profile picture:", error);
      }
    };
    fetchProfilePic();
  }, []);

  // 🔔 Unread notifications listener
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const q = query(
      collection(db, "notifications", uid, "items"),
      where("read", "==", false)
    );

    const unsub = onSnapshot(q, (snap) => {
      setUnreadCount(snap.size);
    });

    return unsub;
  }, []);

  const handleMenuPress = () => {
    let nav: any = navigation;
    while (nav) {
      if (nav.getState?.()?.type === "drawer") {
        nav.dispatch(DrawerActions.openDrawer());
        return;
      }
      nav = nav.getParent?.();
    }
    navigation?.dispatch(DrawerActions.openDrawer());
  };

  const handleProfilePress = () => {
    router.push("/mypost");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Bottom border line — subtle gradient */}
      <LinearGradient
        colors={["transparent", isDarkMode ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.15)", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.borderLine}
      />

      <View style={styles.header}>

        {/* LEFT */}
        <View style={styles.leftSection}>
          {!hideMenu && (
            <TouchableOpacity
              onPress={handleMenuPress}
              style={styles.menuBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
            >
              <View style={[styles.menuLines, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
                <Ionicons name="menu" size={22} color={isDarkMode ? "#C7D2FE" : "#4F46E5"} />
              </View>
            </TouchableOpacity>
          )}

          {!hideTitle && <BrandLogo />}
        </View>

        {/* RIGHT */}
        <View style={styles.right}>

          {/* COINS */}
          <VCoinsHeaderBadge uid={auth.currentUser?.uid ?? null} />

          {/* NOTIFICATION */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push("/notifications")}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          >
            <View style={[styles.iconBg, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)" }]}>
              <Ionicons
                name={unreadCount > 0 ? "notifications" : "notifications-outline"}
                size={20}
                color={unreadCount > 0 ? "#F59E0B" : (isDarkMode ? "#94A3B8" : "#64748B")}
              />
            </View>
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* PROFILE */}
          <TouchableOpacity
            onPress={handleProfilePress}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
          >
            <View style={styles.avatarRing}>
              {profilePic ? (
                <Image source={{ uri: profilePic }} style={styles.avatar} />
              ) : (
                // FIX (bug report — avatar problem): this used to fall back
                // to `https://i.pravatar.cc/100?u=<uid>` — a random
                // third-party cartoon avatar unrelated to the student.
                // Registration now collects a Title (Mr/Ms/Mrs); use the
                // matching silhouette instead.
                <TitleAvatar title={studentTitle} size={28} />
              )}
            </View>
          </TouchableOpacity>

        </View>
      </View>

      {/* Soft-gate email verification reminder — dismissible for this app
          session, never blocks navigation. Hidden automatically for Google
          sign-ups (their email is already verified). */}
      {!emailVerified && !bannerDismissed && (
        <TouchableOpacity
          style={[styles.verifyBanner, { backgroundColor: isDarkMode ? "rgba(245,158,11,0.14)" : "rgba(245,158,11,0.12)" }]}
          onPress={() => router.push("/profile-settings")}
          activeOpacity={0.8}
        >
          <Ionicons name="mail-unread-outline" size={15} color="#F59E0B" />
          <Text style={styles.verifyBannerText} numberOfLines={2}>
            Please ask your parent to verify the email we sent — tap to resend
          </Text>
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => { verifyBannerDismissed = true; setBannerDismissed(true); }}
          >
            <Ionicons name="close" size={16} color="#F59E0B" />
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 0,
  },

  borderLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  menuBtn: {
    marginRight: 2,
  },

  menuLines: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  iconBtn: {
    position: "relative",
  },

  iconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  notifBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "transparent",
  },

  notifBadgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "900",
  },

  avatarRing: {
    padding: 2,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#6366F1",
  },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },

  verifyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },

  verifyBannerText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: "600",
    color: "#F59E0B",
    lineHeight: 15,
  },
});
