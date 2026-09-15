// PATH: functions/rules-tests/firestore.rules.test.ts
// Firestore security-rules regression suite (launch audit, Phase 1 Task 8).
// Runs the REAL firestore.rules file against the Firestore emulator via
// @firebase/rules-unit-testing — never a stubbed/simplified copy of the
// rules, and never against a live project. Per the task's own instruction:
// if a test here fails against the real rules, the fix is either a real
// bug in the rules or a wrong test expectation — never loosening the rule
// to make a test pass.
//
// Covers, in priority order: tutor self-verification prevention (Task 1),
// VCoins forgery prevention (the VCoins migration), and the payment order
// collections being fully closed to clients (every *Orders/refunds
// collection this session's payment work touched).

import * as fs from "fs";
import * as path from "path";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-gloows365e-test",
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

async function seed(fn: (adminDb: FirebaseFirestore.Firestore) => Promise<void>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    // ctx.firestore() from rules-unit-testing has a firestore-compatible
    // API but isn't literally the admin SDK type — cast for the seed
    // helper's convenience, it only ever calls .doc()/.set() here.
    await fn(ctx.firestore() as unknown as FirebaseFirestore.Firestore);
  });
}

// ─── Tutor self-verification prevention (Task 1) ───────────────────────────

describe("tutors/{uid} — self-verification prevention (Task 1 regression)", () => {
  const tutorUid = "tutor_abc";

  test("a tutor CAN create their own profile with legitimate fields", async () => {
    const db = testEnv.authenticatedContext(tutorUid).firestore();
    await assertSucceeds(
      db.doc(`tutors/${tutorUid}`).set({
        bio: "Experienced tutor", subjects: ["Math"], qualification: "MSc",
        sessionFee: 500, availability: {}, webPushToken: "tok123",
      })
    );
  });

  test("a tutor CAN update their own legitimate fields afterwards", async () => {
    await seed(async (db) => { await db.doc(`tutors/${tutorUid}`).set({ bio: "seed", verified: false }); });
    const db = testEnv.authenticatedContext(tutorUid).firestore();
    await assertSucceeds(db.doc(`tutors/${tutorUid}`).update({ bio: "Updated bio", sessionFee: 750 }));
  });

  test("a tutor CANNOT set verified:true on create", async () => {
    const db = testEnv.authenticatedContext(tutorUid).firestore();
    await assertFails(db.doc(`tutors/${tutorUid}`).set({ bio: "x", verified: true }));
  });

  test("a tutor CANNOT set verified:true on an existing doc", async () => {
    await seed(async (db) => { await db.doc(`tutors/${tutorUid}`).set({ bio: "seed", verified: false }); });
    const db = testEnv.authenticatedContext(tutorUid).firestore();
    await assertFails(db.doc(`tutors/${tutorUid}`).update({ verified: true }));
  });

  test("a tutor cannot smuggle verified:true alongside a legitimate field in one write", async () => {
    await seed(async (db) => { await db.doc(`tutors/${tutorUid}`).set({ bio: "seed", verified: false }); });
    const db = testEnv.authenticatedContext(tutorUid).firestore();
    await assertFails(db.doc(`tutors/${tutorUid}`).set({ bio: "sneaky", verified: true }, { merge: true }));
  });

  test("a tutor cannot forge their own ratingAverage/ratingCount", async () => {
    await seed(async (db) => { await db.doc(`tutors/${tutorUid}`).set({ bio: "seed" }); });
    const db = testEnv.authenticatedContext(tutorUid).firestore();
    await assertFails(db.doc(`tutors/${tutorUid}`).update({ ratingAverage: 5, ratingCount: 999 }));
  });

  test("a tutor cannot set isOnlineForInstantHelp directly (setInstantHelpOnlineStatus's job)", async () => {
    await seed(async (db) => { await db.doc(`tutors/${tutorUid}`).set({ bio: "seed" }); });
    const db = testEnv.authenticatedContext(tutorUid).firestore();
    await assertFails(db.doc(`tutors/${tutorUid}`).update({ isOnlineForInstantHelp: true }));
  });

  test("a different authenticated user cannot write to someone else's tutors/{uid} at all", async () => {
    await seed(async (db) => { await db.doc(`tutors/${tutorUid}`).set({ bio: "seed" }); });
    const otherDb = testEnv.authenticatedContext("someone_else").firestore();
    await assertFails(otherDb.doc(`tutors/${tutorUid}`).update({ bio: "hijacked" }));
  });

  test("even an admin's own client SDK write cannot set verified:true — the real workflow uses the Admin SDK, which bypasses rules entirely", async () => {
    // tutors/{uid}'s update rule (firestore.rules) is scoped to
    // request.auth.uid == uid with no admin-claim branch at all — by
    // design (see the match block's header comment): reviewTutorVerification
    // in tutorAccounts.ts writes `verified` via the Admin SDK server-side,
    // which isn't subject to these rules in the first place, so a
    // client-side bypass for admin claims was never needed and would only
    // widen the attack surface (an admin's ID token in the wrong hands
    // could otherwise self-serve verification writes). Matches the same
    // "even an admin cannot write directly" pattern already proven for the
    // payment order collections above.
    await seed(async (db) => { await db.doc(`tutors/${tutorUid}`).set({ bio: "seed", verified: false }); });
    const adminDb = testEnv.authenticatedContext("admin_1", { admin: true }).firestore();
    await assertFails(adminDb.doc(`tutors/${tutorUid}`).update({ verified: true }));
  });
});

// ─── VCoins forgery prevention ──────────────────────────────────────────────

describe("users/{uid} — VCoins forgery prevention", () => {
  const uid = "student_abc";

  test("a user CANNOT write their own vCoinsBalance directly", async () => {
    await seed(async (db) => { await db.doc(`users/${uid}`).set({ role: "student" }); });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`users/${uid}`).update({ vCoinsBalance: 999999 }));
  });

  test("a user CANNOT write vCoins, vCoinsLifetimeEarned, or a vCoinsYear_* field", async () => {
    await seed(async (db) => { await db.doc(`users/${uid}`).set({ role: "student" }); });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`users/${uid}`).update({ vCoins: 999999 }));
    await assertFails(db.doc(`users/${uid}`).update({ vCoinsLifetimeEarned: 999999 }));
    await assertFails(db.doc(`users/${uid}`).update({ vCoinsYear_2026: 999999 }));
  });

  test("a user CAN still update an unrelated field on their own doc", async () => {
    await seed(async (db) => { await db.doc(`users/${uid}`).set({ role: "student" }); });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc(`users/${uid}`).update({ displayName: "New Name" }));
  });

  test("a user CANNOT write vCoinActivityLocks (the idempotency-lock replay hole)", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`users/${uid}/vCoinActivityLocks/some_lock`).set({ source: "x" }));
  });

  test("a user CANNOT write vCoinTransactions directly", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`users/${uid}/vCoinTransactions/some_tx`).set({ amount: 999999 }));
  });

  test("a user CAN read their own vCoinActivityLocks", async () => {
    await seed(async (db) => { await db.doc(`users/${uid}/vCoinActivityLocks/some_lock`).set({ source: "x" }); });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc(`users/${uid}/vCoinActivityLocks/some_lock`).get());
  });
});

