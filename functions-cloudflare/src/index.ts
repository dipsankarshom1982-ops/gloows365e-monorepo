// PATH: functions-cloudflare/src/index.ts
//
// Entrypoint for the isolated "cloudflare-webhook" Firebase Functions
// codebase (see firebase.json). Exports ONLY handleCloudflareStreamWebhook
// — nothing else — so Firebase's backend-discovery step only has to
// require() this one function's small dependency closure (~9 files, see
// ./moderation/streamWebhook.ts and its header) instead of the ~190
// exports in the "default" codebase's functions/src/index.ts. That is the
// entire reason this codebase exists: functions/src/index.ts's discovery
// cold-loads in ~44s, well past Firebase's ~10s discovery budget, while
// this file's closure cold-loads in ~1.8s.
//
// Every file under ./moderation here is a MIRROR of the canonical
// implementation in functions/src/moderation — see each file's own
// header comment. This codebase must never diverge in BEHAVIOR from the
// canonical one; it exists only to change what Firebase has to discover,
// not what the webhook does.
//
// Do NOT add any other export here — a second export re-introduces
// exactly the "must discover everything in this file" cost this codebase
// was created to avoid, and pulls in whatever new dependency closure that
// export needs.

import * as admin from "firebase-admin";

// Mirrors functions/src/index.ts's own top-level admin.initializeApp()
// call (line 32 there) — streamWebhook.ts/auditLog.ts/videoSimilarityProvider.ts
// each call admin.firestore() at module-load time, which throws
// "The default Firebase app does not exist" unless initializeApp() has
// already run. Must stay ABOVE the export-from below: module evaluation
// order follows source order, so this needs to execute before the
// moderation modules' own top-level admin.firestore() calls do.
admin.initializeApp();

export { handleCloudflareStreamWebhook } from "./moderation/streamWebhook";
