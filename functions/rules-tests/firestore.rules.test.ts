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
