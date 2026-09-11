// PATH: apps/tutor/next.config.ts
// Mirrors apps/web/next.config.ts's config exactly — same static-export/
// Firebase-Auth-popup-resolver reasoning applies identically here, since
// this app shares the same Firebase project/Auth setup as apps/web. See
// that file's comments for the full "why" on each setting below.
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === "production" ? "export" : undefined,
  trailingSlash: true,

  transpilePackages: ["@gloows/shared-logic", "@gloows/tutor-i18n", "@gloows/tutor-ui"],
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },

  images: {
    unoptimized: true,
    domains: ["firebasestorage.googleapis.com"],
  },

  env: {
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  },
};

export default nextConfig;
