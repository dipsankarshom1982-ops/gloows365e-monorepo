// apps/web/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile shared-logic workspace package
  transpilePackages: ["@gloows/shared-logic"],

  // Enable React strict mode for better dev warnings
  reactStrictMode: true,

  // Image optimization — allow Firebase Storage domain
  images: {
    domains: [
      "firebasestorage.googleapis.com",
      "customer-cif09s9962jkfc36.cloudflarestream.com",
      "imagedelivery.net",
    ],
  },

  // Environment variables available on client
  env: {
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  },
};

export default nextConfig;
