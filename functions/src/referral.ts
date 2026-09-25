// ─────────────────────────────────────────────────────────────────────────────
// FILE: functions/src/referral.ts
// PATH: functions/src/referral.ts
// FIXES APPLIED:
//   1. vCoinsBalance → vCoins, "VidyaAI" → "Gloows365E" (earlier pass)
//   2. Single-use bypass: "already referred" check now also queries the
//      tamper-proof `referrals` collection instead of trusting the mutable,
//      client-writable users/{uid}.referredBy field alone.
//   3. Balance/count updates now use FieldValue.increment() instead of
//      read-then-add-literal, removing a lost-update race under concurrent
//      redemptions of the same code.
//   4. Milestone selection picks the largest matching `every` instead of the
//      first array match, so a smaller milestone can no longer permanently
//      shadow a larger one that shares a common multiple (e.g. 5 vs 10).
// ─────────────────────────────────────────────────────────────────────────────

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";

const db = admin.firestore();

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ReferralConfig {
  referrerCoins:  number;
  refereeCoins:   number;
  giftEnabled:    boolean;
  giftLabel:      string;
  triggerEvent:   string;
  maxReferrals:   number;   // 0 = unlimited
  isActive:       boolean;
  milestones:     MilestoneReward[];
}

interface MilestoneReward {
  every:     number;
  giftLabel: string;
  giftType:  string;
  giftValue: number;
}

const DEFAULT_CONFIG: ReferralConfig = {
  referrerCoins: 50,
  refereeCoins:  30,
  giftEnabled:   false,
  giftLabel:     "",
  triggerEvent:  "signup",
  maxReferrals:  0,
  isActive:      true,
  milestones:    [],
};

// ─── applyReferral ──────────────────────────────────────────────────────────────
// Called by the mobile app when a new student enters a referral code at signup.
// Server-side validation prevents:
//   - Self-referral
//   - Double-using a code
//   - Coin manipulation
//   - Using codes when feature is off

