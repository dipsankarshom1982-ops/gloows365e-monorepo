// PATH: apps/web/public/sw.js
// Minimal service worker — makes the app installable as a PWA.
// Strategy: network-first for all requests, cache as fallback.
//
// FIX (icon 404 breaking install): PRECACHE referenced /icons/icon-192.png
// and /icons/icon-512.png, but the actual files live at /icon-192.png and
// /icon-512.png (no /icons/ folder — see manifest.json and public/). Some
// browsers reject the ENTIRE precache if even one entry 404s, which could
// silently break "Add to Home Screen" / installability. Paths corrected.
//
// FEATURE (tester builds — "they should get updates without manually
// clearing cache"): CACHE_VERSION is the one thing to bump on each deploy
// you want testers to immediately pick up. On activate, the SW now tells
// every open tab a new version is ready (postMessage), so the page can show
// a "New version available — tap to refresh" toast instead of testers
// being stuck on a stale cached build with no idea why a fix "isn't there."
//
// FIX (production, 2026-09-06 — raw RSC/Flight text shown instead of the
// app): apps/web is a static export (output: "export"); every app-router
// route ships a sibling "<route>/index.txt" file alongside its
// "<route>/index.html" — the serialized RSC/Flight payload Next's
// client-side router fetches for soft (Link/router.push) navigation. That
// fetch includes the *build ID* the payload was generated with. If a
// visitor's tab is still running JS from a build that's now older than
// what's live (i.e. we shipped a new deploy while their tab was open —
// exactly what's been happening during this incident's back-to-back
// hotfixes) and they click any internal link, Next detects the build-ID
// mismatch and intentionally falls back to a hard navigation to force a
// fresh load — but a bug in Next's static-export router (confirmed by
// reading the compiled chunk locally) makes it hard-navigate the browser
// to the *.txt payload's own URL* instead of the real page URL. Firebase
// Hosting correctly serves that .txt file as text/plain (it *is* a plain
// text file — there's no Next.js server here to content-negotiate it),
// so the browser renders the raw Flight payload — "1:\"$Sreact.fragment\"",
// chunk paths, the embedded 404 boundary text, etc. — instead of the app.
//
// No Cloudflare is in front of app.gloows365.in (DNS resolves straight to
// Firebase Hosting's own IPs; response headers confirm it), so this isn't
// a CDN cache-key issue — it only reproduces on a real top-level
// navigation to one of these .txt files. A same-origin GET whose
// request.mode is "navigate" is always a genuine address-bar/document
// load; Next's own internal RSC fetch() for these same .txt files never
// uses that mode. So: catch exactly that case here and redirect it back
// to the real page instead of letting the browser render raw text. This
// cannot affect Next's legitimate fetch()-based RSC retrieval — different
// request mode entirely — and there are no other .txt files anywhere in
// this app's public/ or export output, so nothing legitimate is caught by
// this net.

const CACHE_VERSION = "v6"; // ← bump this string on every deploy
const CACHE = `gloows365e-${CACHE_VERSION}`;

const PRECACHE = [
  "/",
  "/home/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// Install — precache shell
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// Activate — clean old caches, then tell open tabs a new version landed
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => {
        clients.forEach((client) => client.postMessage({ type: "SW_UPDATED", version: CACHE_VERSION }));
      })
  );
});

// Fetch — network first, fallback to cache
self.addEventListener("fetch", (e) => {
  // Only handle GET requests on our own origin
  if (e.request.method !== "GET") return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  // Guard against the stale-build RSC/Flight-payload-as-navigation bug
  // described above — see the CACHE_VERSION comment for the full
  // explanation. `mode: "navigate"` only happens for a real top-level
  // document load (address bar, link click, reload) — never for Next's
  // own fetch()-based RSC retrieval — so this can only intercept the
  // broken case.
  if (e.request.mode === "navigate") {
    const url = new URL(e.request.url);
    if (url.pathname.endsWith("/index.txt") || url.pathname.endsWith(".txt")) {
      const clean = url.pathname.endsWith("/index.txt")
        ? url.pathname.slice(0, -"index.txt".length)
        : url.pathname.slice(0, -".txt".length) + "/";
      e.respondWith(Response.redirect(clean + url.search, 302));
      return;
    }
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Cache successful responses
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        // Network failed — try cache
        caches.match(e.request).then((cached) =>
          cached || caches.match("/home/")
        )
      )
  );
});

// Lets a page force this SW to activate immediately (used by the
// "tap to update" toast instead of waiting for the next natural reload).
self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});