// ─── users/{uid} — role self-escalation prevention (tester/module-access
// follow-up) ─────────────────────────────────────────────────────────────
// role/roles drive real access now — AppConfigContext.tsx and
// FeatureFlagsContext.tsx (packages/shared-logic) grant a "tester" a
// bypass past every admin module/feature toggle, and usageCheck.ts gives
// one unlimited free AI Guru usage. Before this fix, the update rule's
// deny-list only blocked VCoins fields, so a signed-in user could update
// their own existing doc to role: "tester" (or "admin") directly.

describe("users/{uid} — role self-escalation prevention", () => {
  const uid = "student_xyz";

  test("a user CANNOT promote their own role to tester via update", async () => {
    await seed(async (db) => { await db.doc(`users/${uid}`).set({ role: "student" }); });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`users/${uid}`).update({ role: "tester" }));
  });

  test("a user CANNOT promote their own role to admin via update", async () => {
    await seed(async (db) => { await db.doc(`users/${uid}`).set({ role: "student" }); });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`users/${uid}`).update({ role: "admin" }));
  });

  test("a user CANNOT rewrite their own roles array via update", async () => {
    await seed(async (db) => { await db.doc(`users/${uid}`).set({ role: "student", roles: ["student"] }); });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`users/${uid}`).update({ roles: ["tester"] }));
  });

  test("a user cannot smuggle role: 'tester' alongside a legitimate field in one write", async () => {
    await seed(async (db) => { await db.doc(`users/${uid}`).set({ role: "student" }); });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`users/${uid}`).set({ displayName: "sneaky", role: "tester" }, { merge: true }));
  });

  test("re-writing role to the SAME value ('student') alongside a legitimate field still succeeds", async () => {
    // signup.tsx / register.tsx merge-write role: "student" again on top of
    // an already-"student" doc — affectedKeys() only flags an actual value
    // change, so this must keep working.
    await seed(async (db) => { await db.doc(`users/${uid}`).set({ role: "student" }); });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc(`users/${uid}`).set({ role: "student", onboardingComplete: true }, { merge: true }));
  });

  test("an admin CAN promote a user's role via the admin-claim update rule", async () => {
    await seed(async (db) => { await db.doc(`users/${uid}`).set({ role: "student" }); });
    const adminDb = testEnv.authenticatedContext("admin_1", { admin: true }).firestore();
    await assertSucceeds(adminDb.doc(`users/${uid}`).update({ role: "tester" }));
  });
});

// ─── users/{uid} create-rule allowlist (security follow-up, 2026-08-26) ────
// Firestore classifies a write to a NOT-YET-EXISTING doc as `create`, not
// `update` — the VCoins forgery suite above only exercised `update` on an
// already-seeded doc, so it never caught that `create` had no field
// restriction at all. These tests exercise real setDoc() calls on a doc
// that doesn't exist yet (no seed() call), mirroring the exact shape of
// every confirmed client-side users/{uid} creation call site in the repo.

describe("users/{uid} — create rule allowlist", () => {
  const uid = "student_abc";

  test("legitimate email/password signup document can be created (mobile signup.tsx / web signup/page.tsx shape)", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc(`users/${uid}`).set({
      role: "student", roles: ["student"], createdAt: new Date(),
      consent: { policyAccepted: true, policyVersion: "2026-07-17", acceptedAt: new Date() },
    }));
  });

  test("legitimate Google signup document can be created (mobile/web Google bootstrap shape)", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc(`users/${uid}`).set({
      role: "student", roles: ["student"],
      email: "student@example.com", name: "A Student", photoURL: "https://example.com/p.jpg",
      signupPlatform: "web", createdAt: new Date(),
    }));
  });

  test("legitimate register.tsx / register/page.tsx completion document can be created", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc(`users/${uid}`).set({
      role: "student", roles: ["student"], profileType: "student",
      onboardingComplete: true, referralCode: "ABCDWXYZ", createdAt: new Date(),
    }));
  });

  test("legitimate restart-education onboarding document can be created", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc(`users/${uid}`).set({
      lastClassPassed: "Class 10 (Passed)", currentOccupation: "Daily wage worker",
      educationGapReason: "Financial difficulties", onboardingComplete: true,
      profileType: "restartEducation", updatedAt: new Date(),
    }));
  });

  test("legitimate restart-redirect document (name/dob/age/preferredLanguage/profilePic/title) can be created", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc(`users/${uid}`).set({
      name: "A Student", title: "Mr.", profilePic: "", preferredLanguage: "English",
      dob: "01/01/2010", age: 16, profileType: "restartEducation",
      onboardingComplete: false, createdAt: new Date(),
    }));
  });

  test("creating vCoinsBalance on a brand-new doc is denied", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`users/${uid}`).set({ role: "student", vCoinsBalance: 999999 }));
  });

  test("creating any protected vCoins* field on a brand-new doc is denied", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`users/${uid}`).set({ role: "student", vCoins: 999999 }));
    await assertFails(db.doc(`users/${uid}`).set({ role: "student", vCoinsLifetimeEarned: 999999 }));
    await assertFails(db.doc(`users/${uid}`).set({ role: "student", vCoinsYear_2026: 999999 }));
    await assertFails(db.doc(`users/${uid}`).set({ role: "student", vCoinsHistory_2026: [] }));
  });

  test("creating admin:true (or any other privileged/system field not in the allowlist) is denied", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`users/${uid}`).set({ role: "student", admin: true }));
    await assertFails(db.doc(`users/${uid}`).set({ role: "student", verified: true }));
    await assertFails(db.doc(`users/${uid}`).set({ role: "student", tutorEarnings: 999999 }));
    await assertFails(db.doc(`users/${uid}`).set({ role: "student", payoutBalance: 999999 }));
  });

  test("self-assigning a privileged role (admin/superAdmin/moderator) is denied", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`users/${uid}`).set({ role: "admin" }));
    await assertFails(db.doc(`users/${uid}`).set({ role: "superAdmin" }));
    await assertFails(db.doc(`users/${uid}`).set({ role: "moderator" }));
    await assertFails(db.doc(`users/${uid}`).set({ roles: ["student", "admin"] }));
  });

  test("an invalid profileType is denied", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`users/${uid}`).set({ role: "student", profileType: "admin" }));
    await assertFails(db.doc(`users/${uid}`).set({ role: "student", profileType: "anything_else" }));
  });

  test("an invalid roles array is denied", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`users/${uid}`).set({ roles: ["admin"] }));
    await assertFails(db.doc(`users/${uid}`).set({ roles: [] }));
  });

  test("a field entirely outside the allowlist is denied even with an otherwise-legitimate payload", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`users/${uid}`).set({ role: "student", roles: ["student"], someRandomField: 123 }));
  });

  test("a user cannot create a DIFFERENT user's doc", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`users/someone_else`).set({ role: "student" }));
  });

  test("server-side Admin SDK creation is unaffected by this rule (rules don't apply to the Admin SDK)", async () => {
    // withSecurityRulesDisabled is exactly what the Admin SDK's exemption
    // from security rules amounts to in this test harness — if this
    // succeeds with a fully privileged payload, the rule change above
    // cannot have touched server-side creation paths at all (functions/src/
    // tutorAccounts.ts, vcoins.ts, vidyastarContest.ts, etc.).
    await seed(async (db) => {
      await db.doc(`users/server_created_uid`).set({
        role: "tutor", vCoinsBalance: 5000, admin: false, anythingAtAll: "yes",
      });
    });
    let peekExists = false;
    let peekBalance: unknown;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const snap = await ctx.firestore().doc("users/server_created_uid").get();
      peekExists = snap.exists;
      peekBalance = snap.data()?.vCoinsBalance;
    });
    expect(peekExists).toBe(true);
    expect(peekBalance).toBe(5000);
  });
});

