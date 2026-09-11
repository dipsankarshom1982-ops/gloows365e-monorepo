const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Shim assert v2 — its internal/errors dependency can't be resolved by Metro on Windows
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  assert: path.resolve(__dirname, 'shims/assert.js'),
};

// zustand's package.json "exports" map offers three conditions per
// subpath — "react-native", "import", "default" — with no "browser" entry.
// Metro's web platform only activates the "browser" condition by default,
// so for any `import … from "zustand/middleware"` (an ESM import, not a
// require() call — Metro tracks that per call site) it falls through past
// "react-native" straight to "import", which resolves to
// esm/middleware.mjs — a file with two raw top-level `import.meta.env`
// reads (Vite-only Redux DevTools detection inside zustand's `devtools`
// middleware, wrapped in try/catch there, which doesn't help: `import.meta`
// is a *parse*-time SyntaxError outside a real ES module, not a catchable
// runtime one). Metro bundles that file fine (it only transforms, never
// executes), but the browser refuses to run the resulting classic
// (non-`type="module"`) script — "Cannot use 'import.meta' outside a
// module" — which aborted the whole web bundle's evaluation and silently
// broke every onPress/onClick handler in the app on web, including
// ShikshaHub's Instant Tutor sheet and filter chips.
//
// apps/mobile/store/seekhoStore.ts and discoverStore.ts only import
// persist/createJSONStorage from this module, never devtools — but Metro
// bundles the whole target file regardless of which named exports are
// actually used, so the broken code shipped either way.
//
// Native (ios/android) never hit this: `unstable_conditionsByPlatform`
// already includes "react-native" there, and zustand lists that condition
// first in its exports map, so it wins before "import" is even
// considered. `extraNodeModules` alone does NOT fix this — Metro's
// package-exports resolution (unstable_enablePackageExports) runs before
// extraNodeModules is ever consulted, so it never gets a chance to
// override an already-successful exports-map resolution. A custom
// resolveRequest intercepting these two specifiers *before* Metro's
// default resolver runs is the only override that reliably wins. The
// target path is resolved via plain Node's require.resolve() (which has
// no "react-native"/"import" condition, so it naturally lands on
// "default" → the safe CJS file) rather than a hardcoded pnpm-hash path
// that would break on every reinstall — same file native already
// correctly uses, so this changes nothing for native.
const zustandCjsOverrides = {
  zustand: require.resolve('zustand'),
  'zustand/middleware': require.resolve('zustand/middleware'),
};
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const override = zustandCjsOverrides[moduleName];
  if (override) {
    return { type: 'sourceFile', filePath: override };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

// This app lives in a pnpm workspace alongside several unrelated apps
// (web, web365, admin, admin365, mobile365). Expo's monorepo auto-detection
// defaults config.watchFolders to the *entire* workspace — every sibling
// app's source tree and node_modules — so Metro crawls all of them on
// every start. Without Watchman installed (slow native fs crawl instead of
// a daemon), that made `expo start`/`expo export` appear to hang for
// minutes at "Starting Metro Bundler" before it ever got to bundling.
// Only watch this app itself plus the one workspace package it actually
// imports (@gloows/shared-logic) and the hoisted root node_modules.
config.watchFolders = [
  path.resolve(projectRoot, '../../node_modules'),
  path.resolve(projectRoot, '../../packages/shared-logic'),
  projectRoot,
];

// This app and apps/mobile365 live in the same pnpm workspace, so without
// explicit exclusions Metro's monorepo auto-detection can:
//   (a) watch/index apps/mobile365's entire source tree (its own app/
//       routes, components, etc.) alongside this app's, and
//   (b) index every react/react-native version from the shared root pnpm
//       store (node_modules/.pnpm), since that store holds every version
//       any workspace package needs — including mobile365's own
//       react@19.0.0 and admin's react@18.3.1, neither of which this app
//       (pinned to react@19.1.0) should ever load.
// Any of these can cause cross-app bundling: wrong RN internals getting
// served ("React Native version mismatch"), expo-router picking up
// mobile365's screens instead of this app's, or — the nastiest one —
// "Invalid hook call" / "Cannot read property 'useRef' of null" from two
// different React copies ending up in the same bundle.
// Block all of them explicitly so this app's bundle is fully isolated.
const siblingApp = path.resolve(projectRoot, '../mobile365');
const siblingAppPattern = new RegExp(
  `^${siblingApp.replace(/[/\\]/g, '[/\\\\]')}[/\\\\].*$`
);
const wrongReactNativeVersionPattern =
  /node_modules[\\/]\.pnpm[\\/][^\\/]*react-native@0\.77\.1[^\\/]*[\\/].*/;
const wrongReactVersionPattern =
  /node_modules[\\/]\.pnpm[\\/]react@(19\.0\.0|18\.3\.1)[\\/].*/;

config.resolver.blockList = [].concat(
  config.resolver.blockList || [],
  [siblingAppPattern, wrongReactNativeVersionPattern, wrongReactVersionPattern]
);

// This machine has ~4GB RAM total. Metro's default worker pool sizes to
// CPU core count, and each transform worker is its own Node/V8 process —
// on a box this tight that starves the system of memory mid-bundle
// (workers still alive but stop making progress; not a real hang, but
// indistinguishable from one without checking process memory). Capping
// worker count trades some bundle speed for not swapping to a crawl.
config.maxWorkers = 2;

module.exports = config;
