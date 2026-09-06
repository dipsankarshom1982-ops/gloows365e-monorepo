// PATH: functions/src/__tests__/helpers/mockFirebaseAdmin.ts
//
// Factory for the `jest.mock("firebase-admin", ...)` replacement used by
// the offline (no-emulator) function-logic tests. Each test file does:
//
//   jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);
//   import { fakeDb } from "./helpers/mockFirebaseAdmin";
//
// `fakeDb` is a singleton FakeFirestore for the lifetime of that test
// file's module registry — call fakeDb.reset() in afterEach so tests don't
// leak state into each other.

import { FakeFirestore, FakeTimestamp, SERVER_TIMESTAMP } from "./fakeFirestore";

export const fakeDb = new FakeFirestore();

function firestore() {
  return fakeDb;
}
firestore.FieldValue = {
  serverTimestamp: () => SERVER_TIMESTAMP,
  increment: (n: number) => ({ __increment: n }),
};
firestore.Timestamp = {
  now: () => FakeTimestamp.now(),
  fromMillis: (ms: number) => FakeTimestamp.fromMillis(ms),
  fromDate: (d: Date) => FakeTimestamp.fromDate(d),
};

// Minimal in-memory Auth-user directory for tests exercising
// refundSearch.ts's email→uid resolution and uid→email display lookup —
// real firebase-admin's Auth API, just backed by a plain Map instead of a
// live project. seedAuthUser()/resetAuthUsers() are test-only helpers, not
// part of the real Admin SDK surface.
interface FakeAuthUser { uid: string; email: string; customClaims?: Record<string, unknown> }
const authUsers = new Map<string, FakeAuthUser>(); // keyed by uid
const authUsersByEmail = new Map<string, FakeAuthUser>();

export function seedAuthUser(uid: string, email: string, customClaims?: Record<string, unknown>) {
  const u: FakeAuthUser = { uid, email, ...(customClaims ? { customClaims } : {}) };
  authUsers.set(uid, u);
  authUsersByEmail.set(email, u);
}
export function resetAuthUsers() {
  authUsers.clear();
  authUsersByEmail.clear();
}

function auth() {
  return {
    async getUser(uid: string) {
      const u = authUsers.get(uid);
      if (!u) throw Object.assign(new Error("no user"), { code: "auth/user-not-found" });
      return u;
    },
    async getUserByEmail(email: string) {
      const u = authUsersByEmail.get(email);
      if (!u) throw Object.assign(new Error("no user"), { code: "auth/user-not-found" });
      return u;
    },
    // Test-only stand-in for the real Admin SDK's setCustomUserClaims —
    // mutates the same in-memory record getUser() reads back, so a test
    // can assert on the post-call claims via a follow-up getUser().
    async setCustomUserClaims(uid: string, claims: Record<string, unknown> | null) {
      const u = authUsers.get(uid);
      if (!u) throw Object.assign(new Error("no user"), { code: "auth/user-not-found" });
      u.customClaims = claims ?? {};
    },
  };
}

export const mockAdminModule = {
  firestore,
  auth,
  apps: [{ name: "[DEFAULT]" }],
  initializeApp: () => ({}),
};