export const applyReferral = functionsV1
  .runWith({ timeoutSeconds: 30, memory: "128MB" })
  .https.onCall(async (
    data: { code: string },
    context
  ) => {
    // ── Auth check ────────────────────────────────────────────────────────────
    if (!context.auth) {
      throw new functionsV1.https.HttpsError("unauthenticated", "Login required");
    }

    const refereeId = context.auth.uid;
    const code      = (data.code ?? "").toUpperCase().trim();

    if (!code || code.length !== 8) {
      throw new functionsV1.https.HttpsError("invalid-argument", "Invalid referral code");
    }

    // ── Load admin config ─────────────────────────────────────────────────────
    let config: ReferralConfig = DEFAULT_CONFIG;
    try {
      const configSnap = await db.doc("appConfig/referralConfig").get();
      if (configSnap.exists) {
        config = { ...DEFAULT_CONFIG, ...(configSnap.data() as Partial<ReferralConfig>) };
      }
    } catch (err) {
      console.error("Failed to load referralConfig:", err);
    }

    if (!config.isActive) {
      throw new functionsV1.https.HttpsError("failed-precondition", "Referral program is currently inactive");
    }

    // ── Check if referee already used a referral code ─────────────────────────
    // Checked against the `referrals` collection (clients cannot write there —
    // see firestore.rules) rather than trusting users/{uid}.referredBy alone.
    // That field has no client-write restriction in firestore.rules, so a
    // client could clear it via a plain updateDoc() and re-call this function
    // to farm the referee welcome bonus repeatedly. The referrals-collection
    // check closes that gap regardless of what the mutable user-doc field says.
    const refereeUserRef  = db.doc(`users/${refereeId}`);
    const refereeUserSnap = await refereeUserRef.get();
    const priorReferralSnap = await db
      .collection("referrals")
      .where("refereeId", "==", refereeId)
      .limit(1)
      .get();
    if (!priorReferralSnap.empty || (refereeUserSnap.exists && refereeUserSnap.data()?.referredBy)) {
      throw new functionsV1.https.HttpsError("already-exists", "You have already used a referral code");
    }

    // ── Find the referrer by referralCode ─────────────────────────────────────
    const usersWithCode = await db
      .collection("users")
      .where("referralCode", "==", code)
      .limit(1)
      .get();

    if (usersWithCode.empty) {
      throw new functionsV1.https.HttpsError("not-found", "Referral code not found");
    }

    const referrerDoc = usersWithCode.docs[0];
    const referrerId  = referrerDoc.id;

    // ── Self-referral guard ───────────────────────────────────────────────────
    if (referrerId === refereeId) {
      throw new functionsV1.https.HttpsError("invalid-argument", "You cannot use your own referral code");
    }

    // ── Max referrals cap ─────────────────────────────────────────────────────
    if (config.maxReferrals > 0) {
      const referrerData = referrerDoc.data();
      const currentCount = referrerData?.referralCount ?? 0;
      if (currentCount >= config.maxReferrals) {
        throw new functionsV1.https.HttpsError(
          "resource-exhausted",
          "This referral code has reached its maximum usage limit"
        );
      }
    }

    const now             = admin.firestore.FieldValue.serverTimestamp();
    const batch           = db.batch();
    const referrerUserRef = db.doc(`users/${referrerId}`);

    // ── 1. Create referrals document ──────────────────────────────────────────
    const referralRef = db.collection("referrals").doc();
    batch.set(referralRef, {
      referrerId,
      refereeId,
      status:        "completed",
      rewardClaimed: true,
      code,
      createdAt:     now,
      completedAt:   now,
    });

    // ── 2. Mark referee as referred ───────────────────────────────────────────
    batch.set(refereeUserRef, {
      referredBy:          referrerId,
      referralCodeEntered: code,
    }, { merge: true });

    // ── 3. Credit referrer's VCoins ───────────────────────────────────────────
    // Uses FieldValue.increment() instead of read-then-add-literal so
    // concurrent redemptions of the same referral code can't stomp on each
    // other's updates (a plain read + literal write would silently drop one
    // referrer's credit if two referrals landed close together).
    if (config.referrerCoins > 0) {
      batch.update(referrerUserRef, {
        vCoins:               admin.firestore.FieldValue.increment(config.referrerCoins),
        vCoinsLifetimeEarned: admin.firestore.FieldValue.increment(config.referrerCoins),
        referralCount:        admin.firestore.FieldValue.increment(1),
        referralCoinsEarned:  admin.firestore.FieldValue.increment(config.referrerCoins),
        vCoinsUpdatedAt:      now,
      });

      // Write referrer transaction doc
      const referrerTxRef = db.collection(`users/${referrerId}/vCoinTransactions`).doc();
      batch.set(referrerTxRef, {
        type:        "CREDIT",
        amount:      config.referrerCoins,
        source:      "REFERRAL_REWARD",
        title:       "Referral Reward 🎉",
        description: `A friend joined with your code ${code}`,
        status:      "SUCCESS",
        referenceId: referralRef.id,
        metadata:    { code, refereeId },
        createdAt:   now,
        updatedAt:   now,
      });
    }

    // ── 4. Credit referee's welcome bonus ─────────────────────────────────────
    if (config.refereeCoins > 0) {
      batch.update(refereeUserRef, {
        vCoins:               admin.firestore.FieldValue.increment(config.refereeCoins),
        vCoinsLifetimeEarned: admin.firestore.FieldValue.increment(config.refereeCoins),
        vCoinsUpdatedAt:      now,
      });

      // Write referee transaction doc
      const refereeTxRef = db.collection(`users/${refereeId}/vCoinTransactions`).doc();
      batch.set(refereeTxRef, {
        type:        "CREDIT",
        amount:      config.refereeCoins,
        source:      "REFEREE_JOIN_BONUS",
        title:       "Welcome Bonus 🎁",
        description: `Welcome to Gloows365E! Bonus for joining with a referral code.`,  // ✅ FIX: was VidyaAI
        status:      "SUCCESS",
        referenceId: referralRef.id,
        metadata:    { code, referrerId },
        createdAt:   now,
        updatedAt:   now,
      });
    }

    // ── 5. Check milestone rewards ────────────────────────────────────────────
    let milestoneGiftLabel: string | null = null;

    if (config.milestones?.length > 0) {
      const referrerData = referrerDoc.data();
      const newCount     = (referrerData?.referralCount ?? 0) + 1;

      // Pick the largest `every` among milestones newCount evenly divides,
      // not just the first array match — otherwise a smaller milestone
      // (e.g. "every 5") permanently shadows a larger one that shares a
      // common multiple (e.g. "every 10" would never fire, since every
      // multiple of 10 is also a multiple of 5 and array order put 5 first).
      const dueMilestone = config.milestones
        .filter((m) => m.every > 0 && newCount % m.every === 0)
        .reduce<MilestoneReward | null>(
          (biggest, m) => (!biggest || m.every > biggest.every ? m : biggest),
          null
        );

      if (dueMilestone) {
        milestoneGiftLabel = dueMilestone.giftLabel;
        // Bonus coins milestone
        if (dueMilestone.giftType === "coins" && dueMilestone.giftValue > 0) {
          const msTxRef = db.collection(`users/${referrerId}/vCoinTransactions`).doc();
          batch.set(msTxRef, {
            type:        "CREDIT",
            amount:      dueMilestone.giftValue,
            source:      "REFERRAL_REWARD",
            title:       `Milestone Reward 🏆`,
            description: `${newCount}th referral milestone: ${dueMilestone.giftLabel}`,
            status:      "SUCCESS",
            referenceId: `milestone_${newCount}`,
            metadata:    { milestone: newCount, giftLabel: dueMilestone.giftLabel },
            createdAt:   now,
            updatedAt:   now,
          });

          batch.update(referrerUserRef, {
            vCoins:               admin.firestore.FieldValue.increment(dueMilestone.giftValue),
            vCoinsLifetimeEarned: admin.firestore.FieldValue.increment(dueMilestone.giftValue),
          });
        }
      }
    }

    // ── Commit everything atomically ──────────────────────────────────────────
    await batch.commit();

    console.log(`✅ Referral applied: ${referrerId} → ${refereeId} (code: ${code})`);

    return {
      success:     true,
      referrerId,
      coinsEarned: config.refereeCoins,
      giftLabel:   milestoneGiftLabel ?? (config.giftEnabled ? config.giftLabel : null),
      message:     `Welcome! You earned ${config.refereeCoins} VCoins as a join bonus!`,
    };
  });


// ─── getReferralLeaderboard ───────────────────────────────────────────────────
// Returns top 20 referrers for the admin leaderboard view.

export const getReferralLeaderboard = functionsV1
  .runWith({ timeoutSeconds: 15, memory: "128MB" })
  .https.onCall(async (_data, context) => {
    if (!context.auth?.token?.admin) {
      throw new functionsV1.https.HttpsError("permission-denied", "Admin only");
    }

    const snap = await db
      .collection("users")
      .where("referralCount", ">", 0)
      .orderBy("referralCount", "desc")
      .limit(20)
      .get();

    return snap.docs.map((d) => ({
      uid:                 d.id,
      referralCode:        d.data().referralCode        ?? "",
      referralCount:       d.data().referralCount        ?? 0,
      referralCoinsEarned: d.data().referralCoinsEarned  ?? 0,
    }));
  });
