// PATH: components/header.tsx

import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

import VCoinsHeaderBadge from "@/components/VCoinsHeaderBadge";
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
  const [unreadCount, setUnreadCount] = useState(0);

  // 📸 Fetch profile picture from database
  useEffect(() => {
    const fetchProfilePic = async () => {
      try {
        if (!auth.currentUser) return;
        const studentDoc = await getDoc(doc(db, "students", auth.currentUser.uid));
        if (studentDoc.exists() && studentDoc.data()?.profilePic) {
          setProfilePic(studentDoc.data().profilePic);
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
            <TouchableOpacity onPress={handleMenuPress} style={styles.menuBtn}>
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
          <TouchableOpacity onPress={handleProfilePress}>
            <View style={styles.avatarRing}>
              <Image
                source={{
                  uri:
                    profilePic ||
                    `https://i.pravatar.cc/100?u=${auth.currentUser?.uid || "user"}`,
                }}
                style={styles.avatar}
                defaultSource={{
                  uri: `https://i.pravatar.cc/100?u=${auth.currentUser?.uid || "user"}`,
                }}
              />
            </View>
          </TouchableOpacity>

        </View>
      </View>
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
});
