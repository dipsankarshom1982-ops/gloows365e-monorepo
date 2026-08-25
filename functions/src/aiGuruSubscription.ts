import axios from "axios";
import * as crypto from "crypto";
import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { onRequest } from "firebase-functions/v2/https";

const db = admin.firestore();

// ── Phase 1: Create Razorpay order ────────────────────────────────────────────

interface CreateOrderPayload {
  planId: string;
  cycle: "monthly" | "annual";
  // amountPaise is NOT accepted from the client anymore — see
  // resolvePlanPrice below. Kept out of this type deliberately so nothing
  // reintroduces the trust mistake by accident.
}

// ── Phase 2: Verify payment + write subscription ──────────────────────────────

interface VerifyPaymentPayload {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}

type RequestPayload = CreateOrderPayload | VerifyPaymentPayload;

function isVerifyPayload(data: RequestPayload): data is VerifyPaymentPayload {
  return "razorpayPaymentId" in data && typeof (data as VerifyPaymentPayload).razorpayPaymentId === "string";
}

// Resolves the real price of a plan+cycle server-side from
// subscriptionPlans/{planId} — the client never gets to state its own
// price. Mirrors aiGuruCreditOrders' "resolve pack price from Firestore,
// never trust the client" rule (see aiGuruCredits.ts's header comment).
async function resolvePlanPrice(planId: string, cycle: "monthly" | "annual") {
  const planSnap = await db.doc(`subscriptionPlans/${planId}`).get();
  if (!planSnap.exists) {
    throw new functionsV1.https.HttpsError("not-found", "Subscription plan not found");
  }
  const plan = planSnap.data()!;
  if (plan.isActive === false) {
    throw new functionsV1.https.HttpsError("failed-precondition", "This plan is no longer available");
  }
  const priceRupees = cycle === "annual" ? Number(plan.annualPrice) : Number(plan.monthlyPrice);
  const amountPaise = Math.round(priceRupees * 100);
  if (!amountPaise || amountPaise < 100) {
    throw new functionsV1.https.HttpsError("failed-precondition", "Plan is misconfigured");
  }
  return amountPaise;
}

