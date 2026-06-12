# Gloows365E — Monorepo

Production-grade, cross-platform EdTech platform for Indian students.

## Structure

```
gloows365e-monorepo/
├── apps/
│   ├── mobile/              ← React Native + Expo (existing app)
│   ├── web/                 ← Next.js 15 (new — this session)
│   └── admin/               ← React + Vite (existing admin panel)
├── packages/
│   └── shared-logic/        ← All business logic shared across all 3 apps
├── functions/               ← Firebase Cloud Functions (unchanged)
├── firestore.rules
├── firestore.indexes.json
├── firebase.json            ← Updated for multi-site hosting
├── pnpm-workspace.yaml
├── SCALABILITY.md
└── package.json
```

## Tech Stack

| Layer          | Technology                     |
|----------------|--------------------------------|
| Mobile         | React Native + Expo Router     |
| Web            | Next.js 15 App Router          |
| Admin          | React + Vite + Tailwind        |
| Shared Logic   | TypeScript (no RN deps)        |
| Backend        | Firebase Cloud Functions v1/v2 |
| Database       | Firestore                      |
| Auth           | Firebase Auth                  |
| Video          | Cloudflare Stream              |
| AI             | Gemini via Cloud Functions     |
| Payments       | Razorpay (web SDK / native RN) |
| Rate Limiting  | Redis (Upstash)                |
| Hosting        | Firebase Hosting (multi-site)  |

## Quick Start

```bash
# Install all workspaces
pnpm install

# Run web app (dev)
pnpm dev:web

# Run admin panel (dev)
pnpm dev:admin

# Run mobile app
pnpm --filter mobile start

# Deploy everything
pnpm deploy:all
```

## Platform Differences

| Feature        | Mobile                    | Web                           |
|----------------|---------------------------|-------------------------------|
| Auth persist   | AsyncStorage              | browserLocalPersistence       |
| Video          | expo-av + HLS URL         | Cloudflare iframe embed       |
| Payments       | expo-web-browser (temp)   | Razorpay JS SDK (native)      |
| Push notifs    | expo-notifications        | Web Push (future)             |
| Navigation     | Expo Router               | Next.js App Router            |

## Shared Logic Package

Everything in `packages/shared-logic/src/` works on ALL platforms:
- `services/` — Firebase + Cloud Function calls (pure fetch)
- `hooks/`    — React hooks (useVCoins, useReferral, etc.)
- `context/`  — React contexts (StudentProfile, FeatureFlags)
- `types/`    — TypeScript types
- `utils/`    — Pure utility functions

**Rule:** If a file imports from `react-native`, `expo-*`, or `AsyncStorage`,
it stays in `apps/mobile/` — NOT in `packages/shared-logic/`.

## Environment Variables

### apps/web/.env.local
See apps/web/.env.example

### apps/mobile/.env
Same as existing GLOOWS365E/.env (EXPO_PUBLIC_* prefix)

## Deployment

### Web (Firebase Hosting)
```bash
pnpm build:web
firebase deploy --only hosting:web
```

### Admin Panel
```bash
pnpm build:admin
firebase deploy --only hosting:admin
```

### Cloud Functions (unchanged)
```bash
firebase deploy --only functions
```

## Scalability Notes
See SCALABILITY.md for the full guide to handling 1 lakh+ users.
