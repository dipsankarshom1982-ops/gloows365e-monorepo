"use client";

// PATH: apps/web/src/app/(app)/skillboost/page.tsx
// Skill Boost — daily subject challenges (Math / English / Science / GK / Logic / Vocab)
// Mirrors mobile app/(drawer)/(tabs)/skillboost.tsx (drawer item: drawerItem("skillboost"))

export default function SkillBoostPage() {
  return (
    <div className="page-pad">
      <h2 style={{ color: "var(--text)", fontWeight: 800, fontSize: 22, marginBottom: 6 }}>
        ⚡ Skill Boost
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
        Daily subject challenges — Math, English, Science, GK, Logic, Vocabulary. Build next.
      </p>
    </div>
  );
}