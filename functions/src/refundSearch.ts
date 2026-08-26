// PATH: functions/src/refundSearch.ts
//
// Read-only admin lookups backing the Payment Management admin section
// (launch audit, Task 7 follow-up — supersedes the earlier standalone
// "Find Payment" panel, same underlying function extended). The four order
// collections (aiGuruSubscriptionOrders, seekho_subscription_orders,
// aiGuruCreditOrders, tutorCreditOrders) are entirely closed to client
// reads — `allow read, write: if false` — by design, same as every other
// payment-processing collection in firestore.rules. Before this file, an
// admin had no way to find a payment's razorpayPaymentId without already
// having it from an external source. This does NOT change that access
// model: everything here is a separate, superAdmin-gated, read-only Cloud
// Function — the order collections are still unreadable directly, and
// processRefund/resolveRefundReconciliation in refunds.ts are completely
// untouched (reused, never rewritten).
//
// Auth is deliberately stricter than processRefund/resolveRefundReconciliation
// (which check the `admin` claim, matching every other real-money action in
// this codebase — see permissions.ts's comment on why that's an accepted,
// documented gap, not something this file silently "fixes"). Everything
// here checks `superAdmin` specifically, per Payment Management's own
// explicit defense-in-depth requirement — a genuine strengthening for this
// new surface, not a change to the existing refund mutation functions.
//
// Query strategy — deliberately simple for a V1 admin tool, not a
// reporting dashboard:
//   - razorpayOrderId given -> direct doc().get() (it's literally the doc ID).
//   - razorpayPaymentId given -> the exact same where()+limit(1) query
//     processRefund itself runs -- if this returns nothing, processRefund
//     would fail too, so this doubles as a pre-flight check.
//   - studentId/email/name given -> resolved to a uid (or a short list of
//     candidate uids for a name-prefix match) via students/{uid} or
//     Firebase Auth -- never a Firestore scan for a matching field.
//   - uid given (directly, or resolved above) -> single equality where() on
//     the flow's user field (auto-indexed by Firestore, no composite index
//     needed) + orderBy createdAt desc, cursor-paginated.
//   - Nothing identifying given -> general recent-orders browse: orderBy
//     createdAt desc, cursor-paginated, status/date-range/amount-range/
//     name filtered in-memory rather than as additional Firestore where()
//     clauses. Fine
//     at this app's current order volumes; if that ever stops being true,
//     the fix is adding real composite indexes and pushing filters into
//     the Firestore query itself, not changing this function's shape.
//   - Name-prefix matching (students collection) fetches a small ordered
//     window via orderBy("name").startAt(prefix) and filters the results
//     in-memory for an actual case-insensitive startsWith — simpler and
//     more robust than Firestore's endAt(prefix + highSentinel) range
//     trick, at the cost of only searching the first alphabetical window
//     after the prefix rather than a tightly bounded range. Fine at V1
//     student-count scale.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { FLOW_CONFIG, Flow } from "./refunds";

const db = admin.firestore();

function requireSuperAdmin(context: functionsV1.https.CallableContext) {
  if (!context.auth?.token?.superAdmin) {
    throw new functionsV1.https.HttpsError("permission-denied", "Super admins only");
  }
}

// Wraps a handler body so an unexpected exception reaches the admin panel
// as a real, readable message instead of the generic "internal" the
// callable-functions client shows for an unhandled throw -- this surface
// previously returned exactly that opaque error with no way to diagnose it
// further, so making the real cause visible here is deliberate.
async function guarded<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (err instanceof functionsV1.https.HttpsError) throw err;
    console.error(`${label} unexpected error:`, err?.message, err?.stack);
    throw new functionsV1.https.HttpsError("internal", `${label} failed: ${err?.message ?? String(err)}`);
  }
}

// -- Shared: resolve a uid's display info (Student ID, name, email) --------
// students/{uid} is the primary source (has all three, and studentId is the
// existing human-readable ID system -- see functions/src/studentId.ts).
// Falls back to Firebase Auth's email only for a uid with no students doc
// (e.g. a tutor buying tutor credits, whose profile lives in tutors/{uid}
// instead) -- a documented V1 simplification, not a claim that every payer
// is a student.
interface StudentDisplay { studentId: string | null; name: string | null; email: string | null }

