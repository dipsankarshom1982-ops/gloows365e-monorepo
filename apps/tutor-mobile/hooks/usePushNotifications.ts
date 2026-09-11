// apps/tutor-mobile/hooks/usePushNotifications.ts
// Tutor push notifications phase — mirrors apps/mobile's own
// hooks/usePushNotifications.ts (see its header comment for the full
// design rationale) with one difference: the token is written to
// tutors/{uid}.pushToken instead of students/{uid}.pushToken, which is
// also the field functions/src/shikshahubNotify.ts's notifyTutor() now
// reads to send an Expo push alongside the existing in-app notification.
//
// Note: this app has no eas.json / extra.eas.projectId configured yet
// (see app.config.js's header comment — no branded assets or store
// submission setup exists for this app yet either), so
// getExpoPushTokenAsync() will likely fail until that's set up — caught
// non-fatally below, same as it already is in apps/mobile's version, so
// notification permission is still granted even when the token fetch
// itself can't succeed.

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { Alert, Linking, Platform } from "react-native";

import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";

const PREF_KEY = "notifications_enabled";

// Expo Go doesn't support remote push notifications since SDK 53
const IS_EXPO_GO = Constants.appOwnership === "expo";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function savePushTokenToFirestore(token: string | null) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await setDoc(doc(db, "tutors", uid), { pushToken: token }, { merge: true });
  } catch (e) {
    console.log("savePushToken:", e);
  }
}

async function requestPermissionAndRegisterToken(): Promise<"granted" | "denied"> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#6366F1",
      sound: "default",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return "denied";

  if (IS_EXPO_GO) {
    console.log("expo-notifications: running in Expo Go — skipping remote push token registration.");
    return "granted";
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;

    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    await savePushTokenToFirestore(token);
  } catch (e) {
    // Non-fatal — permission is granted even if token fetch fails (e.g.
    // no EAS project configured for this app yet).
    console.log("expo-notifications: could not get push token:", e);
  }

  return "granted";
}

async function registerForPushNotifications(): Promise<boolean> {
  const result = await requestPermissionAndRegisterToken();

  if (result === "denied") {
    Alert.alert(
      "Notifications Blocked",
      "To receive updates, please enable notifications for Gloows Tutor in your device Settings.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  }

  return true;
}

// Called automatically once per app session after the tutor profile loads
// (see app/_layout.tsx) — silent by design, skipped entirely if the tutor
// previously opted out via the Profile screen toggle. Same convention as
// apps/mobile's own silent auto-register.
export async function silentlyRegisterForPushNotifications(): Promise<void> {
  const pref = await AsyncStorage.getItem(PREF_KEY);
  if (pref === "false") return;
  try {
    await requestPermissionAndRegisterToken();
  } catch (e) {
    console.log("expo-notifications: silent registration failed:", e);
  }
}

export function usePushNotifications() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY).then((val) => {
      if (val !== null) setEnabled(val === "true");
    });
  }, []);

  const toggle = async () => {
    setLoading(true);
    try {
      if (!enabled) {
        const success = await registerForPushNotifications();
        if (success) {
          setEnabled(true);
          await AsyncStorage.setItem(PREF_KEY, "true");
        }
      } else {
        await savePushTokenToFirestore(null);
        setEnabled(false);
        await AsyncStorage.setItem(PREF_KEY, "false");
      }
    } finally {
      setLoading(false);
    }
  };

  return { enabled, loading, toggle };
}
