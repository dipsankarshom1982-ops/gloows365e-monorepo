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

const CACHE_VERSION = "v5"; // ← bump this string on every deploy
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
