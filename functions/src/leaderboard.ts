import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { getRedis, TTL, RK } from "./redish";

const db = admin.firestore();

type Scope = "india" | "state" | "district" | "local";

interface LeaderboardEntry {
  id: string;
  userId: string;
  name: string;
  profilePic: string;
  school: string;
  class: string;
  totalScore: number;
  ranks: Record<string, number>;
  location: {
    city: string;
    district: string;
    state: string;
    pincode: string;
    country: string;
  };
}

// ─── getLeaderboard ───────────────────────────────────────────────────────────
// Returns cached skillboard top-50 for a given class + month + scope.
// Client calls this instead of reading Firestore directly.

export const getLeaderboard = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "128MB", secrets: ["REDIS_URL", "REDIS_TOKEN"] })
  .https.onCall(async (
    data: { class: string; month: string; scope?: Scope; scopeValue?: string },
    context
  ) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }

    const { class: cls, month, scope = "india", scopeValue = "" } = data;

    if (!cls || !month) {
      throw new functionsV1.https.HttpsError("invalid-argument", "class and month are required");
    }

    // Key includes scopeValue for state/district/local scopes
    const cacheKey = RK.leaderboard(
      scope === "india" ? scope : `${scope}:${scopeValue}`,
      cls,
      month
    );

    // ── Cache hit ────────────────────────────────────────────
    try {
      const cached = await getRedis().get<LeaderboardEntry[]>(cacheKey);
      if (cached) return { leaderboard: cached, fromCache: true };
    } catch { /* Redis unavailable */ }

    // ── Firestore fallback ───────────────────────────────────
    let q: admin.firestore.Query = db
      .collection("skillboard")
      .where("class", "==", cls)
      .where("month", "==", month)
      .orderBy("totalScore", "desc")
      .limit(50);

    if (scope !== "india" && scopeValue) {
      const fieldMap: Record<string, string> = {
        state:    "location.state",
        district: "location.district",
        local:    "location.pincode",
      };
      q = db
        .collection("skillboard")
        .where("class", "==", cls)
        .where("month", "==", month)
        .where(fieldMap[scope] ?? "location.state", "==", scopeValue)
        .orderBy("totalScore", "desc")
        .limit(50);
    }

    const snap = await q.get();
    const leaderboard = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as LeaderboardEntry)
    );

    getRedis().set(cacheKey, leaderboard, { ex: TTL.leaderboard }).catch(() => {});

    return { leaderboard, fromCache: false };
  });
