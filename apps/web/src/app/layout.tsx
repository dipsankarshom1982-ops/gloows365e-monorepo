// PATH: apps/web/src/app/layout.tsx
// Root layout — registers service worker for PWA installability
//
// FEATURE: added <UpdateToast /> — listens for the SW_UPDATED message
// sw.js posts after activating a new CACHE_VERSION, and shows a small
// "tap to refresh" banner. Without it, testers installing this as a PWA
// had no way to know a new build had landed short of manually clearing
// the cache. See components/UpdateToast.tsx.
//
// FEATURE: added <InstallDialog /> — shows an upfront "Install
// Gloows365E?" Yes/No prompt on page load, site-wide, replacing the old
// secondary "Install App" button that used to live only on the welcome
// screen (removed from welcome/page.tsx). See components/InstallDialog.tsx
// for the full state machine (already installed / never installed /
// installed-then-removed / iOS manual steps).

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import UpdateToast from "@/components/UpdateToast";
import InstallDialog from "@/components/InstallDialog";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gloows365E — Learn · Compete · Earn",
  description: "AI-powered learning platform for Indian students Class 6–12",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Gloows365E",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* PWA icons for iOS */}
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <UpdateToast />
        <InstallDialog />

        {/* Register service worker */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function(e) {
                console.warn('SW registration failed:', e);
              });
            });
          }
        `}} />
      </body>
    </html>
  );
}