async function resolveStudentDisplay(uids: string[]): Promise<Map<string, StudentDisplay>> {
  const out = new Map<string, StudentDisplay>();
  await Promise.all(uids.map(async (uid) => {
    try {
      const snap = await db.doc(`students/${uid}`).get();
      if (snap.exists) {
        const d = snap.data()!;
        out.set(uid, { studentId: d.studentId ?? null, name: d.name ?? null, email: d.email ?? null });
        return;
      }
    } catch { /* fall through to Auth */ }
    try {
      const authUser = await admin.auth().getUser(uid);
      out.set(uid, { studentId: null, name: authUser.displayName ?? null, email: authUser.email ?? null });
    } catch {
      out.set(uid, { studentId: null, name: null, email: null });
    }
  }));
  return out;
}

const STUDENT_ID_RE = /^GLS\d{4,}$/i; // matches Students.tsx's own pattern

// ===========================================================================
// searchPaymentOrders -- list/search, backs the main Payment Management table
// ===========================================================================

interface SearchRequest {
  flow?: Flow;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  uid?: string;
  studentId?: string;
  email?: string;
  name?: string;
  status?: "created" | "paid" | "refunded";
  startDate?: string; // ISO date, inclusive, compared against createdAt
  endDate?: string;   // ISO date, inclusive, compared against createdAt
  minAmountPaise?: number; // inclusive
  maxAmountPaise?: number; // inclusive
  cursor?: string;    // ISO createdAt of the last row from a previous page
  pageSize?: number;  // default 25, capped at 100
}

interface SearchResultRow {
  id: string; // razorpayOrderId (== the doc ID for every one of these collections)
  uid: string;
  studentId: string | null;
  studentName: string | null;
  studentEmail: string | null;
  status: string;
  amountPaise: number;
  razorpayPaymentId: string | null;
  createdAt: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  planId?: string;
  cycle?: string;
  packId?: string;
  credits?: number;
}

