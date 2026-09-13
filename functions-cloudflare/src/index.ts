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
// point of view — the very first load of them pays a one-time filesystem-
// scan tax that, reproduced locally (2026-09) immediately after a real
// install+build, measured 6-14 SECONDS — i.e. it can still blow
// Firebase's ~10s discovery budget on its own, the exact failure mode
// this codebase was built to avoid, just at a smaller scale.
//
// A first version of this step ran a plain `node "$RESOURCE_DIR/lib/index.js"`
// — that is NOT enough on its own, and shipping it as "fixed" without
// re-verifying against the real discovery mechanism cost a second failed
// deploy. A plain require of our own compiled output never touches
// express or firebase-functions' own internal runtime/bin machinery
// (runtime/loader.js, runtime/manifest.js, params/index.js,
// security/roles.js, common/api.js, lifecycle/index.js, its rolldown
// runtime bundle) — those files are only loaded by firebase-functions'
// OWN discovery binary (node_modules/firebase-functions/lib/bin/
// firebase-functions.js), which is what Firebase's real discovery step
// actually spawns, never by our code directly (confirmed via
// require.cache inspection: express/runtime-loader are absent after a
// plain require of lib/index.js). Left cold, that gap alone reproduced
// 8.5s+ real discovery time even with our own code's files fully warm.
//
// The fix, scripts/warmDiscovery.js, runs that SAME real discovery
// binary once during predeploy (spawn -> poll /__/functions.yaml -> kill)
// so every file the real, timed discovery step touches is already
// OS-cached moments later — see that script's own header for the full
// mechanism. Do not remove this step or revert it to a plain require.
//
// HONEST RESIDUAL RISK (2026-09, this exact dev machine): even with this
// warm-up in place, repeated full clean trials (fresh install+build+
// warm-up, then a genuinely separate real-discovery-binary spawn) were
// NOT uniformly fast — most were ~0.5-1.1s, but two independent trials
// still measured 11.3s and 14.2s, over budget, apparently from residual
// antivirus/filesystem-scan variance this warm-up step cannot fully
// eliminate on this machine. This is a real, irreducible-so-far
// environment cost, not a code defect — recommend also setting the
// FUNCTIONS_DISCOVERY_TIMEOUT env var (read directly by firebase-tools'
// discovery/index.js, e.g. `$env:FUNCTIONS_DISCOVERY_TIMEOUT = "30"` in
// PowerShell before `firebase deploy`) as a safety margin on top of this
// warm-up, not instead of it.

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
