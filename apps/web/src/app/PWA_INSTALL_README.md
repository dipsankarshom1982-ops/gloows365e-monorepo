# GLOOWS365E — PWA Install Prompt for Testers

⚠️ **Depends on `gloows365e-welcome-language.zip` being applied first** —
this package's `welcome/page.tsx` is built on top of that one (23-language
picker + install prompt together). If you haven't applied that package yet,
apply it first, then this one. If you have, this `welcome/page.tsx`
overwrite already includes both features — no need to apply that file twice.

6 files total. New files: `useInstallPrompt.ts`, `InstallPrompt.tsx`,
`UpdateToast.tsx`. Modified: `sw.js`, `layout.tsx`, `welcome/page.tsx`.

## What this does

Lets employees/friends install the app as a PWA straight from the welcome
screen, with no Play Store needed — and lets you push updates to their
installs without them manually clearing cache.

### 1. Fixed: `apps/web/public/sw.js`

Two issues fixed:

- **Icon paths were wrong.** The precache list referenced
  `/icons/icon-192.png` and `/icons/icon-512.png`, but those files actually
  live at `/icon-192.png` and `/icon-512.png` (no `/icons/` folder). Some
  browsers reject the *entire* precache if even one entry 404s — this could
  have been silently breaking installability already.
- **Added cache versioning + update notifications.** `CACHE_VERSION` is now
  a single string (`"v2"`) you bump on each deploy you want testers to pick
  up. When a new version activates, the service worker now messages every
  open tab — paired with the new `UpdateToast` component (see below), this
  surfaces a "New version available — tap to refresh" banner instead of
  testers being stuck on a stale build with no idea why.

**Going forward: bump `CACHE_VERSION` in `sw.js` every time you deploy a
build you want testers to see.** This is now your "push update to testers"
lever.

### 2. New: `apps/web/src/hooks/useInstallPrompt.ts`

Reusable hook that detects:
- **Android / desktop Chrome/Edge** — captures the browser's
  `beforeinstallprompt` event so a button can trigger the native install
  dialog on tap.
- **iOS Safari** — has no install API at all (Apple doesn't expose one), so
  this just reports `platform: "ios"` so the UI can show manual steps.
- **Already installed** — `isInstalled` true when running in standalone
  mode, so you can hide the prompt for people who already have it.

### 3. New: `apps/web/src/components/InstallPrompt.tsx`

The actual UI, using that hook:
- Android/desktop: single **"📲 Install App for testing"** button → native
  install dialog.
- iOS: same button, but tapping it expands 3 numbered steps (Share → Add to
  Home Screen → Add), since there's no native dialog Apple allows.
- Already installed: small "✅ App installed" confirmation, no nagging.

Styled to match the existing welcome screen (frosted glass on the purple
gradient) — no new visual language introduced.

### 4. New: `apps/web/src/components/UpdateToast.tsx`

Listens for the new service-worker update message and shows a small
bottom-of-screen "🔄 New version available — Refresh" banner with a button
that reloads. Wired into the root layout, so it's available on every page,
not just welcome.

### 5. `apps/web/src/app/(auth)/welcome/page.tsx`

Added `<InstallPrompt />` below the existing "Start Learning" CTA and trust
line — secondary, not competing with the primary action, since most
visitors will be students using the site directly rather than installing a
test build.

### 6. `apps/web/src/app/layout.tsx`

Added `<UpdateToast />` so the update banner is available app-wide, not
just on welcome (a tester might be mid-session elsewhere when you deploy a
fix).

## How to actually distribute this to testers

You said Firebase Hosting is already deployed and live, so:

1. Deploy as normal.
2. Share the live URL with employees/friends (WhatsApp, email, whatever).
3. They open it → land on `/welcome` (first-visit routing already sends
   logged-out visitors there) → see the install button right there.
4. **Android**: tap "Install App for testing" → native "Add to Home
   Screen" dialog → done, it's an app icon.
5. **iPhone**: tap the same button → see the 3 steps → Share → Add to Home
   Screen → done.

No App Store / Play Store review, no APK sideloading permissions to walk
people through, no TestFlight/internal-testing-track setup — just a link.

## What I deliberately didn't build (yet)

You can ask for these next if useful:

- **A dedicated `/install` or `/test` landing page** — right now the
  install prompt lives on `/welcome`, which is fine for brand-new visitors,
  but if you want a single link that explains "this is a test build, here's
  what to check" before showing the install button, that's a separate page.
- **Test-traffic separation** (e.g. a `?test=1` flag or a separate hosting
  channel) so tester activity doesn't mix into real user data in Firestore
  before you're ready to launch for real.
- **Mobile (Expo) app parity** — this was scoped to the web app only; the
  Expo app has its own install story (Expo Go / EAS builds) that doesn't
  need this PWA mechanism at all.
