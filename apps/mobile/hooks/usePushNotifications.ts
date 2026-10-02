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

// Show alerts and play sound for foreground notifications
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
    await setDoc(doc(db, "students", uid), { pushToken: token }, { merge: true });
  } catch (e) {
    console.log("savePushToken:", e);
  }
}

// Shared by both the manual Settings toggle and the silent auto-register
// path below. Never shows UI itself — callers decide how to react to a
// denied/blocked permission.
async function requestPermissionAndRegisterToken(): Promise<"granted" | "denied"> {
  // Create default notification channel on Android
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

  // Remote push token registration is not available in Expo Go (SDK 53+).
  // In a development build or production app this registers the device token.
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
    // Non-fatal — permission is granted even if token fetch fails
    console.log("expo-notifications: could not get push token:", e);
  }

  return "granted";
}

async function registerForPushNotifications(): Promise<boolean> {
  const result = await requestPermissionAndRegisterToken();

  if (result === "denied") {
    Alert.alert(
      "Notifications Blocked",
      "To receive updates, please enable notifications for Vidya in your device Settings.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  }

  return true;
}

// Called automatically once per app session after login (see app/_layout.tsx)
// — silent by design (no Alert) so an already-denied user isn't nagged on
// every launch; the OS itself only shows its permission prompt once per
// install regardless of how many times we call requestPermissionsAsync.
// Skipped entirely if the user has explicitly turned notifications off via
// the Settings toggle, so this never overrides an explicit opt-out.
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

  // Load persisted preference on mount
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
        // Remove token from Firestore — OS permission cannot be revoked programmatically
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
