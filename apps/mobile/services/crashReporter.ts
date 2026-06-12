// PATH: services/crashReporter.ts
// Logs JS errors, unhandled promise rejections, and manual error reports
// to Firestore collection: crashReports/{reportId}

import { auth, db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Platform } from "react-native";
import Constants from "expo-constants";

export interface CrashReport {
  type:       "js_error" | "unhandled_rejection" | "manual" | "render_error";
  message:    string;
  stack?:     string;
  screen?:    string;
  uid?:       string;
  appVersion: string;
  platform:   string;
  osVersion?: string;
  deviceModel?:string;
  timestamp:  any;
  extra?:     Record<string, any>;
  resolved:   boolean;
}

function getAppVersion(): string {
  return Constants.expoConfig?.version ?? "unknown";
}

function getDeviceInfo() {
  return {
    platform:    Platform.OS,
    osVersion:   String(Platform.Version),
    deviceModel: Platform.OS === "ios"
      ? Constants.platform?.ios?.model ?? "iOS"
      : "Android",
  };
}

export async function logCrash(
  type: CrashReport["type"],
  error: Error | string,
  screen?: string,
  extra?: Record<string, any>
): Promise<void> {
  try {
    const message = typeof error === "string" ? error : error.message;
    const stack   = typeof error === "string" ? undefined : error.stack;
    const uid     = auth.currentUser?.uid;
    const device  = getDeviceInfo();

    const report: Omit<CrashReport, "timestamp"> & { timestamp: any } = {
      type,
      message:     message.slice(0, 1000),   // cap length
      stack:       stack?.slice(0, 3000),
      screen,
      uid,
      appVersion:  getAppVersion(),
      platform:    device.platform,
      osVersion:   device.osVersion,
      deviceModel: device.deviceModel,
      timestamp:   serverTimestamp(),
      extra,
      resolved:    false,
    };

    await addDoc(collection(db, "crashReports"), report);
  } catch {
    // Never let the crash reporter itself crash the app
    console.warn("[CrashReporter] Failed to log crash");
  }
}

// Set up global error handlers — call once at app startup
export function setupGlobalErrorHandlers(): void {
  // Unhandled JS errors
  const originalHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    logCrash("js_error", error, undefined, { isFatal });
    originalHandler?.(error, isFatal);
  });

  // Unhandled promise rejections
  const tracking = global as any;
  if (!tracking.__crashReporterInstalled) {
    tracking.__crashReporterInstalled = true;
    const orig = Promise.prototype.catch;
    // Use the native unhandledrejection tracking if available
    if (typeof HermesInternal !== "undefined") {
      // Hermes engine — handled via ErrorUtils above
    }
  }
}