// ─── Payment order collections — fully closed to clients ───────────────────

describe("payment order collections — server-only (Admin SDK writes only)", () => {
  const uid = "student_abc";
  const orderCollections = [
    "aiGuruSubscriptionOrders",
    "seekho_subscription_orders",
    "aiGuruCreditOrders",
    "tutorCreditOrders",
  ];

  for (const col of orderCollections) {
    test(`${col} — a signed-in user cannot read or write`, async () => {
      await seed(async (db) => { await db.doc(`${col}/order_1`).set({ uid, status: "created" }); });
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertFails(db.doc(`${col}/order_1`).get());
      await assertFails(db.doc(`${col}/order_1`).set({ status: "paid" }));
    });

    test(`${col} — even an admin cannot write directly (must go through the Cloud Function)`, async () => {
      await seed(async (db) => { await db.doc(`${col}/order_1`).set({ uid, status: "created" }); });
      const adminDb = testEnv.authenticatedContext("admin_1", { admin: true }).firestore();
      await assertFails(adminDb.doc(`${col}/order_1`).set({ status: "paid" }));
    });
  }

  test("refunds — a signed-in non-admin user cannot read or write", async () => {
    await seed(async (db) => { await db.doc("refunds/refund_1").set({ uid, status: "succeeded" }); });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc("refunds/refund_1").get());
    await assertFails(db.doc("refunds/refund_1").set({ status: "succeeded" }));
  });

  test("refunds — an admin CAN read, but still cannot write directly", async () => {
    await seed(async (db) => { await db.doc("refunds/refund_1").set({ uid, status: "succeeded" }); });
    const adminDb = testEnv.authenticatedContext("admin_1", { admin: true }).firestore();
    await assertSucceeds(adminDb.doc("refunds/refund_1").get());
    await assertFails(adminDb.doc("refunds/refund_1").update({ status: "failed" }));
  });
});

// ─── Role access basics ─────────────────────────────────────────────────────

describe("role access — admin-gated collections reject non-admins", () => {
  test("a signed-in non-admin cannot write payoutConfig", async () => {
    const db = testEnv.authenticatedContext("student_1").firestore();
    await assertFails(db.doc("payoutConfig/settings").set({ commissionPercent: 0 }));
  });

  test("an unauthenticated request cannot read a user's own profile-adjacent data", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.doc("users/student_abc").get());
  });
});

// ─── students/{uid} — field allowlist (full audit, 2026-08-27) ─────────────

describe("students/{uid} — create/update field allowlist", () => {
  const uid = "student_xyz";

  test("legitimate mobile/web registration document can be created", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(
      db.doc(`students/${uid}`).set({
        name: "Asha", title: "Ms.", phone: "9876500000", school: "St. Xavier's",
        board: "CBSE", section: "A", class: "10", preferredLanguage: "English",
        profilePic: "", parentPhone: "9876500000", parentPhoneVerified: true,
        parentalConsent: { granted: true }, dob: "2010-01-01", age: 15,
        location: { state: "WB" }, interests: ["Math"],
        stats: { xp: 0, level: 1, streak: 0 },
        learningProfile: { goal: "Improve learning", dailyTarget: 30 },
        onboardingComplete: true,
      })
    );
  });

  test("legitimate minimal signup.tsx bootstrap document can be created", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(
      db.doc(`students/${uid}`).set({ email: "a@b.com", role: "student", onboardingComplete: false })
    );
  });

  test("legitimate push-token-only write can be created", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc(`students/${uid}`).set({ pushToken: "tok123" }, { merge: true }));
  });

  test("legitimate LearnFun mission-reward fields can be created", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(
      db.doc(`students/${uid}`).set({
        LearnFunXP: 10, LearnFunStreak: 1, LearnFunLastMissionDate: "2026-08-27",
        LearnFunCompletedMissions: ["m1"], LearnFunBadges: ["b1"],
      }, { merge: true })
    );
  });

  test("creating studentId on a brand-new doc is denied", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`students/${uid}`).set({ name: "Asha", studentId: "GLS000001" }));
  });

  test("creating learnScore on a brand-new doc is denied", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`students/${uid}`).set({ name: "Asha", learnScore: 999999 }));
  });

  test("self-assigning a non-'student' role on create is denied", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`students/${uid}`).set({ role: "admin" }));
  });

  test("a field entirely outside the allowlist is denied even with an otherwise-legitimate payload", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`students/${uid}`).set({ name: "Asha", notAField: true }));
  });

  test("a user cannot set their own studentId on an EXISTING doc either (the actual forgery this fix closes)", async () => {
    await seed(async (db) => { await db.doc(`students/${uid}`).set({ name: "Asha", studentId: "GLS000042" }); });
    const db = testEnv.authenticatedContext(uid).firestore();
    // The real attack: overwrite an already-assigned studentId to collide
    // with a DIFFERENT real student's ID, so admin's Payment Management
    // studentId search (functions/src/refundSearch.ts) resolves to this
    // attacker's uid instead of (or ambiguously alongside) the real owner.
    await assertFails(db.doc(`students/${uid}`).update({ studentId: "GLS999999" }));
  });

  test("a user cannot inflate their own learnScore on an EXISTING doc either", async () => {
    await seed(async (db) => { await db.doc(`students/${uid}`).set({ name: "Asha", learnScore: 0 }); });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`students/${uid}`).update({ learnScore: 999999 }));
  });

  test("a user CAN still update an unrelated legitimate field on an existing doc", async () => {
    await seed(async (db) => { await db.doc(`students/${uid}`).set({ name: "Asha", studentId: "GLS000042" }); });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc(`students/${uid}`).update({ preferredLanguage: "Hindi", updatedAt: "2026-08-27" }));
  });

  test("server-side Admin SDK creation (studentId/learnScore included) is unaffected by this rule", async () => {
    await seed(async (db) => {
      await db.doc(`students/${uid}`).set({ name: "Asha", studentId: "GLS000042", learnScore: 500 });
    });
    // No assertion beyond "seed didn't throw" — withSecurityRulesDisabled
    // bypasses rules entirely, same as the Admin SDK in production.
  });
});

