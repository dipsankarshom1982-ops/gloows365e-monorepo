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
  amountPaise: number;
}

// ── Phase 2: Verify payment + write subscription ──────────────────────────────

interface VerifyPaymentPayload {
  planId: string;
  cycle: "monthly" | "annual";
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}

type RequestPayload = CreateOrderPayload | VerifyPaymentPayload;

function isVerifyPayload(data: RequestPayload): data is VerifyPaymentPayload {
  return "razorpayPaymentId" in data && typeof data.razorpayPaymentId === "string";
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
    if (isVerifyPayload(data)) {
      const { planId, cycle, razorpayPaymentId, razorpayOrderId, razorpaySignature } = data;

      const expectedSig = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      if (expectedSig !== razorpaySignature) {
        throw new functionsV1.https.HttpsError("permission-denied", "Payment verification failed");
      }

      const durationMs = cycle === "annual"
        ? 365 * 24 * 3600 * 1000
        : 30  * 24 * 3600 * 1000;

      await db.doc(`subscriptions/${uid}`).set({
        planId,
        cycle,
        status: "active",
        endDate: admin.firestore.Timestamp.fromMillis(Date.now() + durationMs),
        razorpayPaymentId,
        razorpayOrderId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ AI Guru subscription created: uid=${uid} plan=${planId} cycle=${cycle}`);
      return { success: true, planId, cycle };
    }

    // ── Phase 1: Create Razorpay order ────────────────────────────────────────
    const { amountPaise } = data as CreateOrderPayload;

    if (!keyId || !keySecret) {
      console.error("Razorpay secrets missing — keyId:", !!keyId, "keySecret:", !!keySecret);
      throw new functionsV1.https.HttpsError("failed-precondition", "Razorpay not configured — secrets missing");
    }

    if (!amountPaise || amountPaise < 100) {
      throw new functionsV1.https.HttpsError("invalid-argument", `Invalid amount: ${amountPaise} paise`);
    }

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
      console.log(`✅ AI Guru Razorpay order created: ${razorpayOrderId} for uid=${uid}`);
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
// Called by the app — opens in Chrome — no data: URI needed
export const aiGuruCheckoutPage = onRequest(
  { timeoutSeconds: 10, memory: "128MiB" },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");

    const { key, order_id, amount, plan, email, uid, planId, cycle } = req.query as Record<string, string>;
    const cfBase = `https://us-central1-${process.env.GCLOUD_PROJECT ?? "gloows-03b6sz"}.cloudfunctions.net`;

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
    <div class="sub">Premium Subscription</div>
    <div id="msg" class="msg">Opening payment…</div>
    <button class="btn" id="payBtn" onclick="openRzp()">Pay ₹${Math.round(Number(amount) / 100)}</button>
  </div>
<script>
var paid = false;
function openRzp() {
  document.getElementById("payBtn").disabled = true;
  document.getElementById("msg").innerText = "Loading Razorpay…";
  var options = {
    key: "${key}",
    order_id: "${order_id}",
    amount: ${amount},
    currency: "INR",
    name: "GLOOWS365E",
    description: "${plan}",
    prefill: { email: "${email}" },
    theme: { color: "#6366f1" },
    handler: function(r) {
      paid = true;
      document.getElementById("msg").innerHTML = '<div class="success">✅ Payment Successful!<br>Return to the app.</div>';
      document.getElementById("payBtn").style.display = "none";
      fetch("${cfBase}/aiGuruPaymentSuccess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: "${uid}", planId: "${planId}", cycle: "${cycle}",
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
        uid, planId, cycle,
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
      } = req.body;

      if (!uid || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
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

      // Activate subscription in Firestore
      const durationMs = cycle === "annual"
        ? 365 * 24 * 3600 * 1000
        : 30  * 24 * 3600 * 1000;

      await db.doc(`subscriptions/${uid}`).set({
        planId,
        cycle,
        status:           "active",
        endDate:          admin.firestore.Timestamp.fromMillis(Date.now() + durationMs),
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId:   razorpay_order_id,
        createdAt:        admin.firestore.FieldValue.serverTimestamp(),
        updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ AI Guru subscription activated via browser: uid=${uid} plan=${planId} cycle=${cycle}`);
      res.status(200).json({ success: true });
    } catch (e: any) {
      console.error("aiGuruPaymentSuccess error:", e?.message);
      res.status(500).json({ error: e?.message ?? "Internal error" });
    }
  }
);