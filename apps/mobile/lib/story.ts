// PATH: lib/story.ts
// Single source of truth for story types.
// Replaces the old Story interface that used media.videoUrl/thumbnail
// with the actual Firestore shape (flat mediaUrl, thumbnailUrl).
//
// StoryDoc = what Firestore stores and Story.tsx reads
// StoryCta  = CTA sub-object
// StoryReward = reward sub-object

// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface StoryCta {
  text:       string;
  actionType: "internal" | "external";
  link:       string;
}

export interface StoryReward {
  coins: number;
  type:  "view" | "click" | "conversion";
}

// ─── Main type ────────────────────────────────────────────────────────────────
// Matches the actual Firestore document shape written by Story.tsx and the
// admin panel. All optional fields are backwards-compatible with old docs.

export interface StoryDoc {
  id:           string;
  userId:       string;
  userName:     string;
  userClass?:   number | null;

  // Media — flat fields (NOT nested media.videoUrl)
  mediaUrl:     string;
  thumbnailUrl: string;
  type:         "image" | "video";

  // Category
  category:             string;             // legacy field
  educationalCategory?: string;            // new — maps to StoryCategory.id
  language?:            string;            // e.g. "Bengali"
  classRange?:          [number, number];  // reading level filter

  // Content
  title:           string;
  description:     string;
  relatedFeature?: string;

  // CTA — optional nested object
  cta?: StoryCta;

  // Reward — optional nested object
  reward?: StoryReward;

  // Engagement
  likes:        number;
  views:        number;
  completions?: number;

  // Reactions
  reactions?: {
    learned:     number;
    saved:       number;
    needHelp:    number;
    alreadyKnow: number;
  };

  // Poll
  poll?: {
    question: string;
    options:  string[];
    votes?:   number[];
  };

  // Series
  seriesId?:    string;
  seriesTitle?: string;
  seriesDay?:   number;
  seriesTotal?: number;

  // Status
  status:      "pending" | "approved" | "rejected";
  isFeatured?: boolean;

  // Timestamps
  createdAt: any;
  expiresAt: any;

  // Partner / linked story
  storyKind?:     "normal" | "linked";
  learnMoreUrl?:  string;
  partnerId?:     string;
  partnerName?:   string;
  partnerLogoUrl?: string;
}

// ─── Legacy alias ─────────────────────────────────────────────────────────────
// Keep the old `Story` export so any file that imports `Story` still compiles.
// All usages should migrate to `StoryDoc` over time.

export type Story = StoryDoc;
