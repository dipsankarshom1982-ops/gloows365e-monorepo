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
//
// firebase.json's predeploy for this codebase — DO NOT "simplify" it back
// to `npm --prefix "$RESOURCE_DIR" install` (verified 2026-09, reproduced
// against the actual installed firebase-tools): firebase-tools spawns
// EVERY predeploy command with cwd = the Firebase project root (see
// deploy/lifecycleHooks.js's runTargetCommands — cwd is always
// overallOptions.config.projectDir, never $RESOURCE_DIR), not cwd =
// this directory. Since the project root's own package.json (name
// "gloows365e-monorepo") is npm's ancestor of this directory, running
// `npm --prefix "$RESOURCE_DIR" install` from that cwd makes npm silently
// add "gloows365e-monorepo": "file:.." to THIS package.json/lockfile and
// symlink the ENTIRE monorepo root into node_modules/gloows365e-monorepo
// — which is what turned a locally-verified ~0.5s cold require() into a
// production "Cannot determine backend specification. Timeout after
// 10000" on the very first real deploy, despite every local test passing.
// The fix is `cd "$RESOURCE_DIR" && npm install` instead — forces npm's
// own cwd to actually be this directory, which does not trigger the
// ancestor-package.json auto-link. Confirmed via firebase-tools' own
// cross-env-shell wrapper, not just a plain shell `cd`.
//
// There is a SECOND predeploy step for the same underlying reason this
// codebase exists: right after a fresh `npm install`+`tsc` build, the
// newly-written node_modules/lib files are "cold" from the OS/antivirus's
// point of view — the very first require() to touch them pays a one-time
// filesystem-scan tax that, reproduced locally (2026-09) immediately
// after a real install+build, measured 6-14 SECONDS even for this small,
// isolated closure — i.e. it can still blow Firebase's ~10s discovery
// budget on its own, the exact failure mode this codebase was built to
// avoid, just at a smaller scale. The third predeploy command,
// `node "$RESOURCE_DIR/lib/index.js"`, deliberately runs (and discards)
// this exact require() once during predeploy — which has NO fixed
// timeout — so that tax is already paid by the time Firebase's own,
// 10-second-budgeted discovery step runs moments later and finds
// everything already OS-cached (~0.5-0.8s, verified across repeated
// trials). Do not remove this step to "simplify" predeploy.

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
