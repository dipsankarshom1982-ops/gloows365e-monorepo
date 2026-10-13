/** @type {import('jest').Config} */
// Firestore-rules suite config — real firestore.rules against the real
// Firestore emulator via @firebase/rules-unit-testing. Requires JDK 21+
// (`firebase emulators:exec`'s current minimum); run via `npm run
// test:rules`, which wraps this in emulators:exec so FIRESTORE_EMULATOR_HOST
// is set automatically. See rules-tests/firestore.rules.test.ts's header.
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/rules-tests/**/*.test.ts"],
  testTimeout: 20000,
  // Same broken/unusable watchman install as jest.config.js — see its
  // comment. Unrelated to the code under test.
  watchman: false,
};
