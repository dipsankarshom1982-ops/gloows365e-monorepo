import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import axios from "axios";

const FIREBASE_API_KEY = "AIzaSyCpS6KjmnGAD5vCuB_swM2SWRd6-nhoiys";

type Role = "superAdmin" | "admin" | "moderator";

export const createAdmin = onCall(async (request) => {
  if (!request.auth?.token?.superAdmin) {
    throw new HttpsError("permission-denied", "Only superAdmins can create admins.");
  }

  const { email, name, role } = request.data as { email: string; name: string; role: Role };

  if (!email || !name || !role) {
    throw new HttpsError("invalid-argument", "email, name and role are required.");
  }
  if (!["superAdmin", "admin", "moderator"].includes(role)) {
    throw new HttpsError("invalid-argument", "role must be superAdmin, admin, or moderator.");
  }

  const auth = admin.auth();
  const db   = admin.firestore();

  // Create user or fetch existing
  let uid: string;
  try {
    const user = await auth.createUser({ email, displayName: name });
    uid = user.uid;
  } catch (e: any) {
    if (e.code === "auth/email-already-exists") {
      const existing = await auth.getUserByEmail(email);
      uid = existing.uid;
    } else {
      throw new HttpsError("internal", e.message);
    }
  }

  // Set custom claims
  // FIX (launch audit, Task 6) — moderator used to get {} (no claims at
  // all). Every admin-gated route/rule in this codebase checks the single
  // coarse `admin` claim — there's no separate `moderator` claim anywhere
  // in firestore.rules or apps/admin/src/main.tsx's ProtectedRoutes — so a
  // moderator with no claims couldn't pass that gate and could never log
  // in at all. Granted the same base `admin: true` claim as the "admin"
  // role; what actually distinguishes a moderator is the narrower
  // `permissions` array already correctly set below (["read"]), which
  // filters what they see in the sidebar (lib/permissions.ts's
  // hasPermission). See this function's/Admins.tsx's related comments for
  // the follow-up this doesn't cover: that permissions array isn't
  // enforced at the route or Firestore-rules layer, only the nav — a
  // moderator can still reach any page by URL or write via devtools.
  const claims =
    role === "superAdmin" ? { admin: true, superAdmin: true } :
    /* admin | moderator */ { admin: true };

  await auth.setCustomUserClaims(uid, claims);

  // Upsert Firestore admins doc
  const permissions =
    role === "superAdmin" ? ["all"] :
    role === "admin"      ? ["read", "write"] :
                            ["read"];

  await db.doc(`admins/${uid}`).set({
    uid,
    email,
    name,
    role,
    permissions,
    isActive:  true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: request.auth.uid,
  }, { merge: true });

  // Send password reset email so the new admin can set their own password
  await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
    { requestType: "PASSWORD_RESET", email }
  );

  console.log(`✅ Admin created: ${email} (${role}) uid=${uid}`);
  return { uid, email };
});


export const removeAdmin = onCall(async (request) => {
  if (!request.auth?.token?.superAdmin) {
    throw new HttpsError("permission-denied", "Only superAdmins can remove admins.");
  }

  const { uid } = request.data as { uid: string };
  if (!uid) throw new HttpsError("invalid-argument", "uid is required.");
  if (uid === request.auth.uid) throw new HttpsError("invalid-argument", "You cannot remove yourself.");

  await admin.auth().setCustomUserClaims(uid, {});
  // FIX (launch audit, Task 6) — clearing claims alone doesn't touch an
  // already-issued ID token: the Firebase client SDK caches it for up to
  // ~1hr and only fetches a fresh (now claim-less) one on its own refresh
  // cycle. revokeRefreshTokens forces that refresh to fail outright, so a
  // removed admin can't silently keep minting fresh tokens with the old
  // claims baked in — they're forced to sign in again, at which point
  // there's nothing left to grant them. This is the platform's actual
  // ceiling on "how fast can access be cut off": the *current* cached ID
  // token, if one is still live, remains valid for the rest of its natural
  // lifetime (Firestore rules evaluate claims from the token itself, not a
  // live revocation check) — there's no faster path without server-side
  // token verification on every read, which this codebase's rules
  // deliberately avoid for cost/latency reasons (see firestore.rules'
  // "no get() calls" convention).
  await admin.auth().revokeRefreshTokens(uid);
  await admin.firestore().doc(`admins/${uid}`).update({ isActive: false, role: "removed" });

  console.log(`✅ Admin removed (claims cleared, refresh tokens revoked): uid=${uid}`);
  return { uid };
});


// ── Content Moderation ─────────────────────────────────────────────────────────