// ─── posts/{postId} — non-owner update allowlist (full audit, 2026-08-27) ──
// The changedKeys()→affectedKeys() fix. A field that has never existed on a
// post before lands in addedKeys(), which changedKeys() can't see at all —
// so the OLD rule silently let a non-owner add any brand-new field to
// someone else's post, as long as it wasn't already present. views/likes/
// comments/watchTime/shares are always seeded at creation (see
// apps/mobile/app/Createreelscreen.tsx), so a real post never hits this
// path in practice — this suite creates a seed doc WITHOUT them specifically
// to exercise the gap the old rule had.

describe("posts/{postId} — non-owner update allowlist (changedKeys→affectedKeys fix)", () => {
  const ownerUid = "post_owner";
  const strangerUid = "post_stranger";
  const postId = "post_1";

  test("a stranger CAN still increment the allowlisted counters", async () => {
    await seed(async (db) => {
      await db.doc(`posts/${postId}`).set({ userId: ownerUid, views: 0, likes: 0, comments: 0, watchTime: 0, shares: 0 });
    });
    const db = testEnv.authenticatedContext(strangerUid).firestore();
    await assertSucceeds(db.doc(`posts/${postId}`).update({ views: 1, likes: 1 }));
  });

  test("a stranger CANNOT smuggle in a brand-new field the post never had before", async () => {
    // Deliberately omit views/likes/comments/watchTime/shares from the seed
    // so the malicious field is the ONLY thing in the diff — this is
    // exactly what the old changedKeys()-based rule missed.
    await seed(async (db) => { await db.doc(`posts/${postId}`).set({ userId: ownerUid }); });
    const db = testEnv.authenticatedContext(strangerUid).firestore();
    await assertFails(db.doc(`posts/${postId}`).update({ pinned: true }));
  });

  test("a stranger cannot smuggle a new field in ALONGSIDE a legitimate counter update", async () => {
    await seed(async (db) => { await db.doc(`posts/${postId}`).set({ userId: ownerUid, views: 0 }); });
    const db = testEnv.authenticatedContext(strangerUid).firestore();
    await assertFails(db.doc(`posts/${postId}`).update({ views: 1, flaggedForReview: true }));
  });

  test("the owner can still update their own post freely, new fields included", async () => {
    await seed(async (db) => { await db.doc(`posts/${postId}`).set({ userId: ownerUid }); });
    const db = testEnv.authenticatedContext(ownerUid).firestore();
    await assertSucceeds(db.doc(`posts/${postId}`).update({ caption: "Updated caption" }));
  });
});

// ─── SkillBattle trust-boundary remediation (SB-P0-01/SB-P0-02) ───────────
// See firestore.rules' posts/{postId} create/update rule header comments
// for the full vulnerability: create had no field validation at all beyond
// ownership, and the owner-update branch had no restriction beyond
// keeping userId unchanged — a student could self-approve their own
// SkillBattle submission and inflate its engagement counters at will.
describe("posts/{postId} — SkillBattle create allowlist (SB-P0-02)", () => {
  const uid = "battle_student";

  const legitimatePayload = {
    userId: uid, name: "Test", school: "Test School", class: "8", profilePic: "",
    battleId: "battle_1", battleTitle: "Test Battle", battleType: "sponsored",
    isSkillBattle: true, postType: "reel", month: "2026-08",
    caption: "my reel", targetState: ["All"], targetLanguage: ["English"],
    location: { city: "", district: "", state: "", pincode: "", country: "India" },
    mediaUrl: "https://example.com/v.m3u8", thumbnail: "",
    status: "pending", rejectionReason: "", reviewedAt: null, reviewedBy: "",
    likes: 0, views: 0, shares: 0, comments: 0, watchTime: 0,
  };

  test("a legitimate pending, zero-engagement submission CAN be created", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc("posts/p1").set(legitimatePayload));
  });

  test("CANNOT create a pre-approved SkillBattle submission", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc("posts/p1").set({ ...legitimatePayload, status: "approved" }));
  });

  test("CANNOT create a submission with pre-inflated engagement counts", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc("posts/p1").set({ ...legitimatePayload, likes: 999999, views: 999999 }));
  });

  test("CANNOT smuggle an out-of-allowlist field in alongside a legitimate payload", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc("posts/p1").set({ ...legitimatePayload, isWinner: true }));
  });

  test("CANNOT create a submission for another student (forged creator ID)", async () => {
    const db = testEnv.authenticatedContext("someone_else").firestore();
    await assertFails(db.doc("posts/p1").set(legitimatePayload));
  });

  test("an ordinary (non-SkillBattle) post's create rule is unaffected by this fix", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc("posts/p2").set({ userId: uid, caption: "just a normal photo post" }));
  });
});

