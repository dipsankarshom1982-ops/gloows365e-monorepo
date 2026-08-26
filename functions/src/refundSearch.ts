// PATH: functions/src/refundSearch.ts
//
// Read-only admin lookup for the Refund Management UI (launch audit, Task 7
// follow-up). processRefund requires a razorpayPaymentId, but the four
// order collections (aiGuruSubscriptionOrders, seekho_subscription_orders,
// aiGuruCreditOrders, tutorCreditOrders) are entirely closed to client
// reads — `allow read, write: if false` — by design, same as every other
// payment-processing collection in firestore.rules. Before this function,
// an admin had no way to find a payment's razorpayPaymentId without
// already having it from an external source (Razorpay dashboard, a
// support ticket). This does NOT change that access model: it's a new,
// separate, admin-gated, read-only Cloud Function — the order collections
// are still unreadable directly, and processRefund/resolveRefundReconciliation
// in refunds.ts are completely untouched.
//
// Query strategy — deliberately simple for a V1 admin tool, not a
// reporting dashboard:
//   - razorpayOrderId given → direct doc().get() (it's literally the doc ID).
//   - razorpayPaymentId given → the exact same where()+limit(1) query
//     processRefund itself runs — if this returns nothing, processRefund
//     would fail too, so this doubles as a pre-flight check.
//   - uid/email given → single equality where() on the flow's user field
//     (auto-indexed by Firestore, no composite index needed) + orderBy
//     createdAt desc, capped at 100 docs; status/date-range filters (if
//     also given) are applied in-memory rather than as additional Firestore
//     where() clauses, since a single user's order count per flow is always
//     small. Avoids needing a uid+status+createdAt composite index.
//   - Neither given → general recent-orders browse: orderBy createdAt desc,
//     capped at 200 docs, with status/date-range filtered in-memory. Fine
//     at this app's current order volumes; if that ever stops being true,
//     the fix is adding real composite indexes and pushing status/date
//     into the Firestore query itself, not changing this function's shape.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { FLOW_CONFIG, Flow } from "./refunds";

const db = admin.firestore();

interface SearchRequest {
  flow?: Flow;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  uid?: string;
  email?: string;
  status?: "created" | "paid" | "refunded";
  startDate?: string; // ISO date, inclusive, compared against createdAt
  endDate?: string;   // ISO date, inclusive, compared against createdAt
}

interface SearchResultRow {
  id: string; // razorpayOrderId (== the doc ID for every one of these collections)
  uid: string;
  userEmail: string | null;
  status: string;
  amountPaise: number;
  razorpayPaymentId: string | null;
  createdAt: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  // Flow-specific extras — only the fields relevant to the given flow are
  // populated, the rest stay undefined.
  planId?: string;
  cycle?: string;
  packId?: string;
  credits?: number;
}

const MAX_RESULTS_IDENTIFIED = 100; // when searching by a specific uid/email
const MAX_RESULTS_BROWSE = 200;     // general recent-orders browse

function toIso(v: unknown): string | null {
  if (v && typeof (v as FirebaseFirestore.Timestamp).toDate === "function") {
    return (v as FirebaseFirestore.Timestamp).toDate().toISOString();
  }
  return null;
}

function toRow(doc: FirebaseFirestore.QueryDocumentSnapshot, userField: "uid" | "userId"): SearchResultRow {
  const d = doc.data();
  return {
    id: doc.id,
    uid: String(d[userField] ?? ""),
    userEmail: null, // resolved in bulk after filtering, see below
    status: String(d.status ?? "unknown"),
    amountPaise: Number(d.amountPaise) || 0,
    razorpayPaymentId: d.razorpayPaymentId ?? null,
    createdAt: toIso(d.createdAt),
    paidAt: toIso(d.paidAt),
    refundedAt: toIso(d.refundedAt),
    planId: d.planId,
    cycle: d.cycle,
    packId: d.packId,
    credits: d.credits,
  };
}

export const searchPaymentOrders = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "256MB" })
  .https.onCall(async (data: SearchRequest, context) => {
    if (!context.auth?.token?.admin) {
      throw new functionsV1.https.HttpsError("permission-denied", "Admins only");
    }
    const { flow, razorpayOrderId, razorpayPaymentId, status, startDate, endDate } = data ?? {};
    let { uid } = data ?? {};
    const email = data?.email?.trim();

    if (!flow || !(flow in FLOW_CONFIG)) {
      throw new functionsV1.https.HttpsError("invalid-argument", `flow must be one of: ${Object.keys(FLOW_CONFIG).join(", ")}`);
    }
    const config = FLOW_CONFIG[flow];
    const col = db.collection(config.orderCollection);

    // ── Direct lookups — cheapest, most specific paths first ──────────────
    if (razorpayOrderId?.trim()) {
      const snap = await col.doc(razorpayOrderId.trim()).get();
      return { rows: snap.exists ? [toRow(snap as FirebaseFirestore.QueryDocumentSnapshot, config.userField)] : [], truncated: false };
    }
    if (razorpayPaymentId?.trim()) {
      const q = await col.where("razorpayPaymentId", "==", razorpayPaymentId.trim()).limit(1).get();
      return { rows: q.docs.map((d) => toRow(d, config.userField)), truncated: false };
    }

    // ── Resolve email → uid via Firebase Auth (authoritative, already
    // indexed) rather than scanning Firestore for a matching email field ──
    if (!uid && email) {
      try {
        const user = await admin.auth().getUserByEmail(email);
        uid = user.uid;
      } catch {
        return { rows: [], truncated: false }; // no such Auth user — nothing to find
      }
    }

    // ── Identified (uid) vs. general browse ────────────────────────────
    let snap: FirebaseFirestore.QuerySnapshot;
    let capped: boolean;
    if (uid?.trim()) {
      const q = await col.where(config.userField, "==", uid.trim())
        .orderBy("createdAt", "desc")
        .limit(MAX_RESULTS_IDENTIFIED)
        .get();
      snap = q;
      capped = q.size === MAX_RESULTS_IDENTIFIED;
    } else {
      const q = await col.orderBy("createdAt", "desc").limit(MAX_RESULTS_BROWSE).get();
      snap = q;
      capped = q.size === MAX_RESULTS_BROWSE;
    }

    let rows = snap.docs.map((d) => toRow(d, config.userField));

    // In-memory filters — see header comment on why these aren't pushed
    // into the Firestore query itself.
    if (status) rows = rows.filter((r) => r.status === status);
    if (startDate) {
      const start = new Date(startDate).getTime();
      rows = rows.filter((r) => r.createdAt && new Date(r.createdAt).getTime() >= start);
    }
    if (endDate) {
      const end = new Date(endDate).getTime();
      rows = rows.filter((r) => r.createdAt && new Date(r.createdAt).getTime() <= end);
    }

    // ── Resolve emails for display — dedupe uids first, admin tool scale
    // only (never called from anywhere hot-path) ───────────────────────
    const uniqueUids = [...new Set(rows.map((r) => r.uid).filter(Boolean))];
    const emailByUid = new Map<string, string>();
    await Promise.all(uniqueUids.map(async (u) => {
      try {
        const authUser = await admin.auth().getUser(u);
        if (authUser.email) emailByUid.set(u, authUser.email);
      } catch {
        // Deleted/unknown Auth user — leave email blank, uid is still shown.
      }
    }));
    rows = rows.map((r) => ({ ...r, userEmail: emailByUid.get(r.uid) ?? null }));

    return { rows, truncated: capped };
  });