export const aiGuruCreateSubscription = functionsV1
  .runWith({
    timeoutSeconds: 60,
    memory: "128MB",
    secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
  })
  .https.onCall(async (data: RequestPayload, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }

    const uid = context.auth.uid;
    const keyId     = process.env["RAZORPAY_KEY_ID"]     ?? "";
    const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";

    // ── Phase 2: Verify payment and write subscription ────────────────────────
    // planId/cycle come from OUR OWN aiGuruSubscriptionOrders/{orderId} doc
    // (written in Phase 1 below from a server-resolved price), never from
    // this call's payload — same rule aiGuruCreditPaymentSuccess follows.
    // Not currently called by any client (both apps verify via the HTTP
    // aiGuruPaymentSuccess endpoint below instead), but a callable function
    // is reachable by anyone with an ID token regardless of what the app UI
    // does, so it gets the same trust model.
    if (isVerifyPayload(data)) {
      const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = data;

      const expectedSig = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      if (expectedSig !== razorpaySignature) {
        throw new functionsV1.https.HttpsError("permission-denied", "Payment verification failed");
      }

      const orderRef = db.doc(`aiGuruSubscriptionOrders/${razorpayOrderId}`);
      const result = await db.runTransaction(async (tx) => {
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists) {
          throw new functionsV1.https.HttpsError("not-found", "Order not found");
        }
        const order = orderSnap.data()!;
        if (order.uid !== uid) {
          throw new functionsV1.https.HttpsError("permission-denied", "This order doesn't belong to you");
        }
        if (order.status === "paid") {
          return { alreadyActivated: true as const, planId: order.planId, cycle: order.cycle };
        }

        const durationMs = order.cycle === "annual"
          ? 365 * 24 * 3600 * 1000
          : 30  * 24 * 3600 * 1000;
        const now = admin.firestore.FieldValue.serverTimestamp();

        tx.set(db.doc(`subscriptions/${uid}`), {
          planId:   order.planId,
          cycle:    order.cycle,
          status:   "active",
          endDate:  admin.firestore.Timestamp.fromMillis(Date.now() + durationMs),
          razorpayPaymentId,
          razorpayOrderId,
          createdAt: now,
          updatedAt: now,
        });
        tx.update(orderRef, { status: "paid", razorpayPaymentId, paidAt: now });

        return { alreadyActivated: false as const, planId: order.planId, cycle: order.cycle };
      });

      console.log(`✅ AI Guru subscription created: uid=${uid} plan=${result.planId} cycle=${result.cycle}`);
      return { success: true, planId: result.planId, cycle: result.cycle };
    }

    // ── Phase 1: Create Razorpay order ────────────────────────────────────────
    // Price is resolved server-side from subscriptionPlans/{planId} — the
    // client only says WHICH plan/cycle it wants, never what it costs.
    const { planId, cycle } = data as CreateOrderPayload;

    if (!planId || (cycle !== "monthly" && cycle !== "annual")) {
      throw new functionsV1.https.HttpsError("invalid-argument", "planId and a valid cycle are required");
    }
    if (!keyId || !keySecret) {
      console.error("Razorpay secrets missing — keyId:", !!keyId, "keySecret:", !!keySecret);
      throw new functionsV1.https.HttpsError("failed-precondition", "Razorpay not configured — secrets missing");
    }

    const amountPaise = await resolvePlanPrice(planId, cycle);

    try {
      const response = await axios.post(
        "https://api.razorpay.com/v1/orders",
        {
          amount:   amountPaise,
          currency: "INR",
          receipt:  `ag_${uid.slice(0, 16)}_${Date.now().toString().slice(-8)}`,
        },
        {
          auth: { username: keyId, password: keySecret },
          timeout: 10_000,
        }
      );

      const razorpayOrderId: string = response.data.id;

      // Written from the resolved plan price, not from anything the client
      // sent — this is what both verify paths trust from here on.
      await db.doc(`aiGuruSubscriptionOrders/${razorpayOrderId}`).set({
        uid,
        planId,
        cycle,
        amountPaise,
        status:    "created",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ AI Guru Razorpay order created: ${razorpayOrderId} for uid=${uid} plan=${planId} cycle=${cycle} amountPaise=${amountPaise}`);
      return { razorpayOrderId };
    } catch (err: any) {
      const rzpError = err?.response?.data?.error;
      const detail   = rzpError
        ? `${rzpError.code}: ${rzpError.description}`
        : (err?.message ?? "Unknown error");
      console.error("Razorpay order creation failed:", detail, err?.response?.data);
      throw new functionsV1.https.HttpsError("internal", `Razorpay error: ${detail}`);
    }
  });

// ── Serve Razorpay checkout HTML page ─────────────────────────────────────────
// Called by the app — opens in Chrome — no data: URI needed.
//
// `purpose` distinguishes what this checkout is paying for — defaults to
// "sub" so existing subscription-checkout links behave exactly as before.
// "credits" posts to aiGuruCreditPaymentSuccess instead of
// aiGuruPaymentSuccess on success; the credit endpoint only needs the three
// Razorpay fields (it resolves uid/packId/credits server-side from the
// order doc written at aiGuruCreateCreditOrder time — see aiGuruCredits.ts
// for why that matters).
export const aiGuruCheckoutPage = onRequest(
  { timeoutSeconds: 10, memory: "128MiB" },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");

    const { key, order_id, amount, plan, email, uid, planId, cycle, purpose } = req.query as Record<string, string>;
    const isCredits = purpose === "credits";
    // ShikshaHub Phase 4 — reuses this same generic checkout page for tutor
    // credits rather than duplicating it, same extension pattern "credits"
    // itself used alongside the original "sub" purpose (see this
    // function's header comment).
    const isTutorCredits = purpose === "tutorcredits";
    const cfBase = `https://us-central1-${process.env.GCLOUD_PROJECT ?? "gloows-03b6sz"}.cloudfunctions.net`;
    const successEndpoint = isCredits
      ? "aiGuruCreditPaymentSuccess"
      : isTutorCredits
        ? "tutorCreditPaymentSuccess"
        : "aiGuruPaymentSuccess";

    // Every value below came from a URL query string a user could edit —
    // JSON.stringify (not raw interpolation) is what keeps an edited query
    // param from breaking out of the string literal into executable script.
    const j = (v: unknown) => JSON.stringify(String(v ?? ""));
    // amount must stay a numeric literal (Razorpay's own options object
    // expects a number, not a string) — validated via Number(), not
    // interpolated raw, so a non-numeric query param can't inject anything.
    const amt = Number(amount) || 0;
    const subLabel = isCredits ? "AI Guru Credits" : isTutorCredits ? "Instant Help Credits" : "Premium Subscription";
    // Both credits flavors' verify endpoints resolve uid/packId/credits
    // themselves from their own order doc (see aiGuruCredits.ts /
    // tutorCredits.ts) — only the three Razorpay fields need to travel
    // from this page back to the server.
    const verifyBodyExtra = (isCredits || isTutorCredits)
      ? ""
      : `uid: ${j(uid)}, planId: ${j(planId)}, cycle: ${j(cycle)},`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GLOOWS365E — Payment</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0f172a;display:flex;align-items:center;justify-content:center;
         min-height:100vh;font-family:sans-serif;padding:20px}
    .box{text-align:center;max-width:320px;width:100%}
    .logo{font-size:32px;font-weight:900;margin-bottom:6px}
    .logo span{color:#a5b4fc}
    .sub{color:#64748b;font-size:14px;margin-bottom:24px}
    .pill{display:inline-block;background:linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899);
          border-radius:8px;padding:3px 10px;color:#fff;font-weight:900;font-size:18px;margin:0 4px}
    .msg{color:#94a3b8;font-size:14px;margin-top:12px;line-height:1.5}
    .btn{margin-top:20px;padding:14px 32px;background:#6366f1;color:#fff;border:none;
         border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;width:100%}
    .success{color:#6ee7b7;font-size:18px;font-weight:700;margin-top:8px}
    .fail{color:#f87171;font-size:16px;margin-top:8px}
  </style>
</head>
<body>
  <div class="box">
    <div class="logo">Gl<span>oows</span><span class="pill">365</span>E</div>
    <div class="sub">${subLabel}</div>
    <div id="msg" class="msg">Opening payment…</div>
    <button class="btn" id="payBtn" onclick="openRzp()">Pay ₹${Math.round(amt / 100)}</button>
  </div>
<script>
var paid = false;
function openRzp() {
  document.getElementById("payBtn").disabled = true;
  document.getElementById("msg").innerText = "Loading Razorpay…";
  var options = {
    key: ${j(key)},
    order_id: ${j(order_id)},
    amount: ${amt},
    currency: "INR",
    name: "GLOOWS365E",
    description: ${j(plan)},
    prefill: { email: ${j(email)} },
    theme: { color: "#6366f1" },
    handler: function(r) {
      paid = true;
      document.getElementById("msg").innerHTML = '<div class="success">✅ Payment Successful!<br>Return to the app.</div>';
      document.getElementById("payBtn").style.display = "none";
      fetch(${j(`${cfBase}/${successEndpoint}`)}, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ${verifyBodyExtra}
          razorpay_payment_id: r.razorpay_payment_id,
          razorpay_order_id: r.razorpay_order_id,
          razorpay_signature: r.razorpay_signature
        })
      }).then(function(res){ return res.json(); })
        .then(function(data){ console.log("Verified:", data); })
        .catch(function(e){ console.error("Verify error:", e); });
    },
    modal: {
      ondismiss: function() {
        if (!paid) {
          document.getElementById("msg").innerHTML = '<div class="fail">Payment cancelled.<br>Close this tab to go back.</div>';
          document.getElementById("payBtn").disabled = false;
          document.getElementById("payBtn").innerText = "Try Again";
        }
      }
    }
  };
  var rzp = new Razorpay(options);
  rzp.on("payment.failed", function(r) {
    document.getElementById("msg").innerHTML = '<div class="fail">❌ ' + (r.error.description || "Payment failed") + '</div>';
    document.getElementById("payBtn").disabled = false;
    document.getElementById("payBtn").innerText = "Try Again";
  });
  rzp.open();
}
// Auto-open on load
window.onload = function(){ setTimeout(openRzp, 500); };
</script>
</body>
</html>`;

    res.set("Content-Type", "text/html");
    res.status(200).send(html);
  }
);

// ── HTTP endpoint called from browser after payment success ───────────────────
export const aiGuruPaymentSuccess = onRequest(
  {
    timeoutSeconds: 30,
    memory: "128MiB",
    secrets: ["RAZORPAY_KEY_SECRET"],
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST")   { res.status(405).send("Method not allowed"); return; }

    try {
      const {
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
      } = req.body;

      // Note: the checkout page still sends uid/planId/cycle in the body
      // for backward compatibility, but they're deliberately ignored below
      // — uid/planId/cycle come from OUR OWN aiGuruSubscriptionOrders/{id}
      // doc (written server-side in aiGuruCreateSubscription's Phase 1
      // from a resolved plan price), never from the client request. Same
      // trust model aiGuruCreditPaymentSuccess already follows.
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";

      // Verify signature
      const expectedSig = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (expectedSig !== razorpay_signature) {
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      const orderRef = db.doc(`aiGuruSubscriptionOrders/${razorpay_order_id}`);

      const result = await db.runTransaction(async (tx) => {
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists) {
          return { notFound: true as const };
        }
        const order = orderSnap.data()!;
        if (order.status === "paid") {
          return { alreadyActivated: true as const };
        }

        const durationMs = order.cycle === "annual"
          ? 365 * 24 * 3600 * 1000
          : 30  * 24 * 3600 * 1000;
        const now = admin.firestore.FieldValue.serverTimestamp();

        tx.set(db.doc(`subscriptions/${order.uid}`), {
          planId:            order.planId,
          cycle:             order.cycle,
          status:            "active",
          endDate:           admin.firestore.Timestamp.fromMillis(Date.now() + durationMs),
          razorpayPaymentId: razorpay_payment_id,
          razorpayOrderId:   razorpay_order_id,
          createdAt:         now,
          updatedAt:         now,
        });
        tx.update(orderRef, { status: "paid", razorpayPaymentId: razorpay_payment_id, paidAt: now });

        return { activated: true as const, uid: order.uid, planId: order.planId, cycle: order.cycle };
      });

      if ("notFound" in result) {
        res.status(404).json({ error: "Order not found" });
        return;
      }
      if ("alreadyActivated" in result) {
        res.status(200).json({ success: true, alreadyActivated: true });
        return;
      }

      console.log(`✅ AI Guru subscription activated via browser: uid=${result.uid} plan=${result.planId} cycle=${result.cycle}`);
      res.status(200).json({ success: true });
    } catch (e: any) {
      console.error("aiGuruPaymentSuccess error:", e?.message);
      res.status(500).json({ error: e?.message ?? "Internal error" });
    }
  }
);