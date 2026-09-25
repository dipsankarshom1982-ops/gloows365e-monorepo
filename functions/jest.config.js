/** @type {import('jest').Config} */
// Default config: the OFFLINE function-logic suite (firebase-admin mocked
// onto an in-memory FakeFirestore — see src/__tests__/helpers/, no
// emulator, no Java requirement). Run via `npm test`.
//
// The Firestore-rules suite (rules-tests/, real firestore.rules against
// the actual emulator) has its own config — jest.rules.config.js, run via
// `npm run test:rules` — because it needs `firebase emulators:exec` and
// JDK 21+, which this machine doesn't currently have. Kept as a separate
// config rather than folded in here so `npm test` never silently fails on
// an environment gap unrelated to the code.
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/src/__tests__/**/*.test.ts"],
  testTimeout: 20000,
  // This machine has a broken/unusable watchman install (spawn failure) —
  // unrelated to the code under test; jest's own file-watching fallback
  // works fine without it.
  watchman: false,
};
