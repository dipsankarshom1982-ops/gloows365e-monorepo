"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserSubscriptionHistory = exports.createComboPlan = exports.createCoupon = exports.approveContent = exports.removeAdmin = exports.createAdmin = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const axios_1 = require("axios");
const FIREBASE_API_KEY = "AIzaSyCpS6KjmnGAD5vCuB_swM2SWRd6-nhoiys";
exports.createAdmin = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.token?.superAdmin) {
        throw new https_1.HttpsError("permission-denied", "Only superAdmins can create admins.");
    }
    const { email, name, role } = request.data;
    if (!email || !name || !role) {
        throw new https_1.HttpsError("invalid-argument", "email, name and role are required.");
    }
    if (!["superAdmin", "admin", "moderator"].includes(role)) {
        throw new https_1.HttpsError("invalid-argument", "role must be superAdmin, admin, or moderator.");
    }
    const auth = admin.auth();
    const db = admin.firestore();
    // Create user or fetch existing
    let uid;
    try {
        const user = await auth.createUser({ email, displayName: name });
        uid = user.uid;
    }
    catch (e) {
        if (e.code === "auth/email-already-exists") {
            const existing = await auth.getUserByEmail(email);
            uid = existing.uid;
        }
        else {
            throw new https_1.HttpsError("internal", e.message);
        }
    }
    // Set custom claims
    const claims = role === "superAdmin" ? { admin: true, superAdmin: true } :
        role === "admin" ? { admin: true } :
            {};
    await auth.setCustomUserClaims(uid, claims);
    // Upsert Firestore admins doc
    const permissions = role === "superAdmin" ? ["all"] :
        role === "admin" ? ["read", "write"] :
            ["read"];
    await db.doc(`admins/${uid}`).set({
        uid,
        email,
        name,
        role,
        permissions,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: request.auth.uid,
    }, { merge: true });
    // Send password reset email so the new admin can set their own password
    await axios_1.default.post(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`, { requestType: "PASSWORD_RESET", email });
    console.log(`✅ Admin created: ${email} (${role}) uid=${uid}`);
    return { uid, email };
});
exports.removeAdmin = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.token?.superAdmin) {
        throw new https_1.HttpsError("permission-denied", "Only superAdmins can remove admins.");
    }
    const { uid } = request.data;
    if (!uid)
        throw new https_1.HttpsError("invalid-argument", "uid is required.");
    if (uid === request.auth.uid)
        throw new https_1.HttpsError("invalid-argument", "You cannot remove yourself.");
    await admin.auth().setCustomUserClaims(uid, {});
    await admin.firestore().doc(`admins/${uid}`).update({ isActive: false, role: "removed" });
    console.log(`✅ Admin removed: uid=${uid}`);
    return { uid };
});
// ── Content Moderation ─────────────────────────────────────────────────────────
exports.approveContent = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.token?.admin) {
        throw new https_1.HttpsError("permission-denied", "Admins only.");
    }
    const { collection, docId, action, reason } = request.data;
    const ALLOWED = ["stories", "skillBattles", "seekhoVideos", "knowledgeVideos", "posts"];
    if (!ALLOWED.includes(collection)) {
        throw new https_1.HttpsError("invalid-argument", `collection must be one of: ${ALLOWED.join(", ")}`);
    }
    if (!docId || !["approve", "reject", "in_review"].includes(action)) {
        throw new https_1.HttpsError("invalid-argument", "docId and action (approve|reject|in_review) are required.");
    }
    const statusMap = {
        approve: "approved",
        reject: "rejected",
        in_review: "in_review",
    };
    const update = {
        status: statusMap[action],
        approvalStatus: statusMap[action],
        reviewedBy: request.auth.uid,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (action === "reject" && reason)
        update.rejectionReason = reason;
    await admin.firestore().doc(`${collection}/${docId}`).update(update);
    console.log(`✅ ${action}d ${collection}/${docId} by ${request.auth.uid}`);
    return { success: true };
});
// ── Coupon Management ──────────────────────────────────────────────────────────
function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
exports.createCoupon = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.token?.admin) {
        throw new https_1.HttpsError("permission-denied", "Admins only.");
    }
    const { code, discountType, discountValue, maxUses, expiresAt, planIds } = request.data;
    if (!["percent", "flat"].includes(discountType)) {
        throw new https_1.HttpsError("invalid-argument", "discountType must be percent or flat.");
    }
    if (!discountValue || discountValue <= 0)
        throw new https_1.HttpsError("invalid-argument", "discountValue must be > 0.");
    if (!maxUses || maxUses <= 0)
        throw new https_1.HttpsError("invalid-argument", "maxUses must be > 0.");
    if (!expiresAt)
        throw new https_1.HttpsError("invalid-argument", "expiresAt is required.");
    const db = admin.firestore();
    const finalCode = code?.toUpperCase().trim() || generateCode();
    // Check uniqueness
    const existing = await db.collection("coupons").where("code", "==", finalCode).limit(1).get();
    if (!existing.empty) {
        throw new https_1.HttpsError("already-exists", `Coupon code "${finalCode}" already exists.`);
    }
    const ref = await db.collection("coupons").add({
        code: finalCode,
        discountType,
        discountValue,
        maxUses,
        usedCount: 0,
        expiresAt,
        isActive: true,
        planIds: planIds ?? [],
        createdBy: request.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Coupon created: ${finalCode} by ${request.auth.uid}`);
    return { couponId: ref.id, code: finalCode };
});
// ── Combo Plan ─────────────────────────────────────────────────────────────────
exports.createComboPlan = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.token?.superAdmin) {
        throw new https_1.HttpsError("permission-denied", "superAdmins only.");
    }
    const { name, description, planIds, price, durationDays, discountPercent } = request.data;
    if (!name || !planIds?.length || !price || !durationDays) {
        throw new https_1.HttpsError("invalid-argument", "name, planIds, price and durationDays are required.");
    }
    const ref = await admin.firestore().collection("subscriptionPlans").add({
        name,
        description,
        planIds,
        price,
        durationDays,
        discountPercent: discountPercent ?? 0,
        isCombo: true,
        isActive: true,
        createdBy: request.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Combo plan created: ${name} (${ref.id})`);
    return { planId: ref.id };
});
// ── User Subscription History ──────────────────────────────────────────────────
exports.getUserSubscriptionHistory = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.token?.admin) {
        throw new https_1.HttpsError("permission-denied", "Admins only.");
    }
    const { userId } = request.data;
    if (!userId)
        throw new https_1.HttpsError("invalid-argument", "userId is required.");
    const db = admin.firestore();
    const [subsSnap, seekhoSnap] = await Promise.all([
        db.collection("subscriptions").where("userId", "==", userId).get().catch(() => null),
        db.collection("seekho_subscriptions").where("userId", "==", userId).get().catch(() => null),
    ]);
    const subscriptions = [
        ...(subsSnap?.docs ?? []).map((d) => ({ id: d.id, source: "main", ...d.data() })),
        ...(seekhoSnap?.docs ?? []).map((d) => ({ id: d.id, source: "seekho", ...d.data() })),
    ];
    return { subscriptions };
});
//# sourceMappingURL=adminManagement.js.map