describe("posts/{postId} — SkillBattle update lockdown, no owner-bypass (SB-P0-01)", () => {
  const ownerUid = "battle_owner";
  const strangerUid = "battle_stranger";
  const postId = "battle_post_1";

  function seedApprovedBattlePost(overrides: Record<string, unknown> = {}) {
    return seed(async (db) => {
      await db.doc(`posts/${postId}`).set({
        userId: ownerUid, isSkillBattle: true, status: "pending",
        views: 0, likes: 0, comments: 0, watchTime: 0, shares: 0,
        ...overrides,
      });
    });
  }

  test("the OWNER cannot self-approve their own submission", async () => {
    await seedApprovedBattlePost();
    const db = testEnv.authenticatedContext(ownerUid).firestore();
    await assertFails(db.doc(`posts/${postId}`).update({ status: "approved" }));
  });

  test("the OWNER cannot move rejected -> approved either", async () => {
    await seedApprovedBattlePost({ status: "rejected" });
    const db = testEnv.authenticatedContext(ownerUid).firestore();
    await assertFails(db.doc(`posts/${postId}`).update({ status: "approved" }));
  });

  test("the OWNER cannot bulk-inflate their own views in one write", async () => {
    await seedApprovedBattlePost();
    const db = testEnv.authenticatedContext(ownerUid).firestore();
    await assertFails(db.doc(`posts/${postId}`).update({ views: 999999 }));
  });

  test("the OWNER cannot bulk-inflate their own likes in one write", async () => {
    await seedApprovedBattlePost();
    const db = testEnv.authenticatedContext(ownerUid).firestore();
    await assertFails(db.doc(`posts/${postId}`).update({ likes: 999999 }));
  });

  test("the OWNER cannot smuggle isSkillBattle/battleId/class changes onto an existing post", async () => {
    await seedApprovedBattlePost();
    const db = testEnv.authenticatedContext(ownerUid).firestore();
    await assertFails(db.doc(`posts/${postId}`).update({ battleId: "someone_elses_battle" }));
  });

  test("the OWNER CAN still bump their own views/likes by exactly +1, same as a stranger", async () => {
    await seedApprovedBattlePost();
    const db = testEnv.authenticatedContext(ownerUid).firestore();
    await assertSucceeds(db.doc(`posts/${postId}`).update({ views: 1 }));
  });

  test("a STRANGER can bump views/likes by +1 (unchanged from before this fix)", async () => {
    await seedApprovedBattlePost();
    const db = testEnv.authenticatedContext(strangerUid).firestore();
    await assertSucceeds(db.doc(`posts/${postId}`).update({ likes: 1 }));
  });

  test("a STRANGER cannot bulk-inflate likes even though the field is allowlisted", async () => {
    await seedApprovedBattlePost();
    const db = testEnv.authenticatedContext(strangerUid).firestore();
    await assertFails(db.doc(`posts/${postId}`).update({ likes: 500 }));
  });

  test("watchTime can increase by up to 60s in one write (a single reel's max length)", async () => {
    await seedApprovedBattlePost({ watchTime: 10 });
    const db = testEnv.authenticatedContext(ownerUid).firestore();
    await assertSucceeds(db.doc(`posts/${postId}`).update({ watchTime: 70 }));
  });

  test("watchTime cannot jump by more than 60s in one write", async () => {
    await seedApprovedBattlePost({ watchTime: 10 });
    const db = testEnv.authenticatedContext(ownerUid).firestore();
    await assertFails(db.doc(`posts/${postId}`).update({ watchTime: 100 }));
  });

  test("watchTime cannot decrease", async () => {
    await seedApprovedBattlePost({ watchTime: 30 });
    const db = testEnv.authenticatedContext(ownerUid).firestore();
    await assertFails(db.doc(`posts/${postId}`).update({ watchTime: 10 }));
  });

  test("an admin's client SDK write CAN still approve a submission (the real moderation path)", async () => {
    await seedApprovedBattlePost();
    const adminDb = testEnv.authenticatedContext("admin_1", { admin: true }).firestore();
    await assertSucceeds(adminDb.doc(`posts/${postId}`).update({ status: "approved", reviewedAt: Date.now() }));
  });

  test("an ordinary (non-SkillBattle) post's owner-can-edit-anything behavior is unaffected by this fix", async () => {
    await seed(async (db) => { await db.doc(`posts/${postId}`).set({ userId: ownerUid, caption: "seed" }); });
    const db = testEnv.authenticatedContext(ownerUid).firestore();
    await assertSucceeds(db.doc(`posts/${postId}`).update({ caption: "edited freely, not a battle post" }));
  });
});

describe("skillBattleAwards/{awardId} — immutable, server-only (Step 10)", () => {
  const uid = "award_student";

  test("the student CAN read their own award", async () => {
    await seed(async (db) => { await db.doc(`skillBattleAwards/b1_${uid}`).set({ uid, totalCoins: 500 }); });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc(`skillBattleAwards/b1_${uid}`).get());
  });

  test("a different student CANNOT read someone else's award", async () => {
    await seed(async (db) => { await db.doc(`skillBattleAwards/b1_${uid}`).set({ uid, totalCoins: 500 }); });
    const db = testEnv.authenticatedContext("someone_else").firestore();
    await assertFails(db.doc(`skillBattleAwards/b1_${uid}`).get());
  });

  test("a student CANNOT write their own award directly (client SDK)", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`skillBattleAwards/b1_${uid}`).set({ uid, totalCoins: 999999 }));
  });

  test("even an admin's client SDK write cannot create/modify an award — Admin SDK only", async () => {
    await seed(async (db) => { await db.doc(`skillBattleAwards/b1_${uid}`).set({ uid, totalCoins: 500 }); });
    const adminDb = testEnv.authenticatedContext("admin_1", { admin: true }).firestore();
    await assertFails(adminDb.doc(`skillBattleAwards/b1_${uid}`).update({ totalCoins: 999999 }));
  });
});

// ─── Phase 2B — Domain Foundation: skill taxonomy + battle state lockdown ──
describe("skillCategories/{id} & skills/{id} — admin-only config, category relationship enforced", () => {
  const studentUid = "taxonomy_student";

  test("any signed-in user CAN read skill categories", async () => {
    await seed(async (db) => { await db.doc("skillCategories/creative").set({ name: "Creative", isActive: true }); });
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertSucceeds(db.doc("skillCategories/creative").get());
  });

  test("a student CANNOT create a skill category", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertFails(db.doc("skillCategories/hacked").set({ name: "Hacked", isActive: true }));
  });

  test("a student CANNOT edit an existing skill category", async () => {
    await seed(async (db) => { await db.doc("skillCategories/creative").set({ name: "Creative", isActive: true }); });
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertFails(db.doc("skillCategories/creative").update({ isActive: false }));
  });

  test("an admin CAN create a skill category", async () => {
    const adminDb = testEnv.authenticatedContext("admin_1", { admin: true }).firestore();
    await assertSucceeds(adminDb.doc("skillCategories/creative").set({ name: "Creative", isActive: true, order: 1 }));
  });

  test("an admin CAN create a skill referencing a real category", async () => {
    await seed(async (db) => { await db.doc("skillCategories/creative").set({ name: "Creative", isActive: true }); });
    const adminDb = testEnv.authenticatedContext("admin_1", { admin: true }).firestore();
    await assertSucceeds(adminDb.doc("skills/singing").set({ name: "Singing", categoryId: "creative", isActive: true }));
  });

  test("an admin CANNOT create a skill referencing a category that doesn't exist", async () => {
    const adminDb = testEnv.authenticatedContext("admin_1", { admin: true }).firestore();
    await assertFails(adminDb.doc("skills/singing").set({ name: "Singing", categoryId: "nonexistent_category", isActive: true }));
  });

  test("a student CANNOT create a skill at all, even referencing a real category", async () => {
    await seed(async (db) => { await db.doc("skillCategories/creative").set({ name: "Creative", isActive: true }); });
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertFails(db.doc("skills/singing").set({ name: "Singing", categoryId: "creative", isActive: true }));
  });
});

