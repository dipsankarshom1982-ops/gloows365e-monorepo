# SCALABILITY.md — Handle Lacs of Users

## Current Status vs Target

| Feature              | Current State            | Target (1L+ users)         |
|----------------------|--------------------------|----------------------------|
| Firestore reads      | Some unbounded queries   | All paginated, indexed      |
| Leaderboard          | Partial Redis            | Full Redis + scheduled sync |
| AI rate limiting     | Redis (partial)          | Per-user per-day limits     |
| Cloud Functions      | Cold start prone         | Min instances = 1 on hot fns|
| Image delivery       | Firebase Storage direct  | Cloudflare CDN URLs         |
| Auth tokens          | No App Check             | Firebase App Check enabled  |
| Video               | Cloudflare Stream ✅      | Already scales              |

---

## 1. Firestore Pagination (CRITICAL)
Every query that fetches a list MUST use limit() + startAfter().

Bad:
  const snap = await getDocs(collection(db, "students"));   // ← reads ALL docs

Good:
  const snap = await getDocs(
    query(collection(db, "students"), orderBy("createdAt"), limit(20))
  );
  // Next page: startAfter(lastDoc)

Fix these screens immediately:
  - leaderboard.tsx      → paginate by 20
  - skillbattle.tsx      → limit live battles to 10
  - admin Students page  → already paginated? verify
  - vCoinTransactions    → limit(50) ✅ already done in useVCoins

---

## 2. Leaderboard at Scale
At 1L users, a real-time Firestore leaderboard will fail.

Solution (already partially built with Redis):

  // functions/src/leaderboard.ts — add this scheduled function
  export const syncLeaderboard = onSchedule("every 5 minutes", async () => {
    const redis = await getRedis();
    // Fetch top 100 from Redis ZSET
    const topUsers = await redis.zrevrange("leaderboard:global", 0, 99, "WITHSCORES");
    // Write to Firestore leaderboard/cache doc
    await db.doc("leaderboard/cachedTop100").set({
      users: topUsers,
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  // Mobile reads from leaderboard/cachedTop100 — NOT a live query on users collection

---

## 3. Cloud Functions — Prevent Cold Starts

Add to functions/src/index.ts for hot functions:

  // Keep AI Guru and payment functions warm (1 minimum instance)
  export const generateLessonHot = onCall(
    { minInstances: 1, maxInstances: 10 },
    generateLessonHandler
  );

  export const createRazorpayOrderHot = onCall(
    { minInstances: 1 },
    createOrderHandler
  );

---

## 4. Firebase App Check (Security at Scale)
Without App Check, anyone can call your Cloud Functions with a stolen API key.

Enable it BEFORE Play Store launch:

  // Mobile — app.config.js
  plugins: [
    ["@react-native-firebase/app", { ...}],
    ["@react-native-firebase/app-check", {
      "isTokenAutoRefreshEnabled": true
    }]
  ]

  // Cloud Functions — add to all onCall handlers
  runWith({ enforceAppCheck: true })

---

## 5. Composite Firestore Indexes — Add These
Missing indexes = failed-precondition errors at scale.

Add to firestore.indexes.json:

  // Short reels — ordered by createdAt
  { "collectionGroup": "short_reels",
    "fields": [
      { "fieldPath": "status",    "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]
  }

  // Skill battles — by scope + startDate
  { "collectionGroup": "skillBattles",
    "fields": [
      { "fieldPath": "scope",     "order": "ASCENDING" },
      { "fieldPath": "startDate", "order": "DESCENDING" }
    ]
  }

  // vCoin transactions — by uid + createdAt (subcollection)
  { "collectionGroup": "vCoinTransactions",
    "fields": [
      { "fieldPath": "type",      "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]
  }

---

## 6. Cloudflare Worker Optimizations
Your worker at vidya-stream.dipsankarshom1982.workers.dev handles uploads.
Add these headers to responses for better caching:

  Cache-Control: public, max-age=31536000  // 1 year for video segments
  Cache-Control: public, max-age=3600      // 1 hour for thumbnails

---

## 7. Image Optimization
Profile pictures + banners should go through Cloudflare Images or
Firebase Hosting CDN, not direct Storage URLs.

Replace storage.googleapis.com URLs with:
  https://YOUR_CF_ACCOUNT.r2.cloudflarestorage.com/...
  
Or use Firebase Hosting URL rewriting for assets.

---

## Priority Order for Implementation

1. ✅ Monorepo + shared-logic  (done — this session)
2. ✅ Next.js web app          (done — this session)
3. 🔲 Paginate all list queries
4. 🔲 Redis leaderboard cache
5. 🔲 Firebase App Check
6. 🔲 Cloud Functions minInstances
7. 🔲 Composite Firestore indexes
8. 🔲 Native Razorpay (before Play Store)
