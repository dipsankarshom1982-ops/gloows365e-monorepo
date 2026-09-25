// PATH: functions/rules-tests/onboarding.rules.test.ts
// Replays the exact students/{uid} write sequence of the Parent Profile →
// Phone Verification → Parent Permissions → Student Registration onboarding
// against the REAL firestore.rules (same harness as firestore.rules.test.ts).

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

afterAll(async () => { await testEnv.cleanup(); });
afterEach(async () => { await testEnv.clearFirestore(); });

const uid = "parent_onboarding_user";
const ts = "2026-09-25";

describe("students/{uid} — onboarding write sequence", () => {
  test("signup stub with onboardingStep is allowed", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc(`students/${uid}`).set({
      email: "p@example.com", role: "student", onboardingComplete: false,
      onboardingStep: "accountCreated", createdAt: ts,
    }));
  });

  test("full sequence: profile → phoneVerified → permissions → registration", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    const ref = db.doc(`students/${uid}`);
    await assertSucceeds(ref.set({
      email: "p@example.com", role: "student", onboardingComplete: false,
      onboardingStep: "accountCreated", createdAt: ts,
    }));
    await assertSucceeds(ref.set({
      parentGuardianName: "Asha Rao", parentRelationship: "Mother", parentPhone: "9876543210",
      parentPhoneVerified: false, onboardingStep: "parentProfileCompleted", updatedAt: ts,
    }, { merge: true }));
    await assertSucceeds(ref.set({
      parentPhone: "9876543210", parentPhoneVerified: true,
      onboardingStep: "phoneVerified", updatedAt: ts,
    }, { merge: true }));
    await assertSucceeds(ref.set({
      parentPermissions: {
        studentInfo: true, learningActivity: true, importantCommunications: true,
        promotionalCommunications: false, termsAccepted: true, privacyAccepted: true,
        policyVersion: "2026-07-17", respondedAt: ts,
      },
      parentalConsent: { granted: true, grantedAt: ts, parentPhone: "9876543210", policyVersion: "2026-07-17" },
      onboardingStep: "parentPermissionsCompleted", updatedAt: ts,
    }, { merge: true }));
    await assertSucceeds(ref.set({
      name: "Ravi", title: "Mr", phone: "9876543210", school: "DPS", board: "CBSE", section: "",
      class: "8", stream: null, preferredLanguage: "English", profilePic: "",
      dob: "01/01/2014", age: 12, location: { state: "KA", district: "B", area: "C", pincode: "560001" },
      interests: [], stats: { xp: 0, level: 1, streak: 0 }, learningProfile: { goal: "x", dailyTarget: 30 },
      onboardingStep: "studentRegistration", onboardingComplete: true, createdAt: ts,
    }, { merge: true }));
  });

  test("Google/no-stub path: Parent Profile write creates the doc", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc(`students/${uid}`).set({
      parentGuardianName: "Asha Rao", parentRelationship: "Mother", parentPhone: "9876543210",
      parentPhoneVerified: false, onboardingStep: "parentProfileCompleted", updatedAt: ts,
    }, { merge: true }));
  });

  test("server-only fields stay blocked during onboarding", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(db.doc(`students/${uid}`).set({ email: "p@example.com", role: "student", onboardingComplete: false }));
    await assertFails(db.doc(`students/${uid}`).update({ studentId: "GLS000001" }));
    await assertFails(db.doc(`students/${uid}`).update({ learnScore: 99999 }));
  });

  test("another user cannot write someone else's onboarding state", async () => {
    const other = testEnv.authenticatedContext("someone_else").firestore();
    await assertFails(other.doc(`students/${uid}`).set({ onboardingStep: "parentPermissionsCompleted" }, { merge: true }));
  });
});