const MAX_RESULTS_IDENTIFIED = 100; // when searching by a specific uid
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

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
    studentId: null, studentName: null, studentEmail: null, // resolved in bulk below
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
    requireSuperAdmin(context);
    return guarded("searchPaymentOrders", async () => {
      const { flow, razorpayOrderId, razorpayPaymentId, status, startDate, endDate, cursor } = data ?? {};
      let { uid } = data ?? {};
      const email = data?.email?.trim();
      const studentId = data?.studentId?.trim().toUpperCase();
      const name = data?.name?.trim();
      const pageSize = Math.min(Math.max(data?.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

      if (!flow || !(flow in FLOW_CONFIG)) {
        throw new functionsV1.https.HttpsError("invalid-argument", `flow must be one of: ${Object.keys(FLOW_CONFIG).join(", ")}`);
      }
      const config = FLOW_CONFIG[flow];
      const col = db.collection(config.orderCollection);

      // -- Direct lookups -- cheapest, most specific paths first -----------
      if (razorpayOrderId?.trim()) {
        const snap = await col.doc(razorpayOrderId.trim()).get();
        const rows = snap.exists ? [toRow(snap as FirebaseFirestore.QueryDocumentSnapshot, config.userField)] : [];
        await attachStudentDisplay(rows);
        return { rows, nextCursor: null };
      }
      if (razorpayPaymentId?.trim()) {
        const q = await col.where("razorpayPaymentId", "==", razorpayPaymentId.trim()).limit(1).get();
        const rows = q.docs.map((d) => toRow(d, config.userField));
        await attachStudentDisplay(rows);
        return { rows, nextCursor: null };
      }

      // -- Resolve studentId -> uid via students/{uid} (the existing
      // human-readable ID system, not a new one) ---------------------------
      if (!uid && studentId && STUDENT_ID_RE.test(studentId)) {
        const q = await db.collection("students").where("studentId", "==", studentId).limit(1).get();
        if (q.empty) return { rows: [], nextCursor: null };
        uid = q.docs[0].id;
      }

      // -- Resolve email -> uid via Firebase Auth (authoritative, already
      // indexed) rather than scanning Firestore for a matching email field -
      if (!uid && email) {
        try {
          const user = await admin.auth().getUserByEmail(email);
          uid = user.uid;
        } catch {
          return { rows: [], nextCursor: null }; // no such Auth user -- nothing to find
        }
      }

      // -- Resolve a name prefix -> candidate uids (students/{uid} only --
      // same V1 scope as resolveStudentDisplay's fallback note above; see
      // this file's header comment on why this uses startAt() + an
      // in-memory startsWith rather than a Firestore endAt() range bound).
      //
      // KNOWN LIMITATION: Firestore's orderBy/startAt ordering is
      // case-sensitive, and there's no normalized-lowercase field on
      // students/{uid} to query against instead (that would need a schema
      // addition + backfill, out of scope for V1). Names are stored Title
      // Case by every signup flow ("Asha Verma"), so normalizing the
      // search term to Title Case before the Firestore bound handles the
      // overwhelmingly common case (any casing the admin types); a name
      // stored in genuinely unusual casing could still be missed. --------
      let nameUidFilter: Set<string> | null = null;
      if (!uid && name) {
        const lowerName = name.toLowerCase();
        const titleCased = name.replace(/\b\w/g, (c) => c.toUpperCase());
        const q = await db.collection("students")
          .orderBy("name")
          .startAt(titleCased)
          .limit(25)
          .get();
        nameUidFilter = new Set(
          q.docs
            .filter((d) => String(d.data().name ?? "").toLowerCase().startsWith(lowerName))
            .map((d) => d.id)
        );
        if (nameUidFilter.size === 0) return { rows: [], nextCursor: null };
      }

      // -- Identified (uid) vs. general browse -- both cursor-paginated ----
      let baseQuery: FirebaseFirestore.Query = uid?.trim()
        ? col.where(config.userField, "==", uid.trim()).orderBy("createdAt", "desc")
        : col.orderBy("createdAt", "desc");
      if (cursor) {
        const cursorDate = new Date(cursor);
        if (!isNaN(cursorDate.getTime())) {
          baseQuery = baseQuery.startAfter(admin.firestore.Timestamp.fromDate(cursorDate));
        }
      }
      const limitN = uid?.trim() ? Math.min(pageSize, MAX_RESULTS_IDENTIFIED) : pageSize;
      const snap = await baseQuery.limit(limitN).get();

      let rows = snap.docs.map((d) => toRow(d, config.userField));

      // In-memory filters -- see header comment on why these aren't pushed
      // into the Firestore query itself.
      if (nameUidFilter) rows = rows.filter((r) => nameUidFilter!.has(r.uid));
      if (status) rows = rows.filter((r) => r.status === status);
      if (startDate) {
        const start = new Date(startDate).getTime();
        rows = rows.filter((r) => r.createdAt && new Date(r.createdAt).getTime() >= start);
      }
      if (endDate) {
        const end = new Date(endDate).getTime();
        rows = rows.filter((r) => r.createdAt && new Date(r.createdAt).getTime() <= end);
      }
      if (data?.minAmountPaise !== undefined) rows = rows.filter((r) => r.amountPaise >= data.minAmountPaise!);
      if (data?.maxAmountPaise !== undefined) rows = rows.filter((r) => r.amountPaise <= data.maxAmountPaise!);

      await attachStudentDisplay(rows);

      const nextCursor = snap.docs.length === limitN ? rows[rows.length - 1]?.createdAt ?? null : null;
      return { rows, nextCursor };
    });
  });

async function attachStudentDisplay(rows: SearchResultRow[]): Promise<void> {
  const uniqueUids = [...new Set(rows.map((r) => r.uid).filter(Boolean))];
  const display = await resolveStudentDisplay(uniqueUids);
  for (const r of rows) {
    const d = display.get(r.uid);
    r.studentId = d?.studentId ?? null;
    r.studentName = d?.name ?? null;
    r.studentEmail = d?.email ?? null;
  }
}

