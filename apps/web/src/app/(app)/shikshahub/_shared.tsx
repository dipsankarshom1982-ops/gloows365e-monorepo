"use client";

// PATH: apps/web/src/app/(app)/shikshahub/_shared.tsx
// Shared presentational bits for the ShikshaHub listing + detail pages
// (UI-only redesign pass — no data-layer changes, see lib/shikshahub).
// Split out purely so the responsive grid/hover/clamp CSS and the small
// "Verified Tutor" badge aren't duplicated between page.tsx and
// profile/page.tsx. The leading underscore keeps this out of Next.js's
// route table (not a page/layout itself).

import type { MarketplaceTutor } from "@/lib/shikshahub";

// tutorMarketplaceProfiles/{uid} only ever exists for a tutor whose
// `verified` flag is true (functions/src/tutorMarketplace.ts deletes the
// mirror doc the instant that flips false) — so "Verified" is a true fact
// about every tutor this UI ever renders, not an invented/guessed field.
export function VerifiedBadge({ compact }: { compact?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0,
        background: "rgba(20,184,166,0.14)", border: "1px solid rgba(20,184,166,0.4)",
        color: "#0d9488", borderRadius: 20,
        padding: compact ? "3px 8px" : "5px 10px",
        fontSize: compact ? 10 : 11, fontWeight: 800, whiteSpace: "nowrap",
      }}
    >
      ✓ {compact ? "Verified" : "Verified Tutor"}
    </span>
  );
}

export function SubjectChips({ subjects, limit }: { subjects: string[]; limit?: number }) {
  if (subjects.length === 0) return null;
  const shown = limit ? subjects.slice(0, limit) : subjects;
  const extra = limit && subjects.length > limit ? subjects.length - limit : 0;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {shown.map((s) => (
        <span
          key={s}
          style={{
            fontSize: 11, fontWeight: 700, border: "1px solid #14b8a6", borderRadius: 20,
            padding: "4px 9px", color: "#14b8a6", background: "rgba(20,184,166,0.08)",
          }}
        >
          {s}
        </span>
      ))}
      {extra > 0 && (
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", padding: "4px 2px" }}>
          +{extra} more
        </span>
      )}
    </div>
  );
}

export function TutorAvatar({
  tutor, size, ring,
}: { tutor: Pick<MarketplaceTutor, "profilePic" | "name">; size: number; ring?: boolean }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        border: ring ? "3px solid var(--bg-card)" : "1px solid var(--border)",
        boxShadow: ring ? "0 0 0 2px #14b8a6" : undefined,
        background: tutor.profilePic ? `url(${tutor.profilePic}) center/cover` : "rgba(20,184,166,0.14)",
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
      }}
    >
      {!tutor.profilePic && <span style={{ fontSize: size * 0.4 }}>🧑‍🏫</span>}
    </div>
  );
}

/** One shared <style> block for the responsive grid, card hover, 2-line
 *  bio clamp, and detail-page 2-col/1-col layout. Safe to mount from both
 *  pages — identical rule sets, no ID collisions (plain classes). */
export function ShikshaHubStyles() {
  return (
    <style>{`
      .shikshahub-container {
        max-width: 1280px;
        margin: 0 auto;
        padding: 0 16px;
      }

      /* LAYOUT FIX (desktop content-width bug) — repeat(N, minmax(0,1fr))
         always creates exactly N tracks REGARDLESS of how many cards
         actually exist, and 1fr divides the full row width equally among
         them. With few tutors (the common case pre-launch and in any
         niche subject/filter), the visible card(s) got stretched to
         fill their 1fr share — up to ~400px on a 1280px desktop with
         just one tutor — while the "extra" tracks sat empty and
         invisible, making the whole discovery area look collapsed into
         a narrow left column even though .shikshahub-container itself
         was always full-width.
         Below 640px, a capped minmax(280px,290px) card would itself have
         left an unnecessary side margin on a 375/412px phone (content
         width there is ~343-380px, wider than the 290px cap) — so mobile
         gets a plain single 1fr column that always fills the available
         content width exactly, no cap. From 640px up, auto-fit takes
         over: column COUNT is driven purely by available width (verified
         at 375/412/768/1024/1280/1440px to land on 1/1/2/3/4/4 columns),
         and a card's width never goes past 290px no matter how few
         tutors are in the result set — explicit justify-content: start
         keeps that intentionally left-aligned (grid's own default, made
         explicit here) rather than an accidental side-effect. */
      .shikshahub-grid {
        display: grid;
        grid-template-columns: 1fr;
        justify-content: start;
        gap: 16px;
      }
      @media (min-width: 640px) {
        .shikshahub-grid {
          grid-template-columns: repeat(auto-fit, minmax(280px, 290px));
          gap: 18px;
        }
      }
      @media (min-width: 1024px) {
        .shikshahub-grid { gap: 20px; }
      }

      .shikshahub-card {
        transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
      }
      .shikshahub-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 12px 28px rgba(0,0,0,0.14);
        border-color: #14b8a6 !important;
      }
      @media (prefers-reduced-motion: reduce) {
        .shikshahub-card { transition: none; }
        .shikshahub-card:hover { transform: none; }
      }

      .shikshahub-clamp2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .shikshahub-detail-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 20px;
        align-items: start;
      }
      @media (min-width: 1024px) {
        .shikshahub-detail-grid { grid-template-columns: 1.6fr 1fr; gap: 24px; }
      }

      @media (min-width: 1024px) {
        .shikshahub-action-card { position: sticky; top: 20px; }
      }
    `}</style>
  );
}
