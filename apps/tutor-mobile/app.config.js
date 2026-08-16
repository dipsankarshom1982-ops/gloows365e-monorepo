import "dotenv/config";

// Phase 1a: no custom icon/splash assets yet (deliberately deferred — spec
// section 53 "Store Readiness" is later-phase scope). Expo's own default
// placeholder icon/splash is fine for a dev build; add real branded
// assets and an eas.json before any store submission.
export default {
  expo: {
    name: "Gloows Tutor",
    slug: "gloows-tutor",
    version: "1.0.0",
    orientation: "portrait",
    // Own scheme/bundle id — a genuinely separate app identity from
    // apps/mobile's, even though it shares the same Firebase PROJECT (see
    // .env: same gloows-03b6sz project, different app shell).
    scheme: "gloowstutor",
    userInterfaceStyle: "dark",
    newArchEnabled: true,

    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.gloows365.tutor",
    },
    android: {
      edgeToEdgeEnabled: true,
      package: "com.gloows365.tutor",
    },
    web: {
      output: "static",
    },

    plugins: ["expo-router"],

    experiments: {
      typedRoutes: true,
    },
  },
};