describe("skillBattles/{battleId} — state is Admin-SDK-only, not even admin client SDK (Phase 2B)", () => {
  const battleId = "battle_2b_1";

  test("an admin CAN create a battle with the required initial state:DRAFT", async () => {
    const adminDb = testEnv.authenticatedContext("admin_1", { admin: true }).firestore();
    await assertSucceeds(adminDb.doc(`skillBattles/${battleId}`).set({ title: "Test", state: "DRAFT", isActive: false }));
  });

  test("an admin CANNOT create a battle with a non-DRAFT initial state via the client SDK", async () => {
    const adminDb = testEnv.authenticatedContext("admin_1", { admin: true }).firestore();
    await assertFails(adminDb.doc(`skillBattles/${battleId}`).set({ title: "Test", state: "OPEN", isActive: true }));
  });

  test("an admin's client SDK write CANNOT change battle state directly", async () => {
    await seed(async (db) => { await db.doc(`skillBattles/${battleId}`).set({ title: "Test", state: "DRAFT" }); });
    const adminDb = testEnv.authenticatedContext("admin_1", { admin: true }).firestore();
    await assertFails(adminDb.doc(`skillBattles/${battleId}`).update({ state: "OPEN" }));
  });

  test("an admin's client SDK CAN still edit other battle fields (skillId, scope, dates) unaffected by the state lock", async () => {
    await seed(async (db) => { await db.doc(`skillBattles/${battleId}`).set({ title: "Test", state: "DRAFT" }); });
    const adminDb = testEnv.authenticatedContext("admin_1", { admin: true }).firestore();
    await assertSucceeds(adminDb.doc(`skillBattles/${battleId}`).update({
      skillId: "singing", scope: { type: "class", classFilter: ["8"] },
    }));
  });

  test("a student CANNOT change battle state either", async () => {
    await seed(async (db) => { await db.doc(`skillBattles/${battleId}`).set({ title: "Test", state: "DRAFT" }); });
    const db = testEnv.authenticatedContext("some_student").firestore();
    await assertFails(db.doc(`skillBattles/${battleId}`).update({ state: "OPEN" }));
  });

  test("the stateTransitions audit subcollection is admin-read-only, never client-writable (even by admin)", async () => {
    await seed(async (db) => {
      await db.doc(`skillBattles/${battleId}/stateTransitions/t1`).set({ fromState: "DRAFT", toState: "SCHEDULED" });
    });
    const adminDb = testEnv.authenticatedContext("admin_1", { admin: true }).firestore();
    await assertSucceeds(adminDb.doc(`skillBattles/${battleId}/stateTransitions/t1`).get());
    await assertFails(adminDb.doc(`skillBattles/${battleId}/stateTransitions/t2`).set({ fromState: "SCHEDULED", toState: "OPEN" }));
    const studentDb = testEnv.authenticatedContext("some_student").firestore();
    await assertFails(studentDb.doc(`skillBattles/${battleId}/stateTransitions/t1`).get());
  });
});

// ─── Phase 2C — Battle Engine: every collection is client-read-only,
// Admin-SDK-write-only. All mutation goes through functions/src/battle*.ts
// callables (createBattleSubmission, reviewBattleSubmission,
// engageBattleSubmission, finalizeBattleResults, claimBattleReward) — the
// offline suite (battleSubmissions/Engagement/Finalization/Rewards.test.ts)
// covers THOSE callables' business logic; these tests cover the one thing
// only the real rules can prove: that direct client writes are impossible,
// admin included, for every collection this engine introduced.
describe("Battle Engine (Phase 2C) — every new collection is write:false, even for admin", () => {
  const battleId = "engine_battle_1";
  const studentUid = "engine_student";

  test("submissions/{id} — signed-in read allowed, direct client write always denied", async () => {
    await seed(async (db) => {
      await db.doc(`submissions/${battleId}_${studentUid}`).set({ studentId: studentUid, battleId, status: "PENDING_MODERATION" });
    });
    const studentDb = testEnv.authenticatedContext(studentUid).firestore();
    await assertSucceeds(studentDb.doc(`submissions/${battleId}_${studentUid}`).get());
    await assertFails(studentDb.doc(`submissions/${battleId}_${studentUid}`).update({ status: "APPROVED" }));

    const adminDb = testEnv.authenticatedContext("admin_1", { admin: true }).firestore();
    await assertFails(adminDb.doc(`submissions/${battleId}_${studentUid}`).update({ status: "APPROVED" }));
  });

  test("submissions/{id}/engagements/{id} — read allowed, write always denied (Attack: fake a like)", async () => {
    const studentDb = testEnv.authenticatedContext(studentUid).firestore();
    await assertFails(studentDb.doc(`submissions/${battleId}_owner/engagements/like_${studentUid}`).set({ studentId: studentUid, type: "like" }));
  });

  test("battleScoreEntries/{id} — Attack 9/10: cannot set score/rank directly", async () => {
    await seed(async (db) => { await db.doc(`battleScoreEntries/${battleId}_${studentUid}`).set({ battleId, studentId: studentUid, score: 1 }); });
    const studentDb = testEnv.authenticatedContext(studentUid).firestore();
    await assertSucceeds(studentDb.doc(`battleScoreEntries/${battleId}_${studentUid}`).get());
    await assertFails(studentDb.doc(`battleScoreEntries/${battleId}_${studentUid}`).update({ score: 999999 }));
    const adminDb = testEnv.authenticatedContext("admin_1", { admin: true }).firestore();
    await assertFails(adminDb.doc(`battleScoreEntries/${battleId}_${studentUid}`).update({ score: 999999 }));
  });

  test("battleResults/{battleId} — Attack 12: cannot modify a finalized result, even as admin", async () => {
    await seed(async (db) => { await db.doc(`battleResults/${battleId}`).set({ battleId, status: "locked", entries: [] }); });
    const adminDb = testEnv.authenticatedContext("admin_1", { admin: true }).firestore();
    await assertSucceeds(adminDb.doc(`battleResults/${battleId}`).get());
    await assertFails(adminDb.doc(`battleResults/${battleId}`).update({ entries: [{ studentId: "attacker", rank: 1, isWinner: true }] }));
  });

  test("battleAwards/{id} — Attack 14: owner can read their own, a different student cannot read it, nobody can write", async () => {
    await seed(async (db) => { await db.doc(`battleAwards/${battleId}_${studentUid}`).set({ uid: studentUid, coins: 500 }); });
    const ownerDb = testEnv.authenticatedContext(studentUid).firestore();
    await assertSucceeds(ownerDb.doc(`battleAwards/${battleId}_${studentUid}`).get());
    await assertFails(ownerDb.doc(`battleAwards/${battleId}_${studentUid}`).update({ coins: 999999 }));

    const strangerDb = testEnv.authenticatedContext("someone_else").firestore();
    await assertFails(strangerDb.doc(`battleAwards/${battleId}_${studentUid}`).get());
  });

  test("skillPoints/{id} and achievementEvents/{id} — read allowed, write always denied (Attack 16: forge SkillBoard progression)", async () => {
    await seed(async (db) => {
      await db.doc(`skillPoints/${studentUid}_singing`).set({ studentId: studentUid, skillId: "singing", totalPoints: 5 });
    });
    const studentDb = testEnv.authenticatedContext(studentUid).firestore();
    await assertSucceeds(studentDb.doc(`skillPoints/${studentUid}_singing`).get());
    await assertFails(studentDb.doc(`skillPoints/${studentUid}_singing`).update({ totalPoints: 999999 }));
    await assertFails(studentDb.doc(`achievementEvents/${battleId}_${studentUid}_winner`).set({
      studentId: studentUid, battleId, ruleId: "winner",
    }));
  });
});

