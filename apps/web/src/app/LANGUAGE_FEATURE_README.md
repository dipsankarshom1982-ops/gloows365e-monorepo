# GLOOWS365E — Welcome-Screen Language Selection

This package implements: pick a language on the Welcome screen → the whole
app opens in that language. It **supersedes** the earlier `gloows365e-fixes.zip`
— this includes those same fixes already applied, plus the new feature
below. Just drop these 6 files into your repo at the matching paths,
overwriting what's there.

## What changed

### 1. New: `apps/web/src/lib/languages.ts`

Single source of truth for the language list: **English + all 22 languages
from the 8th Schedule of the Constitution of India (23 total)**. Also holds
the small localStorage helper (`getStoredLanguage` / `setStoredLanguage` /
`clearStoredLanguage`) that lets a language choice made *before* login
survive through to login/registration.

Previously this list was copy-pasted three times across the codebase (5
languages on Welcome, 13 on Register, 23 in Settings → Language) and had
drifted out of sync. All three now import from this one file.

### 2. `apps/web/src/app/(auth)/welcome/page.tsx`

- Shows all 23 languages (was 5), each with native script + English name,
  in a compact scrollable grid so the screen layout doesn't break.
- English is selected by default.
- Tapping a language now actually does something: it's saved immediately
  via `setStoredLanguage()`. Before, `selectedLang` was local state that
  nothing else ever read — purely decorative.
- "Start Learning" still goes to `/login`, but the chosen language is
  already saved by the time it gets there.

### 3. `apps/web/src/context/LanguageContext.tsx`

This is what makes the choice actually take effect app-wide. The app's
`t()` translation function now resolves the active language in this order:

1. **Firestore `students/{uid}.preferredLanguage`** — once a real student
   profile exists (after registration, or changed later in Settings), this
   always wins. Durable, syncs across devices.
2. **The pre-login localStorage choice from Welcome** — used only when
   there's no Firestore profile yet (logged out, or mid-registration).
3. **English** — hard fallback if neither is set.

Once a Firestore preference appears, the localStorage value is cleared
automatically so it can never go stale and silently override a later,
deliberate change made in Settings on a different device.

### 4. `apps/web/src/app/(auth)/register/page.tsx`

- Now imports the full 23-language list from `lib/languages.ts` instead of
  its own 13-language copy — Maithili, Kashmiri, Konkani, Bodo, Nepali,
  Sanskrit, Santali, Sindhi, Dogri are now selectable here too.
- The language field **pre-fills** with whatever was picked on Welcome,
  instead of defaulting to blank and asking again.
- Clears the localStorage value once registration succeeds (or once the
  restart-education branch completes), since Firestore is now the source
  of truth.

### 5 & 6. `settings/language/page.tsx` and `settings/profile/page.tsx`

No behavior change beyond importing the language list from the new shared
file instead of keeping a local copy. (These two already had the
`students/{uid}` Firestore fix from the previous round — that's preserved.)

## Translation coverage note

`LanguageContext.tsx`'s actual translated strings (the `t()` lookup tables)
currently cover 13 Indian languages + English. The other 9 languages in the
23-language list (Bodo, Dogri, Kashmiri, Konkani, Maithili, Nepali,
Sanskrit, Santali, Sindhi) are selectable everywhere now, but any UI text
not yet translated for them will **fall back to English** automatically —
that's the existing, intentional fallback behavior in `t()`, not a bug. If
you want full translations for those 9 too, that's a separate content task
(filling in the `translations` object) — happy to help with that next if
useful.

## Not touched

The mobile (Expo) app's `app/(auth)/welcome.tsx` has the exact same
"selecting a language does nothing" gap, since this was a web-specific
request. Worth doing the same fix there if you want parity — let me know.
