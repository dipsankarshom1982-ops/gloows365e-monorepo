"use client";

// PATH: apps/web/src/components/StoryCard.tsx
// Mirrors mobile components/StoryCard.tsx — same square gradient card design
// (NEW badge, pulsing unread dot, count pill), built with CSS instead of
// React Native StyleSheet/Animated.

import { StoryCategory } from "@/lib/storyCategories";

interface StoryCardProps {
  category:      StoryCategory;
  count:         number;
  hasUnread:     boolean;
  isNew:         boolean;
  onClick:       () => void;
  size?:         number;
  // Actual video/image thumbnail for the most recent story in this
  // category — shown as the card background instead of a flat gradient so
  // students can actually see what's inside before clicking. Falls back to
  // the gradient+emoji when no thumbnail is available yet.
  thumbnailUrl?: string;
  isVideoThumb?: boolean;
}

export function StoryCard({ category, count, hasUnread, isNew, onClick, size = 100, thumbnailUrl, isVideoThumb }: StoryCardProps) {
  const cardHeight = Math.round(size * 1.18);

  return (
    <button
      onClick={onClick}
      className="story-card-wrapper"
      style={{ width: size, marginInline: 5, background: "none", border: "none", cursor: "pointer", padding: 0 }}
    >
      <div
        className="story-card-body"
        style={{
          width: size, height: cardHeight, borderRadius: 14,
          background: thumbnailUrl
            ? `center / cover no-repeat url(${thumbnailUrl}), linear-gradient(160deg, ${category.gradient[0]}, ${category.gradient[1]})`
            : `linear-gradient(160deg, ${category.gradient[0]}, ${category.gradient[1]})`,
          position: "relative", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          paddingBottom: 12,
          borderTop: "0.5px solid rgba(255,255,255,0.18)",
          borderLeft: "0.5px solid rgba(255,255,255,0.12)",
        }}
      >
        {/* Bottom scrim so badges/label stay legible over a photo/video
            thumbnail, not just the old flat gradient. */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
        }}/>

        {isNew && !hasUnread && (
          <div style={{
            position: "absolute", top: 8, left: 8,
            background: "rgba(255,255,255,0.22)", borderRadius: 6,
            padding: "2px 5px",
          }}>
            <span style={{ color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: 0.4 }}>NEW</span>
          </div>
        )}

        {hasUnread && (
          <div style={{ position: "absolute", top: 8, right: 8, width: 14, height: 14 }}>
            <div className="story-unread-ring" style={{
              position: "absolute", width: 14, height: 14, borderRadius: 7,
              background: "rgba(255,78,78,0.35)",
            }}/>
            <div style={{
              position: "absolute", top: 2.5, left: 2.5, width: 9, height: 9, borderRadius: 5,
              background: "#FF4E4E", border: "1.5px solid #fff",
            }}/>
          </div>
        )}

        {count > 1 && (
          <div style={{
            position: "absolute", bottom: 10, right: 8,
            background: "rgba(0,0,0,0.45)", borderRadius: 8,
            padding: "2px 5px", border: "0.5px solid rgba(255,255,255,0.2)",
          }}>
            <span style={{ color: "#fff", fontSize: 9, fontWeight: 700 }}>{count}</span>
          </div>
        )}

        {/* Video play icon — tells students this preview is a video before
            they even click in. */}
        {isVideoThumb && (
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: 28, height: 28, borderRadius: 14, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 0, height: 0, marginLeft: 2,
              borderTop: "6px solid transparent", borderBottom: "6px solid transparent",
              borderLeft: "10px solid #fff",
            }}/>
          </div>
        )}

        {/* Category icon — small corner badge once a real thumbnail is
            shown; the old large centered emoji is the fallback with no
            thumbnail yet. */}
        {thumbnailUrl ? (
          <span style={{
            position: "absolute", bottom: 8, left: 8, fontSize: 14,
            background: "rgba(0,0,0,0.35)", borderRadius: 6, padding: "2px 4px",
          }}>{category.emoji}</span>
        ) : (
          <span style={{ fontSize: size * 0.28, marginBottom: 8 }}>{category.emoji}</span>
        )}
      </div>

      <div style={{
        fontSize: 11, fontWeight: 600, color: "var(--text)", marginTop: 6,
        textAlign: "center", maxWidth: 96, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {category.label}
      </div>
    </button>
  );
}

export function AddStoryCard({ onClick, size = 100 }: { onClick: () => void; size?: number }) {
  const cardHeight = Math.round(size * 1.18);
  return (
    <button
      onClick={onClick}
      className="story-card-wrapper"
      style={{ width: size, marginInline: 5, background: "none", border: "none", cursor: "pointer", padding: 0 }}
    >
      <div style={{
        width: size, height: cardHeight, borderRadius: 14,
        border: "1.5px dashed rgba(99,102,241,0.4)",
        background: "rgba(99,102,241,0.04)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 26, color: "#6366f1", fontWeight: 300, lineHeight: "32px" }}>+</span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", marginTop: 6, textAlign: "center" }}>
        Your Story
      </div>
    </button>
  );
}