// ===========================================================================
// getPaymentDetail -- everything the Payment Detail page needs, in one call
// ===========================================================================

interface DetailRequest {
  flow?: Flow;
  orderId?: string; // == razorpayOrderId == the order doc's ID
}

export const getPaymentDetail = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "256MB" })
  .https.onCall(async (data: DetailRequest, context) => {
    requireSuperAdmin(context);
    return guarded("getPaymentDetail", async () => {
      const { flow, orderId } = data ?? {};
      if (!flow || !(flow in FLOW_CONFIG)) {
        throw new functionsV1.https.HttpsError("invalid-argument", `flow must be one of: ${Object.keys(FLOW_CONFIG).join(", ")}`);
      }
      if (!orderId?.trim()) {
        throw new functionsV1.https.HttpsError("invalid-argument", "orderId is required");
      }
      const config = FLOW_CONFIG[flow];

      const orderSnap = await db.doc(`${config.orderCollection}/${orderId.trim()}`).get();
      if (!orderSnap.exists) {
        throw new functionsV1.https.HttpsError("not-found", `No ${flow} order ${orderId} found`);
      }
      const order = orderSnap.data()!;
      const uid = String(order[config.userField] ?? "");

      const [studentSnap, entitlementSnap, refundSnap] = await Promise.all([
        db.doc(`students/${uid}`).get(),
        uid ? db.doc(`${config.entitlementCollection}/${uid}`).get() : Promise.resolve(null),
        order.razorpayPaymentId ? db.doc(`refunds/${flow}_${order.razorpayPaymentId}`).get() : Promise.resolve(null),
      ]);

      let student: { studentId: string | null; name: string | null; email: string | null; phone: string | null; profileType: string | null } | null = null;
      if (studentSnap.exists) {
        const d = studentSnap.data()!;
        student = {
          studentId: d.studentId ?? null, name: d.name ?? null, email: d.email ?? null,
          phone: d.phone ?? null, profileType: d.profileType ?? "student",
        };
      } else {
        try {
          const authUser = await admin.auth().getUser(uid);
          student = { studentId: null, name: authUser.displayName ?? null, email: authUser.email ?? null, phone: null, profileType: null };
        } catch {
          student = { studentId: null, name: null, email: null, phone: null, profileType: null };
        }
      }

      // "Current entitlement" -- and whether it's actually still the one
      // this specific order granted, since a later purchase can have
      // superseded it (see refunds.ts's resolveEntitlementAction, same
      // distinction). entitlementBelongsToThisOrder is null when the flow's
      // entitlement doesn't track an originating order at all (the two
      // credit-pool flows -- a shared balance has no single owning order).
      let entitlement: Record<string, unknown> | null = null;
      let entitlementBelongsToThisOrder: boolean | null = null;
      if (entitlementSnap && entitlementSnap.exists) {
        const e = entitlementSnap.data()!;
        entitlement = Object.fromEntries(
          Object.entries(e).map(([k, v]) => [k, toIso(v) ?? v])
        );
        if (config.kind === "subscription") {
          entitlementBelongsToThisOrder = e.razorpayOrderId === orderSnap.id;
        }
      }

      const refund = refundSnap && refundSnap.exists
        ? Object.fromEntries(Object.entries(refundSnap.data()!).map(([k, v]) => [k, toIso(v) ?? v]))
        : null;

      return {
        order: {
          id: orderSnap.id,
          flow,
          uid,
          status: order.status,
          amountPaise: Number(order.amountPaise) || 0,
          razorpayOrderId: orderSnap.id,
          razorpayPaymentId: order.razorpayPaymentId ?? null,
          createdAt: toIso(order.createdAt),
          paidAt: toIso(order.paidAt),
          refundedAt: toIso(order.refundedAt),
          planId: order.planId, cycle: order.cycle, selectedClass: order.selectedClass, billingCycle: order.billingCycle,
          packId: order.packId, credits: order.credits,
        },
        student,
        entitlement,
        entitlementBelongsToThisOrder,
        refund,
      };
    });
  });
