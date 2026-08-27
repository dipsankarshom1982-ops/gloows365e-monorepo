// PATH: apps/web/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export — required for Firebase Hosting (no Node server).
  //
  // IMPORTANT: only enable this for `next build` (production), not for
  // `next dev`. `next dev` always runs a real Node dev server regardless of
  // this setting — there's no "static dev mode" — but `output: "export"`
  // still changes how some packages' `exports` conditions get resolved by
  // the dev server's bundler. For @firebase/auth specifically, this can
  // cause the dev bundle to pick up firebase/auth's non-browser build (the
  // one where signInWithPopup, browserPopupRedirectResolver, etc. are all
  // stubbed to throw/fail) for some chunks, while other chunks still get
  // the real browser build. The result: signInWithPopup gets called against
  // an Auth instance whose _popupRedirectResolver was never set by the real
  // browser code path, and Firebase's internal assertion throws
  // auth/argument-error — even though the same code works fine in a real
  // production build. Scoping `output: "export"` to NODE_ENV === "production"
  // keeps `next dev` on Next's normal Node-server module resolution, where
  // firebase/auth's browser build resolves correctly and signInWithPopup
  // behaves as expected, while still producing a static export for
  // `next build` / Firebase Hosting deploys.
  output: process.env.NODE_ENV === "production" ? "export" : undefined,
  trailingSlash: true,

  transpilePackages: ["@gloows/shared-logic"],
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },

  images: {
    // Static export requires unoptimized images
    unoptimized: true,
    domains: [
      "firebasestorage.googleapis.com",
      "customer-cif09s9962jkfc36.cloudflarestream.com",
      "imagedelivery.net",
      "i.pravatar.cc",
    ],
  },

  env: {
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  },
};

export default nextConfig;