export const approveContent = onCall(async (request) => {
  if (!request.auth?.token?.admin) {
    throw new HttpsError("permission-denied", "Admins only.");
  }

  const { collection, docId, action, reason } =
    request.data as { collection: string; docId: string; action: "approve" | "reject" | "in_review"; reason?: string };

  const ALLOWED = ["stories", "skillBattles", "seekhoVideos", "knowledgeVideos", "posts"];
  if (!ALLOWED.includes(collection)) {
    throw new HttpsError("invalid-argument", `collection must be one of: ${ALLOWED.join(", ")}`);
  }
  if (!docId || !["approve", "reject", "in_review"].includes(action)) {
    throw new HttpsError("invalid-argument", "docId and action (approve|reject|in_review) are required.");
  }

  const statusMap: Record<string, string> = {
    approve:   "approved",
    reject:    "rejected",
    in_review: "in_review",
  };

  const update: Record<string, unknown> = {
    status:         statusMap[action],
    approvalStatus: statusMap[action],
    reviewedBy:     request.auth.uid,
    reviewedAt:     admin.firestore.FieldValue.serverTimestamp(),
  };
  if (action === "reject" && reason) update.rejectionReason = reason;

  await admin.firestore().doc(`${collection}/${docId}`).update(update);
  console.log(`✅ ${action}d ${collection}/${docId} by ${request.auth.uid}`);
  return { success: true };
});


// ── Coupon Management ──────────────────────────────────────────────────────────

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export const createCoupon = onCall(async (request) => {
  if (!request.auth?.token?.admin) {
    throw new HttpsError("permission-denied", "Admins only.");
  }

  const { code, discountType, discountValue, maxUses, expiresAt, planIds } =
    request.data as {
      code?: string;
      discountType: "percent" | "flat";
      discountValue: number;
      maxUses: number;
      expiresAt: string;
      planIds?: string[];
    };

  if (!["percent", "flat"].includes(discountType)) {
    throw new HttpsError("invalid-argument", "discountType must be percent or flat.");
  }
  if (!discountValue || discountValue <= 0) throw new HttpsError("invalid-argument", "discountValue must be > 0.");
  if (!maxUses || maxUses <= 0) throw new HttpsError("invalid-argument", "maxUses must be > 0.");
  if (!expiresAt) throw new HttpsError("invalid-argument", "expiresAt is required.");

  const db = admin.firestore();
  const finalCode = code?.toUpperCase().trim() || generateCode();

  // Check uniqueness
  const existing = await db.collection("coupons").where("code", "==", finalCode).limit(1).get();
  if (!existing.empty) {
    throw new HttpsError("already-exists", `Coupon code "${finalCode}" already exists.`);
  }

  const ref = await db.collection("coupons").add({
    code:          finalCode,
    discountType,
    discountValue,
    maxUses,
    usedCount:    0,
    expiresAt,
    isActive:     true,
    planIds:      planIds ?? [],
    createdBy:    request.auth.uid,
    createdAt:    admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`✅ Coupon created: ${finalCode} by ${request.auth.uid}`);
  return { couponId: ref.id, code: finalCode };
});


// ── Combo Plan ─────────────────────────────────────────────────────────────────

export const createComboPlan = onCall(async (request) => {
  if (!request.auth?.token?.superAdmin) {
    throw new HttpsError("permission-denied", "superAdmins only.");
  }

  const { name, description, planIds, price, durationDays, discountPercent } =
    request.data as {
      name: string;
      description: string;
      planIds: string[];
      price: number;
      durationDays: number;
      discountPercent: number;
    };

  if (!name || !planIds?.length || !price || !durationDays) {
    throw new HttpsError("invalid-argument", "name, planIds, price and durationDays are required.");
  }

  const ref = await admin.firestore().collection("subscriptionPlans").add({
    name,
    description,
    planIds,
    price,
    durationDays,
    discountPercent: discountPercent ?? 0,
    isCombo:   true,
    isActive:  true,
    createdBy: request.auth.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`✅ Combo plan created: ${name} (${ref.id})`);
  return { planId: ref.id };
});


// ── User Subscription History ──────────────────────────────────────────────────

export const getUserSubscriptionHistory = onCall(async (request) => {
  if (!request.auth?.token?.admin) {
    throw new HttpsError("permission-denied", "Admins only.");
  }

  const { userId } = request.data as { userId: string };
  if (!userId) throw new HttpsError("invalid-argument", "userId is required.");

  const db = admin.firestore();

  // FIX (found during Payment Management investigation, 2026-08-26):
  // subscriptions/{uid} is a single doc per user KEYED BY uid — the doc
  // never has a `userId` FIELD inside it (see aiGuruSubscription.ts's
  // aiGuruPaymentSuccess: db.doc(`subscriptions/${uid}`), no userId field
  // ever written). The old `.where("userId","==",userId)` query against
  // that collection could therefore never match anything — this "main"
  // branch has likely never returned a result since it was written. Fixed
  // to a direct doc().get(), which is also what every other reader of this
  // collection in the codebase already does. seekho_subscriptions/{userId}
  // is different — it DOES store a userId field (seekho.ts's
  // seekhoCreateSubscription writes { userId, plan, ... }) — that query
  // was already correct and is left unchanged.
  const [subSnap, seekhoSnap] = await Promise.all([
    db.doc(`subscriptions/${userId}`).get().catch(() => null),
    db.collection("seekho_subscriptions").where("userId", "==", userId).get().catch(() => null),
  ]);

  const subscriptions = [
    ...(subSnap?.exists ? [{ id: subSnap.id, source: "main", ...subSnap.data() }] : []),
    ...(seekhoSnap?.docs ?? []).map((d) => ({ id: d.id, source: "seekho", ...d.data() })),
  ];

  return { subscriptions };
});
