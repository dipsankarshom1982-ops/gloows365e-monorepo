// PATH: apps/web/src/lib/story.ts
// Mirrors mobile lib/story.ts exactly — same Firestore document shape.
// Single source of truth for story types shared between web Story viewer
// and the admin panel / mobile app that write these documents.

export interface StoryCta {
  text:       string;
  actionType: "internal" | "external";
  link:       string;
}

export interface StoryReward {
  coins: number;
  type:  "view" | "click" | "conversion";
}

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
  educationalCategory?: string;             // new — maps to StoryCategory.id
  language?:            string;             // e.g. "Bengali"
  classRange?:          [number, number];   // reading level filter

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
  storyKind?:      "normal" | "linked";
  learnMoreUrl?:   string;
  partnerId?:      string;
  partnerName?:    string;
  partnerLogoUrl?: string;
}

export type Story = StoryDoc;
