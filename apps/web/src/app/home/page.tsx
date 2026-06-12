"use client";

// PATH: apps/web/src/app/home/page.tsx
// Web home — "same brain, different skin."
// All data logic (queries, flags, grouping, status derivation) comes from
// @gloows/shared-logic hooks, shared with the mobile app. This file is only
// the browser rendering shell.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { auth, app } from "@/lib/firebase";

import {
  useHomeFlags,
  useStories,
  useHomeReels,
  useHomeFeed,
  useContests,
  getContestStatus,
  sortContests,
  type SharedStoryDoc,
  useReferralConfig,
} from "@gloows/shared-logic";

const db = getFirestore(app);

const CF_CUSTOMER_CODE = "cif09s9962jkfc36";

// ─── Web-only helpers ────────────────────────────────────────────────────────

function extractCfVideoId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/cloudflarestream\.com\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

function cfIframeSrc(videoId: string, autoplay = false): string {
  return `https://customer-${CF_CUSTOMER_CODE}.cloudflarestream.com/${videoId}/iframe${
    autoplay ? "?autoplay=true" : ""
  }`;
}

// Viewed-story persistence — web's AsyncStorage equivalent (same key).
const VIEWED_KEY = "gloows_viewed_stories";

function loadViewedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(VIEWED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function persistViewed(set: Set<string>) {
  try {
    localStorage.setItem(VIEWED_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

// ─── Story category visuals ──────────────────────────────────────────────────
// ⚠️ Fallback set — replace with the exact list from lib/storyCategories.ts.
// Unknown ids auto-generate a label so nothing is ever hidden.

interface StoryCategory {
  id: string;
  label: string;
  emoji: string;
  gradient: [string, string];
}

const DEFAULT_CATEGORIES: StoryCategory[] = [
  { id: "science",    label: "Science",    emoji: "🔬", gradient: ["#0ea5e9", "#6366f1"] },
  { id: "maths",      label: "Maths",      emoji: "📐", gradient: ["#8b5cf6", "#d946ef"] },
  { id: "gk",         label: "GK",         emoji: "🌍", gradient: ["#10b981", "#0ea5e9"] },
  { id: "motivation", label: "Motivation", emoji: "🚀", gradient: ["#f59e0b", "#ef4444"] },
  { id: "exam_tips",  label: "Exam Tips",  emoji: "📝", gradient: ["#ec4899", "#8b5cf6"] },
  { id: "english",    label: "English",    emoji: "📖", gradient: ["#14b8a6", "#22c55e"] },
  { id: "general",    label: "Updates",    emoji: "📘", gradient: ["#6366f1", "#a855f7"] },
];

function getCategory(id: string): StoryCategory {
  return (
    DEFAULT_CATEGORIES.find((c) => c.id === id) ?? {
      id,
      label: id.charAt(0).toUpperCase() + id.slice(1).replace(/[_-]/g, " "),
      emoji: "📘",
      gradient: ["#6366f1", "#a855f7"],
    }
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 px-4 text-xl font-extrabold text-white">{children}</h2>;
}

// ═════════════════════════════════════════════════════════════════════════════
// STORIES — UI shell over useStories(); viewer is web-specific
// ═════════════════════════════════════════════════════════════════════════════

function StoriesSection({ uid }: { uid: string }) {
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  useEffect(() => setViewedIds(loadViewedSet()), []);

  const { groups, loading } = useStories(uid, viewedIds);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeCatId, setActiveCatId] = useState("");
  const [storyIdx, setStoryIdx] = useState(0);
  const [liked, setLiked] = useState(false);

  const activeGroup = groups.find((g) => g.categoryId === activeCatId);
  const activeStories: SharedStoryDoc[] = activeGroup?.stories ?? [];
  const activeStory = activeStories[storyIdx];
  const activeCat = getCategory(activeCatId);

  const openViewer = (catId: string) => {
    setActiveCatId(catId);
    setStoryIdx(0);
    setViewerOpen(true);
  };

  const goNext = useCallback(() => {
    if (storyIdx < activeStories.length - 1) {
      setStoryIdx((p) => p + 1);
    } else {
      const gi = groups.findIndex((g) => g.categoryId === activeCatId);
      if (gi < groups.length - 1) {
        setActiveCatId(groups[gi + 1].categoryId);
        setStoryIdx(0);
      } else {
        setViewerOpen(false);
      }
    }
  }, [storyIdx, activeStories.length, groups, activeCatId]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) setStoryIdx((p) => p - 1);
  }, [storyIdx]);

  // Per-story effects: mark viewed, count view, auto-advance images (5s)
  useEffect(() => {
    if (!viewerOpen || !activeStory) return;
    setLiked(false);
    setViewedIds((prev) => {
      const next = new Set([...prev, activeStory.id]);
      persistViewed(next);
      return next;
    });
    updateDoc(doc(db, "stories", activeStory.id), { views: increment(1) }).catch(() => {});

    if (activeStory.type !== "video") {
      const t = setTimeout(goNext, 5000);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerOpen, activeCatId, storyIdx]);

  useEffect(() => {
    if (!viewerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewerOpen(false);
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerOpen, goNext, goPrev]);

  const handleLike = () => {
    if (!activeStory || liked) return;
    setLiked(true);
    updateDoc(doc(db, "stories", activeStory.id), { likes: increment(1) }).catch(() => {});
  };

  if (!loading && groups.length === 0) return null;

  const cfId = activeStory?.type === "video" ? extractCfVideoId(activeStory.mediaUrl) : null;

  return (
    <div className="py-2">
      {/* Card strip */}
      <div className="flex gap-2.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
        {loading
          ? [1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[118px] w-[100px] shrink-0 animate-pulse rounded-[14px] bg-white/5" />
            ))
          : groups.map((g) => {
              const cat = getCategory(g.categoryId);
              return (
                <button
                  key={g.categoryId}
                  type="button"
                  onClick={() => openViewer(g.categoryId)}
                  className="w-[100px] shrink-0 text-center transition hover:scale-[1.03] active:scale-95"
                >
                  <div
                    className="relative flex h-[118px] w-[100px] items-end justify-center overflow-hidden rounded-[14px] pb-3"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${cat.gradient[0]}, ${cat.gradient[1]})`,
                    }}
                  >
                    {g.isNew && !g.hasUnread && (
                      <span className="absolute left-2 top-2 rounded-md bg-white/25 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white">
                        NEW
                      </span>
                    )}
                    {g.hasUnread && (
                      <span className="absolute right-2 top-2 flex h-3.5 w-3.5 items-center justify-center">
                        <span className="absolute h-3.5 w-3.5 animate-ping rounded-full bg-red-500/40" />
                        <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-white bg-[#FF4E4E]" />
                      </span>
                    )}
                    {g.stories.length > 1 && (
                      <span className="absolute bottom-2.5 right-2 rounded-lg border border-white/20 bg-black/45 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        {g.stories.length}
                      </span>
                    )}
                    <span className="mb-1 text-[28px]">{cat.emoji}</span>
                  </div>
                  <p className="mt-1.5 truncate text-[11px] font-semibold text-neutral-300">
                    {cat.label}
                  </p>
                </button>
              );
            })}
      </div>

      {/* ── Fullscreen viewer ── */}
      {viewerOpen && activeStory && (
        <div className="fixed inset-0 z-50 bg-black">
          <div className="relative mx-auto h-full w-full max-w-md">
            <div className="absolute inset-0">
              {activeStory.type === "video" ? (
                cfId ? (
                  <iframe
                    src={cfIframeSrc(cfId, true)}
                    className="h-full w-full border-0"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video src={activeStory.mediaUrl} className="h-full w-full object-contain" autoPlay controls />
                )
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeStory.mediaUrl} alt={activeStory.title ?? "Story"} className="h-full w-full object-contain" />
              )}
            </div>

            <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/70 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/80 to-transparent" />

            {/* Progress bars */}
            <div className="absolute inset-x-0 top-3 z-10 flex gap-1 px-3">
              {activeStories.map((_, i) => (
                <div key={i} className="h-[3px] flex-1 overflow-hidden rounded bg-white/30">
                  <div
                    className="h-full rounded bg-white"
                    style={{ width: i <= storyIdx ? "100%" : "0%" }}
                  />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="absolute inset-x-0 top-7 z-10 flex items-center justify-between px-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center border border-white/25 bg-white/15 text-xl">
                  {activeCat.emoji}
                </div>
                <div>
                  <p className="text-[15px] font-bold text-white">{activeCat.label}</p>
                  <p className="text-[11px] text-white/65">
                    {storyIdx + 1} / {activeStories.length}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setViewerOpen(false)} className="p-1 text-xl font-bold text-white">
                ✕
              </button>
            </div>

            {/* Status badges */}
            <div className="absolute left-4 top-24 z-10 flex gap-1.5">
              {activeStory.status === "pending" && (
                <span className="rounded-full bg-[#FEF3C7] px-2.5 py-1 text-[11px] font-semibold text-[#92400E]">⏳ Pending</span>
              )}
              {activeStory.status === "rejected" && (
                <span className="rounded-full bg-[#FEE2E2] px-2.5 py-1 text-[11px] font-semibold text-[#DC2626]">✗ Not Approved</span>
              )}
              {activeStory.isFeatured && (
                <span className="rounded-full bg-[#EC4899] px-2.5 py-1 text-[11px] font-semibold text-white">★ Featured</span>
              )}
            </div>

            {/* Info */}
            <div className="pointer-events-none absolute bottom-28 left-4 right-20 z-10">
              {!!activeStory.userName && (
                <p className="mb-1 truncate text-[11px] font-semibold text-white/60">
                  by {activeStory.userName}
                  {activeStory.userClass ? `  ·  Class ${activeStory.userClass}` : ""}
                </p>
              )}
              {!!activeStory.title && <p className="mb-1.5 text-lg font-extrabold text-white">{activeStory.title}</p>}
              {!!activeStory.description && (
                <p className="text-[13px] leading-snug text-white/90">{activeStory.description}</p>
              )}
            </div>

            {/* Partner Learn More bar */}
            {activeStory.storyKind === "linked" && !!activeStory.learnMoreUrl && (
              <div className="absolute bottom-[88px] left-4 right-4 z-10 flex items-center justify-between rounded-[14px] border border-[rgba(255,215,0,0.35)] bg-black/60 px-3.5 py-2.5">
                <div className="flex flex-1 items-center gap-2">
                  {activeStory.partnerLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={activeStory.partnerLogoUrl} alt="" className="h-7 w-7 rounded-md bg-white object-contain" />
                  ) : (
                    <span className="text-xl">🔗</span>
                  )}
                  <span className="truncate text-[13px] font-semibold text-white">
                    {activeStory.partnerName ?? "Learn More"}
                  </span>
                </div>
                <a
                  href={activeStory.learnMoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 rounded-full bg-[#FFD700] px-3.5 py-1.5 text-xs font-extrabold text-[#1a1a1a]"
                >
                  Learn More →
                </a>
              </div>
            )}

            {/* Like + Views */}
            <div className="absolute bottom-28 right-3.5 z-10 flex flex-col items-center gap-4">
              <button type="button" onClick={handleLike} className="flex flex-col items-center">
                <span className="text-2xl">{liked ? "❤️" : "🤍"}</span>
                <span className="mt-0.5 text-xs font-semibold text-white">
                  {(activeStory.likes ?? 0) + (liked ? 1 : 0)}
                </span>
              </button>
              <div className="flex flex-col items-center">
                <span className="text-2xl">👁</span>
                <span className="mt-0.5 text-xs font-semibold text-white">{activeStory.views ?? 0}</span>
              </div>
            </div>

            {/* Tap zones */}
            <button type="button" onClick={goPrev} className="absolute inset-y-0 left-0 z-[5] w-1/3" aria-label="Previous story" />
            <button type="button" onClick={goNext} className="absolute inset-y-0 right-0 z-[5] w-1/3" aria-label="Next story" />
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// AI GURU — exact visual port (no data logic, nothing to share)
// ═════════════════════════════════════════════════════════════════════════════

function AiGuruCard() {
  return (
    <Link href="/ai-guru" className="mx-4 my-2.5 block">
      <div
        className="relative overflow-hidden rounded-[20px] border p-[18px] shadow-[0_6px_12px_rgba(99,102,241,0.4)] transition hover:scale-[1.01]"
        style={{
          backgroundImage: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
          borderColor: "rgba(99,102,241,0.35)",
        }}
      >
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[rgba(99,102,241,0.18)]" />
        <div className="mb-3.5 flex items-center justify-between">
          <span className="rounded-full border border-[rgba(139,92,246,0.4)] bg-[rgba(99,102,241,0.25)] px-2.5 py-1 text-[11px] font-bold text-[#a5b4fc]">
            ✨ Powered by AI
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.15)] px-2 py-1 text-[11px] font-bold text-[#10b981]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#10b981]" />
            Online
          </span>
        </div>
        <div className="mb-3.5 flex items-center gap-3">
          <span className="text-[44px]">🤖</span>
          <div>
            <p className="text-[22px] font-black tracking-wide text-white">AI Guru</p>
            <p className="mt-0.5 text-xs font-medium text-white/55">
              Your personal AI tutor — ask any doubt, any subject
            </p>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {["Ask Anything", "Instant Answers", "Study Help"].map((f) => (
            <span
              key={f}
              className="rounded-full border border-white/10 bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-white/70"
            >
              {f}
            </span>
          ))}
        </div>
        <div
          className="rounded-xl py-3 text-center text-sm font-extrabold tracking-wide text-white"
          style={{ backgroundImage: "linear-gradient(90deg, #6366f1, #8b5cf6)" }}
        >
          Start Chatting
        </div>
      </div>
    </Link>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// REELS ROW — UI shell over useHomeReels()
// ═════════════════════════════════════════════════════════════════════════════

function ReelsRow({ title, battleReels }: { title: string; battleReels: boolean }) {
  const { reels, loading } = useHomeReels(battleReels);

  if (!loading && reels.length === 0) return null;

  return (
    <div className="my-4">
      <SectionTitle>{title}</SectionTitle>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {loading
          ? [1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[180px] w-[120px] shrink-0 animate-pulse rounded-xl bg-white/5" />
            ))
          : reels.map((item) => (
              <Link
                key={item.id}
                href={`/reels?postId=${item.id}`}
                className="relative h-[180px] w-[120px] shrink-0 overflow-hidden rounded-xl bg-neutral-800 transition hover:scale-[1.03]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumbnail || "https://via.placeholder.com/120x180?text=Reel"}
                  alt={item.title ?? "Reel"}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80" />
                <span className="absolute left-1/2 top-1/2 flex h-[30px] w-[30px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-white/30 text-xs text-white">
                  ▶
                </span>
                {item.title && (
                  <p className="absolute bottom-8 left-2 right-2 line-clamp-2 text-[11px] font-semibold leading-snug text-white">
                    {item.title}
                  </p>
                )}
                <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-xs font-semibold text-white">
                  🔥 {item.views || 0}
                </span>
              </Link>
            ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// REFERRAL CARD — UI shell over useReferralConfig() + profile fields
// ═════════════════════════════════════════════════════════════════════════════

function ReferralCardWeb({ profile }: { profile: DocumentData | null }) {
  const { config } = useReferralConfig();
  const [copied, setCopied] = useState(false);

  const referralCode: string = profile?.referralCode ?? "";
  if (!config || config.isActive === false || !referralCode) return null;

  const referralCount = profile?.referralCount ?? 0;
  const coinsEarned = profile?.referralCoinsEarned ?? 0;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const message = `Refer & Earn — India's smartest learning app! 🚀\n\nUse my referral code: ${referralCode}\n\nYou'll get ${config.refereeCoins ?? ""} VCoins as a welcome bonus!\n\nDownload now: https://gloows365.in`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join Gloows365E with my code", text: message });
        return;
      } catch {
        /* cancelled */
      }
    }
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-3.5 mb-4 rounded-[20px] border border-[rgba(124,58,237,0.3)] bg-[#0F0B2E] p-4">
      <div className="mb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-[rgba(124,58,237,0.15)] text-lg">
            👥
          </div>
          <div>
            <p className="text-[15px] font-bold text-white">Refer &amp; Earn</p>
            <p className="text-xs text-[#94a3b8]">Earn VCoins for every friend who joins</p>
          </div>
        </div>
        <Link href="/referral" className="flex items-center gap-0.5 text-xs font-semibold text-[#7C3AED]">
          View all ›
        </Link>
      </div>

      <div className="mb-3.5 flex items-center">
        <div className="flex-1 text-center">
          <p className="text-xl font-extrabold text-white">{referralCount}</p>
          <p className="mt-0.5 text-[11px] text-[#94a3b8]">Friends joined</p>
        </div>
        <div className="h-8 w-px bg-white/10" />
        <div className="flex-1 text-center">
          <p className="text-xl font-extrabold text-white">{coinsEarned}</p>
          <p className="mt-0.5 text-[11px] text-[#94a3b8]">VCoins earned</p>
        </div>
        <div className="h-8 w-px bg-white/10" />
        <div className="flex-1 text-center">
          <p className="text-xl font-extrabold text-white">+{config.referrerCoins ?? 0}</p>
          <p className="mt-0.5 text-[11px] text-[#94a3b8]">Per referral</p>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/5 p-3">
        <div className="flex-1">
          <p className="mb-0.5 text-[11px] text-[#94a3b8]">Your code</p>
          <p className="text-xl font-extrabold tracking-[2px] text-[#a78bfa]">{referralCode}</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg bg-[rgba(124,58,237,0.15)] px-3 py-2 text-[13px] font-semibold text-[#7C3AED]"
        >
          {copied ? <span className="text-[#16A34A]">✓ Copied!</span> : "⧉ Copy"}
        </button>
      </div>

      {config.giftEnabled && config.giftLabel ? (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-[rgba(202,138,4,0.12)] px-2.5 py-1.5 text-xs text-[#FBBF24]">
          🎁 Friend also gets: {config.giftLabel}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleShare}
        className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#7C3AED] py-3 text-[15px] font-bold text-white transition hover:bg-[#6D28D9]"
      >
        📤 Refer More Friends
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// VIDYA STAR — UI shell over useContests() + shared status helpers
// ═════════════════════════════════════════════════════════════════════════════

const STATUS_CFG = {
  live: { label: "🔴 LIVE", bg: "#ef4444" },
  upcoming: { label: "⏰ Upcoming", bg: "#f59e0b" },
  ended: { label: "✅ Ended", bg: "#6b7280" },
} as const;

function VidyaStarSection() {
  const { contests: allContests, loading } = useContests();

  const contests = useMemo(
    () =>
      sortContests(
        allContests.filter((item) => getContestStatus(item) !== "ended")
      ).slice(0, 6),
    [allContests]
  );

  if (!loading && contests.length === 0) return null;

  return (
    <div className="my-4">
      <div className="mb-3 flex items-start justify-between px-4">
        <div>
          <h2 className="text-lg font-extrabold text-white">🌟 Vidya Star</h2>
          <p className="text-xs font-medium text-neutral-400">Compete, learn and win exciting prizes</p>
        </div>
        <Link href="/vidyastar" className="mt-1 text-[13px] font-bold text-[#7c3aed]">
          View all
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {loading
          ? [1, 2, 3].map((i) => (
              <div key={i} className="h-[230px] w-[180px] shrink-0 animate-pulse rounded-2xl bg-white/5" />
            ))
          : contests.map((item) => {
              const status = getContestStatus(item);
              const cfg = STATUS_CFG[status];
              const gradStart = item.bannerMeta?.gradientStart ?? "#1a0a2e";
              const gradEnd = item.bannerMeta?.gradientEnd ?? "#7c3aed";
              const emoji = item.bannerMeta?.emoji ?? "🌟";
              return (
                <Link
                  key={item.id}
                  href="/vidyastar"
                  className="flex h-[230px] w-[180px] shrink-0 flex-col justify-between overflow-hidden rounded-2xl p-3.5 shadow-[0_4px_8px_rgba(124,58,237,0.3)] transition hover:scale-[1.02]"
                  style={{ backgroundImage: `linear-gradient(160deg, ${gradStart}, ${gradEnd})` }}
                >
                  <div>
                    <span
                      className="float-right rounded-md px-2 py-0.5 text-[10px] font-extrabold text-white"
                      style={{ backgroundColor: cfg.bg }}
                    >
                      {cfg.label}
                    </span>
                    <p className="clear-both mb-2 mt-1 text-center text-[32px]">{emoji}</p>
                    <p className="mb-2 line-clamp-2 text-[13px] font-extrabold leading-snug text-white">{item.title}</p>
                    {item.prizePool ? (
                      <p className="mb-1.5 text-[13px] font-extrabold text-[#fde68a]">🏆 {item.prizePool}</p>
                    ) : null}
                    {item.description ? (
                      <p className="line-clamp-2 text-[10px] leading-snug text-white/70">{item.description}</p>
                    ) : null}
                  </div>
                  <div>
                    <div className="my-2 h-px bg-white/15" />
                    <div
                      className="rounded-lg py-2 text-center text-xs font-extrabold text-white"
                      style={{ backgroundColor: status === "live" ? "#10b981" : "#6366f1" }}
                    >
                      {status === "live" ? "Participate Now" : "Coming Soon"}
                    </div>
                  </div>
                </Link>
              );
            })}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SEEKHO PREVIEW — stays page-local for now; moves to shared-logic together
// with the Seekho page work (the pagination from SCALABILITY.md lands there).
// ═════════════════════════════════════════════════════════════════════════════

function SeekhoPreview({ profile }: { profile: DocumentData | null }) {
  const [chapters, setChapters] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  const userClass = profile?.class ?? profile?.grade ?? null;
  const board = profile?.board ?? null;

  useEffect(() => {
    if (!userClass || !board) {
      setLoaded(true);
      return;
    }
    getDocs(
      query(
        collection(db, "seekho_courses"),
        where("class", "==", userClass),
        where("board", "==", board),
        orderBy("chapterNumber", "asc"),
        limit(10)
      )
    )
      .then((snap) => setChapters(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))))
      .catch(() => setChapters([]))
      .finally(() => setLoaded(true));
  }, [userClass, board]);

  if (!loaded) return null;

  if (chapters.length === 0) {
    return (
      <Link href="/seekho" className="mx-4 my-2.5 block rounded-[20px] border border-emerald-800/40 bg-gradient-to-br from-emerald-600/20 to-emerald-600/5 p-5 transition hover:scale-[1.01]">
        <span className="text-3xl">📚</span>
        <p className="mt-2 text-lg font-bold text-white">Seekho</p>
        <p className="mt-0.5 text-sm text-neutral-400">Chapter-wise courses for your class and board.</p>
        <span className="mt-2 inline-block text-sm font-semibold text-emerald-400">Start learning →</span>
      </Link>
    );
  }

  return (
    <div className="my-4">
      <div className="mb-3 flex items-center justify-between px-4">
        <h2 className="text-xl font-extrabold text-white">📚 Seekho</h2>
        <Link href="/seekho" className="text-[13px] font-bold text-[#7c3aed]">
          View all
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {chapters.map((ch) => (
          <Link
            key={ch.id}
            href={`/seekho?chapter=${ch.id}`}
            className="w-[160px] shrink-0 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 transition hover:scale-[1.02] hover:border-violet-700/50"
          >
            <span className="inline-block rounded-md bg-violet-600/20 px-2 py-0.5 text-[10px] font-bold text-violet-300">
              Ch {ch.chapterNumber}
            </span>
            <p className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-white">
              {ch.title ?? ch.chapterName ?? ch.name ?? "Chapter"}
            </p>
            {ch.subject && <p className="mt-1 text-xs text-neutral-400">{ch.subject}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LINK BANNERS + POST CARD (web-only UI)
// ═════════════════════════════════════════════════════════════════════════════

function LinkBanner({
  href,
  emoji,
  title,
  sub,
  from,
  to,
  border,
}: {
  href: string;
  emoji: string;
  title: string;
  sub: string;
  from: string;
  to: string;
  border: string;
}) {
  return (
    <Link
      href={href}
      className="mx-4 my-2.5 flex items-center gap-4 rounded-[20px] border p-4 transition hover:scale-[1.01]"
      style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})`, borderColor: border }}
    >
      <span className="text-4xl">{emoji}</span>
      <div className="flex-1">
        <p className="text-base font-extrabold text-white">{title}</p>
        <p className="mt-0.5 text-xs text-white/60">{sub}</p>
      </div>
      <span className="text-lg text-white/70">›</span>
    </Link>
  );
}

function PostCardWeb({ post }: { post: any }) {
  const img = post.thumbnail || post.mediaUrl || post.imageUrl || "";
  const isVideo = post.postType === "video";
  const body = (
    <div className="mx-4 my-2.5 overflow-hidden rounded-[20px] border border-neutral-800 bg-neutral-900/70">
      {img && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt={post.title ?? post.caption ?? "Post"} className="max-h-[420px] w-full object-cover" />
          {isVideo && (
            <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-black/50 text-lg text-white">
              ▶
            </span>
          )}
        </div>
      )}
      <div className="p-4">
        {!!post.userName && <p className="mb-1 text-xs font-semibold text-neutral-400">{post.userName}</p>}
        {(post.title || post.caption) && (
          <p className="text-sm font-semibold leading-snug text-white">{post.title ?? post.caption}</p>
        )}
        <p className="mt-1.5 text-xs text-neutral-500">
          {post.views ? `🔥 ${post.views}` : ""} {post.likes ? `  ·  ❤️ ${post.likes}` : ""}
        </p>
      </div>
    </div>
  );
  return isVideo ? <Link href={`/reels?postId=${post.id ?? ""}`}>{body}</Link> : body;
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function HomePage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<DocumentData | null>(null);
  const [ready, setReady] = useState(false);

  const { homeSection, homeFlags } = useHomeFlags(true);
  const { posts } = useHomeFeed();

  // Auth guard
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/login");
      else setUser(u);
    });
    return unsub;
  }, [router]);

  // Live profile — users/{uid}, same doc mobile reads
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        setProfile(snap.exists() ? snap.data() : null);
        setReady(true);
      },
      () => setReady(true)
    );
    return unsub;
  }, [user]);

  async function handleSignOut() {
    await signOut(auth);
    router.replace("/login");
  }

  if (!ready || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </main>
    );
  }

  const displayName =
    profile?.name || profile?.fullName || profile?.displayName || user.displayName || "Student";
  const vcoinsField = `vCoinsYear_${new Date().getFullYear()}`;
  const vcoins: number =
    typeof profile?.[vcoinsField] === "number"
      ? profile[vcoinsField]
      : typeof profile?.vcoins === "number"
      ? profile.vcoins
      : 0;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-neutral-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
            Gloows365E
          </span>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1 rounded-full border border-amber-800/50 bg-amber-950/40 px-2.5 py-1 text-sm font-semibold text-amber-300">
              🪙 {vcoins.toLocaleString("en-IN")}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 transition hover:bg-neutral-800"
              title={String(displayName)}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Feed column (phone-width, like the app) ── */}
      <div className="mx-auto max-w-xl pb-20" key={JSON.stringify(homeFlags)}>
        {homeSection("stories") && <StoriesSection uid={user.uid} />}

        {homeSection("aiguru") && <AiGuruCard />}

        {homeSection("creator_reels") && <ReelsRow title="🎬 Creator Reels" battleReels={false} />}

        {homeSection("skillshorts") && <ReelsRow title="⚡ Skill Shorts" battleReels />}

        {homeSection("referral") && <ReferralCardWeb profile={profile} />}

        {homeSection("skillbattle") && (
          <LinkBanner
            href="/skill-battle"
            emoji="⚔️"
            title="Skill Battle"
            sub="Compete in live battles and win prizes"
            from="rgba(245,158,11,0.18)"
            to="rgba(245,158,11,0.04)"
            border="rgba(180,83,9,0.4)"
          />
        )}

        {homeSection("vidya_star") && <VidyaStarSection />}

        {homeSection("seekho_preview") && <SeekhoPreview profile={profile} />}

        {homeSection("discover_preview") && (
          <LinkBanner
            href="/discover"
            emoji="🧭"
            title="Discover"
            sub="Explore trending topics and new content"
            from="rgba(14,165,233,0.18)"
            to="rgba(14,165,233,0.04)"
            border="rgba(3,105,161,0.4)"
          />
        )}

        {homeSection("knowledge_hub") && (
          <LinkBanner
            href="/knowledge-hub"
            emoji="💡"
            title="Knowledge Hub"
            sub="Articles, facts and quick knowledge boosters"
            from="rgba(16,185,129,0.18)"
            to="rgba(16,185,129,0.04)"
            border="rgba(4,120,87,0.4)"
          />
        )}

        {/* Feed posts — web adaptation of the mobile interleave */}
        {homeSection("feed_posts") &&
          posts.slice(0, 2).map((p, i) => <PostCardWeb key={p.id ?? `p${i}`} post={p} />)}

        {homeSection("learning") && <ReelsRow title="📖 Short Learning" battleReels={false} />}

        {homeSection("feed_posts") &&
          posts.slice(2).map((p, i) => <PostCardWeb key={p.id ?? `q${i}`} post={p} />)}
      </div>

      <footer className="border-t border-neutral-800/80 py-6 text-center text-xs text-neutral-600">
        Shikshakool Academy Private Limited · gloows365.in
      </footer>
    </main>
  );
}