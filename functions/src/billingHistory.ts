// PATH: functions/src/billingHistory.ts
//
// Secure, server-side billing history for a student's own invoices
// (see ./financial/invoice.ts / ./razorpaySubscriptions.ts for how
// invoices/{invoiceId} docs get written). The client can never query the
// invoices collection directly — firestore.rules closes client reads to
// "own doc only", and there is no "list my invoices where uid == me"
// index exposed to client-side Firestore queries that would let someone
// enumerate other users' invoice ids and read them one at a time. This
// callable is the only path to a student's invoice LIST.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";

const db = admin.firestore();

const MAX_PAGE_SIZE = 20;
const DEFAULT_PAGE_SIZE = 10;

interface GetMyInvoicesPayload {
  pageSize?: number;
  /** invoiceId to start after — the last invoiceId from a previous page's
   *  results, for simple keyset pagination. */
  startAfterInvoiceId?: string;
}

export const getMyInvoices = functionsV1
  .runWith({ timeoutSeconds: 20, memory: "128MB" })
  .https.onCall(async (data: GetMyInvoicesPayload, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }
    // Always the caller's own uid — never accepted from the client
    // payload, so nobody can ask for another user's billing history.
    const uid = context.auth.uid;

    const pageSize = Math.min(Math.max(1, Number(data?.pageSize) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

    let query: FirebaseFirestore.Query = db
      .collection("invoices")
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(pageSize);

    const startAfterInvoiceId = (data?.startAfterInvoiceId ?? "").trim();
    if (startAfterInvoiceId) {
      const cursorSnap = await db.doc(`invoices/${startAfterInvoiceId}`).get();
      // Ownership check on the cursor doc itself — a client passing a
      // stranger's invoiceId as a cursor must not be able to use it to
      // probe pagination state; if it's not theirs (or doesn't exist),
      // fail closed rather than silently ignoring the cursor.
      if (!cursorSnap.exists || cursorSnap.data()?.["uid"] !== uid) {
        throw new functionsV1.https.HttpsError("invalid-argument", "Invalid pagination cursor");
      }
      // Pass the cursor doc's own createdAt value (matching the single
      // orderBy field above), not the snapshot itself — a plain field
      // value is unambiguous and keeps this query correct however many
      // orderBy() calls it ends up with.
      query = query.startAfter(cursorSnap.data()!["createdAt"]);
    }

    const snap = await query.get();
    const invoices = snap.docs.map((d) => {
      const inv = d.data();
      return {
        invoiceId: inv["invoiceId"],
        source: inv["source"],
        status: inv["status"],
        planId: inv["planId"] ?? null,
        planName: inv["planName"] ?? null,
        currency: inv["currency"] ?? "INR",
        totalAmountPaise: inv["totalAmountPaise"] ?? null,
        billingPeriodStart: inv["billingPeriodStart"] ?? null,
        billingPeriodEnd: inv["billingPeriodEnd"] ?? null,
        invoiceUrl: inv["invoiceUrl"] ?? null,
        shortUrl: inv["shortUrl"] ?? null,
        issuedAt: inv["issuedAt"] ?? null,
        paidAt: inv["paidAt"] ?? null,
      };
    });

    return {
      invoices,
      hasMore: invoices.length === pageSize,
      nextCursor: invoices.length > 0 ? invoices[invoices.length - 1].invoiceId : null,
    };
  });
