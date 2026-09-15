// PATH: functions/src/financial/index.ts
//
// Phase A1 — Financial Domain Foundation. Barrel export for the financial
// domain module, mirroring how other multi-file areas of this codebase are
// consumed (import from the folder, not each file individually). Nothing
// here is imported by functions/src/index.ts yet — no Cloud Function in
// this phase depends on this module; a future phase wires it in.
export * from "./statuses";
export * from "./money";
export * from "./types";
export * from "./commission";
export * from "./validation";
export * from "./audit";
export * from "./bookingPaymentConfig";
export * from "./paymentAttempt";
export * from "./webhookVerification";
export * from "./webhookEvent";
