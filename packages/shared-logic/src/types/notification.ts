// ShikshaHub notifications phase — types for notifications/{uid}/items,
// the exact schema functions/src/shikshahubNotify.ts writes and
// apps/mobile's app/notifications.tsx already reads. This type/hook pair
// is what gives apps/tutor and apps/tutor-mobile (which had no
// notification inbox at all before this phase) the same capability.

export type ShikshaHubNotificationType = "instant_help" | "payout" | "review" | "shikshahub";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  type: ShikshaHubNotificationType;
  read: boolean;
  createdAt?: unknown; // Firestore Timestamp
};
