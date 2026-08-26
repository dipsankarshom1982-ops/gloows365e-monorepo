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
};

export const mockAdminModule = {
  firestore,
  apps: [{ name: "[DEFAULT]" }],
  initializeApp: () => ({}),
};