// ─── VidyaStar Phase 1 — Critical Security & Score Integrity Repair ────────
// See functions/src/submitVidyastarContestQuiz.ts's header comment for the
// full vulnerability this closes: the client used to be able to read the
// contest quiz's answer key directly (this doc was world-readable) and
// assert its own score/correctness, which the grading function trusted.
describe("contests/{id}/lessons and lessonAnswers — answer-key lockdown", () => {
  const contestId = "contest_1";
  const uid = "student_quiz";

  test("a student CANNOT read the (now-sanitized) public lesson doc directly", async () => {
    await seed(async (db) => {
      await db.doc(`contests/${contestId}/lessons/English`).set({
        status: "completed",
        lessonJson: { quiz: [{ question: "2+2?", options: ["3", "4"] }] },
      });
    });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`contests/${contestId}/lessons/English`).get());
  });

  test("a student CANNOT read the private answer-key doc", async () => {
    await seed(async (db) => {
      await db.doc(`contests/${contestId}/lessonAnswers/English`).set({
        answerKey: [{ correctAnswerIndex: 1, explanation: "2+2=4" }],
      });
    });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`contests/${contestId}/lessonAnswers/English`).get());
  });

  test("a student CANNOT write to either collection", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`contests/${contestId}/lessons/English`).set({ lessonJson: {} }));
    await assertFails(db.doc(`contests/${contestId}/lessonAnswers/English`).set({ answerKey: [] }));
  });

  test("even an admin's client SDK cannot read the private answer key — Admin SDK only, no admin-claim exception carved out", async () => {
    await seed(async (db) => {
      await db.doc(`contests/${contestId}/lessonAnswers/English`).set({ answerKey: [{ correctAnswerIndex: 0, explanation: "" }] });
    });
    const adminAuthDb = testEnv.authenticatedContext("admin_uid", { admin: true }).firestore();
    await assertFails(adminAuthDb.doc(`contests/${contestId}/lessonAnswers/English`).get());
  });
});

describe("contests/{id}/participant/{uid} — score/rank/result forgery prevention", () => {
  const contestId = "contest_2";
  const uid = "student_join";

  test("a student CANNOT create their own participant doc directly (join is Cloud-Function-only)", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(
      db.doc(`contests/${contestId}/participant/${uid}`).set({
        userId: uid, contestId, joinedAt: new Date(), score: 0, completed: false, entryFeePaid: 0,
      })
    );
  });

  test("a student CANNOT forge their own score/rank/completed on an existing participant doc (submission is Cloud-Function-only)", async () => {
    await seed(async (db) => {
      await db.doc(`contests/${contestId}/participant/${uid}`).set({
        userId: uid, contestId, score: 0, completed: false,
      });
    });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`contests/${contestId}/participant/${uid}`).update({ score: 999999, completed: true, rank: 1 }));
  });

  // VidyaStar Phase 2 — Test 12 (security). finalRank is the new
  // permanent-rank field written only by functions/src/
  // contestLeaderboard.ts's finalizeContest() via the Admin SDK. The
  // participant subcollection's blanket `allow update: if false` already
  // covers this generically (any field, not just finalRank) — this test
  // documents that guarantee explicitly for the new field by name, rather
  // than relying on the reader to infer it from the more general test
  // above.
  test("a student CANNOT write finalRank directly, even alone with no other fields", async () => {
    await seed(async (db) => {
      await db.doc(`contests/${contestId}/participant/${uid}`).set({
        userId: uid, contestId, score: 80, completed: true,
      });
    });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`contests/${contestId}/participant/${uid}`).update({ finalRank: 1 }));
  });

  test("a student CAN still read participant docs (per-contest leaderboard needs this)", async () => {
    await seed(async (db) => {
      await db.doc(`contests/${contestId}/participant/${uid}`).set({ userId: uid, contestId, score: 40 });
    });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc(`contests/${contestId}/participant/${uid}`).get());
  });
});

describe("leaderboard/{tab}/entries/{uid} — Starboard points forgery prevention", () => {
  const uid = "student_star";

  test("a student CANNOT write their own Starboard points directly", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`leaderboard/daily/entries/${uid}`).set({ points: 999999, name: "Cheater" }));
  });

  test("a student CANNOT increment their own points on an existing entry", async () => {
    await seed(async (db) => { await db.doc(`leaderboard/daily/entries/${uid}`).set({ points: 10, name: "Real" }); });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`leaderboard/daily/entries/${uid}`).update({ points: 999999 }));
  });

  test("a student CAN still read Starboard entries (the whole point of the leaderboard)", async () => {
    await seed(async (db) => { await db.doc(`leaderboard/daily/entries/${uid}`).set({ points: 10, name: "Real" }); });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc(`leaderboard/daily/entries/${uid}`).get());
  });
});

