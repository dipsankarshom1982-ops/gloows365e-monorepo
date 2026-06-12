// PATH: app/splash.tsx
// Splash screen — shows Gloows365E brand logo (matches header.tsx exactly)
// then routes to home (logged in) or welcome (logged out)

import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { auth } from "@/lib/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged, User } from "firebase/auth";

// ── Brand Logo — exact same as header.tsx ─────────────────────────────────────
function BrandLogo({ opacity }: { opacity: Animated.Value }) {
  return (
    <Animated.View style={[styles.logoWrap, { opacity }]}>
      {/* Gl + oows */}
      <Text style={styles.gloows}>
        <Text style={{ color: "#A5B4FC" }}>Gl</Text>
        <Text style={{ color: "#F1F5F9" }}>oows</Text>
      </Text>

      {/* 365 pill */}
      <LinearGradient
        colors={["#6366F1", "#8B5CF6", "#EC4899"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.pill}
      >
        <Text style={styles.pillText}>365</Text>
      </LinearGradient>

      {/* E superscript */}
      <Text style={styles.eTag}>E</Text>
    </Animated.View>
  );
}

export default function SplashScreen() {
  const router = useRouter();

  const scaleAnim   = useRef(new Animated.Value(0.75)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateY  = useRef(new Animated.Value(24)).current;

  const [appReady, setAppReady] = useState(false);
  const [user,     setUser]     = useState<User | null>(null);

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1, duration: 900,
        easing: Easing.out(Easing.exp), useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1, duration: 800, useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0, duration: 900,
        easing: Easing.out(Easing.exp), useNativeDriver: true,
      }),
    ]).start();

    // Auth listener
    const unsubscribe = onAuthStateChanged(auth, (usr) => setUser(usr));

    // Minimum splash time
    const timer = setTimeout(() => setAppReady(true), 2200);

    return () => { unsubscribe(); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!appReady) return;
    (async () => {
      const hasOpened = await AsyncStorage.getItem("hasOpened");
      if (user) {
        router.replace("/(drawer)/(tabs)/home");
      } else {
        if (!hasOpened) await AsyncStorage.setItem("hasOpened", "true");
        router.replace("/welcome");
      }
    })();
  }, [appReady, user]);

  return (
    <LinearGradient colors={["#020617", "#0f172a", "#020617"]} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>

          {/* Brand logo — animated */}
          <Animated.View
            style={{
              transform: [{ scale: scaleAnim }, { translateY }],
              alignItems: "center",
            }}
          >
            <BrandLogo opacity={opacityAnim} />

            {/* Subtle glow ring behind logo */}
            <Animated.View style={[styles.glowRing, { opacity: opacityAnim }]} />
          </Animated.View>

          {/* Tagline */}
          <Animated.Text style={[styles.tagline, { opacity: opacityAnim }]}>
            Learn • Compete • Earn 🚀
          </Animated.Text>

          {/* Powered by */}
          <Animated.Text style={[styles.powered, { opacity: opacityAnim }]}>
            Powered by Shikshakool Academy Pvt. Ltd.
          </Animated.Text>

        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe:      { flex: 1, justifyContent: "center", alignItems: "center" },
  center:    { alignItems: "center" },

  // Brand logo
  logoWrap:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  gloows:    { fontSize: 52, fontWeight: "900", letterSpacing: -1 },
  pill:      {
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4,
    justifyContent: "center", alignItems: "center",
  },
  pillText:  { color: "#fff", fontSize: 26, fontWeight: "900", letterSpacing: 0.5 },
  eTag:      { fontSize: 22, fontWeight: "900", color: "#FBBF24", marginBottom: 22, letterSpacing: 0 },

  glowRing: {
    position: "absolute",
    width: 260, height: 80,
    borderRadius: 60,
    backgroundColor: "rgba(99,102,241,0.12)",
    zIndex: -1,
  },

  tagline: {
    color: "#94a3b8",
    marginTop: 28,
    fontSize: 15,
    letterSpacing: 1,
    fontWeight: "600",
  },
  powered: {
    color: "#64748b",
    marginTop: 10,
    fontSize: 12,
  },
});