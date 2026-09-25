// PATH: functions-cloudflare/scripts/warmDiscovery.js
//
// Predeploy warm-up step — see src/index.ts's header for the full story.
// A plain `node lib/index.js` (this codebase's PREVIOUS warm-up attempt)
// only touches the files OUR code requires (firebase-admin,
// firebase-functions/v1, jpeg-js, the moderation closure) — it does NOT
// touch express or firebase-functions' own internal runtime/bin machinery
// (runtime/loader.js, runtime/manifest.js, params/index.js,
// security/roles.js, common/api.js, lifecycle/index.js, the rolldown
// runtime bundle) that Firebase's REAL discovery step loads, because
// those files are only required by firebase-functions' OWN discovery
// binary (node_modules/firebase-functions/lib/bin/firebase-functions.js),
// never by our code directly. Confirmed via require.cache inspection
// (2026-09): after `require('./lib/index.js')`, express and
// runtime/loader.js are NOT in require.cache at all.
//
// Left cold, that gap alone reproduced a real, ~8.5s-and-up discovery
// time even with our own code's files fully warm — enough to still blow
// Firebase's ~10s discovery budget on a real deploy, which is exactly
// what happened: this codebase's first real deploy still timed out after
// the previous (incomplete) warm-up fix.
//
// This script closes that gap by running the SAME discovery binary
// Firebase itself will run (spawn -> poll /__/functions.yaml -> kill),
// once, during predeploy (unbounded time) — so every file the real,
// timed discovery step touches is already OS-cached by the time it runs
// moments later.
"use strict";

const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const FUNCTIONS_DIR = path.resolve(__dirname, "..");
// firebase-functions' package.json "exports" map does not expose either
// ./lib/bin/firebase-functions.js or ./package.json as public subpaths,
// so neither can be require.resolve()'d directly. Resolve the package's
// normal (exported) main entry instead and derive the package root from
// it by string position — the same technique firebase-tools' own
// node/index.js (findFunctionsBinary) uses to locate this exact binary.
const sdkEntry = require.resolve("firebase-functions", { paths: [FUNCTIONS_DIR] });
const nodeModulesEnd = sdkEntry.lastIndexOf("node_modules") + "node_modules".length;
const packageRoot = path.join(sdkEntry.slice(0, nodeModulesEnd), "firebase-functions");
const BIN_PATH = path.join(packageRoot, "lib", "bin", "firebase-functions.js");

// No fixed port is reserved for this codebase, and nothing else needs to
// coordinate with it — ask the OS for any free port rather than risk a
// collision with a hardcoded one.
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

function pollManifest(port, deadline) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get({ host: "127.0.0.1", port, path: "/__/functions.yaml", timeout: 2000 }, (res) => {
        res.resume(); // discard body — this script only needs the files touched, not the content.
        if (res.statusCode === 200) return resolve();
        if (Date.now() > deadline) return reject(new Error(`Warm-up manifest request returned HTTP ${res.statusCode}`));
        setTimeout(attempt, 200);
      });
      req.on("error", () => {
        if (Date.now() > deadline) return reject(new Error("Warm-up manifest request timed out waiting for the server to start"));
        setTimeout(attempt, 200);
      });
      req.on("timeout", () => req.destroy());
    };
    attempt();
  });
}

async function main() {
  const port = await getFreePort();
  const child = spawn(process.execPath, [BIN_PATH, FUNCTIONS_DIR], {
    cwd: FUNCTIONS_DIR,
    env: { ...process.env, FUNCTIONS_CONTROL_API: "true", PORT: String(port) },
    stdio: "ignore",
  });

  // 60s is generous on purpose — this runs during predeploy, which has no
  // fixed timeout, and a cold antivirus scan of a freshly-installed
  // node_modules tree is exactly the slow case this script exists to
  // absorb here instead of during Firebase's own 10s-budgeted discovery.
  const deadline = Date.now() + 60000;
  try {
    await pollManifest(port, deadline);
    console.log("functions-cloudflare: discovery warm-up succeeded — real discovery should now hit a warm filesystem cache.");
  } catch (e) {
    // Non-fatal by design: if this ever fails (e.g. a genuine code error),
    // let Firebase's own discovery step surface the real error message
    // instead of failing the build on a best-effort optimization step.
    console.warn("functions-cloudflare: discovery warm-up did not complete cleanly (continuing anyway):", e.message);
  } finally {
    child.kill();
  }
}

main();