// ─── contests/{id}.banners — Phase 1 compatibility fix ─────────────────────
// useContestBanner.ts now reads bannerMeta off the contest doc itself
// (contests/{id}.banners.{language}) instead of the now-deny-all
// contests/{id}/lessons/{language} — see that hook's header comment. This
// only re-verifies that field didn't accidentally become client-writable
// by piggybacking on the doc's existing narrow joinedCount-only exception.
describe("contests/{id}.banners — not client-writable", () => {
  const contestId = "contest_banner_1";
  const uid = "student_banner";

  test("a student CANNOT write contests/{id}.banners directly", async () => {
    await seed(async (db) => {
      await db.doc(`contests/${contestId}`).set({ title: "x", joinedCount: 0, totalSpots: 100 });
    });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(db.doc(`contests/${contestId}`).update({ banners: { English: { emoji: "🔥" } } }));
  });

  test("a student CAN still read contests/{id}.banners (the whole point of the fix)", async () => {
    await seed(async (db) => {
      await db.doc(`contests/${contestId}`).set({ title: "x", banners: { English: { emoji: "🔥", tagline: "t", gradientStart: "#000", gradientEnd: "#fff" } } });
    });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc(`contests/${contestId}`).get());
  });

  test("the existing joinedCount-increment exception still works unaffected", async () => {
    await seed(async (db) => {
      await db.doc(`contests/${contestId}`).set({ title: "x", joinedCount: 0, totalSpots: 100 });
    });
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc(`contests/${contestId}`).update({ joinedCount: 1, updatedAt: new Date() }));
  });
});

// ─── prizeClaims/{claimId} — My Prizes / claim-flow regression ─────────────
// Added alongside the fix for the missing prizeClaims(uid,wonAt) composite
// index that was silently breaking My Prizes for every student (the
// listener errored and the UI fell through to the "no prizes" empty
// state — see apps/mobile/app/my-prizes.tsx and apps/web's mirror). The
// rules themselves were already correct; this just gives them the same
// regression coverage every other sensitive collection in this file has,
// so a future change here fails a test instead of shipping quietly.
describe("prizeClaims/{claimId} — ownership, claim transition, duplicate-claim prevention", () => {
  const winnerUid = "student_winner";
  const otherUid  = "student_other";
  const claimId   = "monthly_2026-09_student_winner";

  async function seedUnclaimed() {
    await seed(async (db) => {
      await db.doc(`prizeClaims/${claimId}`).set({
        uid: winnerUid,
        prizeType: "physical",
        prizeValue: "Wireless Earbuds",
        medalEmoji: "🥇",
        rank: 1,
        periodType: "monthly",
        periodKey: "monthly_2026-09",
        payoutLabel: "September Starboard Prizes",
        status: "unclaimed",
        wonAt: new Date(),
      });
    });
  }

  test("the winner CAN read their own prize", async () => {
    await seedUnclaimed();
    const db = testEnv.authenticatedContext(winnerUid).firestore();
    await assertSucceeds(db.doc(`prizeClaims/${claimId}`).get());
  });

  test("a different student CANNOT read someone else's prize (Test 6: access denied)", async () => {
    await seedUnclaimed();
    const db = testEnv.authenticatedContext(otherUid).firestore();
    await assertFails(db.doc(`prizeClaims/${claimId}`).get());
  });

  test("a student CANNOT create their own prizeClaims doc (admin-only creation)", async () => {
    const db = testEnv.authenticatedContext(winnerUid).firestore();
    await assertFails(db.doc(`prizeClaims/self_awarded`).set({
      uid: winnerUid, prizeType: "physical", prizeValue: "Free Phone",
      rank: 1, periodType: "monthly", periodKey: "monthly_2026-09", status: "unclaimed",
    }));
  });

  test("the winner CAN submit a claim (unclaimed → claimed, claimInfo + status only)", async () => {
    await seedUnclaimed();
    const db = testEnv.authenticatedContext(winnerUid).firestore();
    await assertSucceeds(db.doc(`prizeClaims/${claimId}`).update({
      status: "claimed",
      claimInfo: { name: "Winner Name", address: "123 Main St", whatsapp: "9876543210", email: "winner@example.com" },
    }));
  });

  test("a different student CANNOT claim someone else's prize", async () => {
    await seedUnclaimed();
    const db = testEnv.authenticatedContext(otherUid).firestore();
    await assertFails(db.doc(`prizeClaims/${claimId}`).update({
      status: "claimed",
      claimInfo: { name: "Impostor", address: "Nowhere", whatsapp: "9999999999", email: "x@example.com" },
    }));
  });

  test("Test 4: the SAME student CANNOT claim an already-claimed prize again (duplicate prevented)", async () => {
    await seed(async (db) => {
      await db.doc(`prizeClaims/${claimId}`).set({
        uid: winnerUid, prizeType: "physical", prizeValue: "Wireless Earbuds",
        rank: 1, periodType: "monthly", periodKey: "monthly_2026-09", status: "claimed",
        claimInfo: { name: "Winner Name", address: "123 Main St", whatsapp: "9876543210", email: "winner@example.com" },
        wonAt: new Date(),
      });
    });
    const db = testEnv.authenticatedContext(winnerUid).firestore();
    await assertFails(db.doc(`prizeClaims/${claimId}`).update({
      status: "claimed",
      claimInfo: { name: "Winner Name", address: "A different address now", whatsapp: "9876543210", email: "winner@example.com" },
    }));
  });

  test("a student CANNOT skip straight to a later status (e.g. \"delivered\")", async () => {
    await seedUnclaimed();
    const db = testEnv.authenticatedContext(winnerUid).firestore();
    await assertFails(db.doc(`prizeClaims/${claimId}`).update({
      status: "delivered",
      claimInfo: { name: "Winner Name", address: "123 Main St", whatsapp: "9876543210", email: "winner@example.com" },
    }));
  });

  test("a student CANNOT touch fields outside claimInfo/status (e.g. forge prizeValue or rank)", async () => {
    await seedUnclaimed();
    const db = testEnv.authenticatedContext(winnerUid).firestore();
    await assertFails(db.doc(`prizeClaims/${claimId}`).update({
      status: "claimed",
      prizeValue: "Free Car",
      claimInfo: { name: "Winner Name", address: "123 Main St", whatsapp: "9876543210", email: "winner@example.com" },
    }));
  });

  test("a student CANNOT delete their own prize claim", async () => {
    await seedUnclaimed();
    const db = testEnv.authenticatedContext(winnerUid).firestore();
    await assertFails(db.doc(`prizeClaims/${claimId}`).delete());
  });
});
