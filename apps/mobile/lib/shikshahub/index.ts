// PATH: apps/mobile/lib/shikshahub/index.ts
// ShikshaHub — browsable marketplace of verified Gloows Tutor profiles.
// Mirrors apps/web/src/lib/shikshahub. Reads from the "tutorMarketplaceProfiles"
// collection, a public-safe (no phone/email) mirror of tutors/{uid} written
// server-side by functions/src/tutorMarketplace.ts's syncTutorMarketplaceProfile
// trigger whenever a tutor is Verified.
//
// ShikshaHub Phase 2 — brought to parity with the web version's booking
// helpers (sessionFee/availability fields, weekday slot derivation,
// requestBookingCall/cancelBookingCall/listenToBooking) which mobile
// previously lacked entirely. See requestBooking's own header comment in
// functions/src/tutorBooking.ts for why there's no payment anywhere here.

import { db, functions } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type {
  Booking, BookingSessionType, TutorService, TutorWeeklyAvailability,
  InstantHelpRequest, InstantHelpSession, TutorCreditPack,
} from "@gloows/shared-logic";

export interface MarketplaceTutor {
  uid: string;
  name: string;
  bio: string;
  subjects: string[];
  qualification: string;
  teachingExperienceYears: number | null;
  preferredLanguage: string;
  profilePic: string;
  tutorRole: string;
  // ShikshaHub Phase 1/2 — both optional/nullable: older mirror docs synced
  // before booking landed won't have them, and the UI must not invent a
  // fee/schedule that isn't really there.
  sessionFee: number | null;
  availability: TutorWeeklyAvailability | null;
  // ShikshaHub Phase 4 — live Instant Help presence, see
  // apps/web/src/lib/shikshahub/index.ts's mirrored comment.
  isOnlineForInstantHelp: boolean;
  // ShikshaHub Phase 6 — public rating aggregate, see
  // apps/web/src/lib/shikshahub/index.ts's mirrored comment.
  ratingCount: number;
  ratingAverage: number | null;
}

const COLLECTION = "tutorMarketplaceProfiles";

function fromDoc(d: any): MarketplaceTutor {
  const data = d.data();
  return {
    uid: d.id,
    name: data.name ?? "",
    bio: data.bio ?? "",
    subjects: data.subjects ?? [],
    qualification: data.qualification ?? "",
    teachingExperienceYears: data.teachingExperienceYears ?? null,
    preferredLanguage: data.preferredLanguage ?? "",
    profilePic: data.profilePic ?? "",
    tutorRole: data.tutorRole ?? "TUTOR",
    sessionFee: Number.isInteger(data.sessionFee) && data.sessionFee > 0 ? data.sessionFee : null,
    availability: data.availability ?? null,
    isOnlineForInstantHelp: data.isOnlineForInstantHelp === true,
    ratingCount: Number.isInteger(data.ratingCount) && data.ratingCount > 0 ? data.ratingCount : 0,
    ratingAverage: typeof data.ratingAverage === "number" && Number(data.ratingCount) > 0 ? data.ratingAverage : null,
  };
}

/** Every verified tutor's public marketplace profile — the collection only
 *  ever contains verified tutors by construction, so no `where` clause (and
 *  no composite index) is needed, just an alphabetical order. */
export async function fetchAllTutors(): Promise<MarketplaceTutor[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy("name", "asc")));
  return snap.docs.map(fromDoc);
}

export async function fetchTutorById(uid: string): Promise<MarketplaceTutor | null> {
  const snap = await getDoc(doc(db, COLLECTION, uid));
  if (!snap.exists()) return null;
  return fromDoc(snap);
}

/** Distinct subject values across a fetched tutor list, for filter chips.
 *  No fixed picker — tutor `subjects` is free-text, so this just
 *  dedupes/sorts whatever's actually there. */
export function deriveSubjectChips(tutors: MarketplaceTutor[]): string[] {
  const set = new Set<string>();
  for (const t of tutors) for (const s of t.subjects) if (s.trim()) set.add(s.trim());
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// ─── ShikshaHub Phase 1/2 — tutor booking ──────────────────────────────────

const WEEKDAY_KEYS = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
] as const;

/** "YYYY-MM-DD" → the matching TutorWeekday key, parsed as a local date
 *  (not UTC) so "picking today" always maps to today's own weekday
 *  regardless of timezone offset. */
export function weekdayKeyForDate(dateStr: string): (typeof WEEKDAY_KEYS)[number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return null;
  return WEEKDAY_KEYS[d.getDay()];
}

/** Turns a tutor's declared "enabled 17:00–20:00" window for one weekday
 *  into a flat list of hour-long "17:00–18:00" style slot option strings.
 *  Deliberately no conflict detection / already-booked exclusion yet —
 *  that's Phase 3 scope. */
export function slotOptionsForDate(
  availability: TutorWeeklyAvailability | null,
  dateStr: string
): { label: string; start: string; end: string }[] {
  const key = weekdayKeyForDate(dateStr);
  const day = key ? availability?.[key] : undefined;
  if (!day?.enabled || !day.start || !day.end) return [];

  const [startH] = day.start.split(":").map(Number);
  const [endH]   = day.end.split(":").map(Number);
  if (!Number.isFinite(startH) || !Number.isFinite(endH) || endH <= startH) return [];

  const slots: { label: string; start: string; end: string }[] = [];
  for (let h = startH; h < endH; h++) {
    const start = `${String(h).padStart(2, "0")}:00`;
    const end   = `${String(h + 1).padStart(2, "0")}:00`;
    slots.push({ label: `${start} – ${end}`, start, end });
  }
  return slots;
}

// ─── ShikshaHub Phase 3 — tutor services ────────────────────────────────────
// Reads from tutorServicesMarketplace, the public-safe mirror written by
// functions/src/tutorServices.ts's syncTutorServiceMarketplace trigger.
// Only ever contains published services of verified tutors, by
// construction — see apps/web/src/lib/shikshahub/index.ts's mirrored
// header comment for why no published/verified filtering is needed here.

const SERVICES_COLLECTION = "tutorServicesMarketplace";

/** A tutor's published, bookable services (empty array if they have none —
 *  the caller falls back to the legacy flat sessionFee/availability path
 *  in that case, matching requestBooking's own migration rule). */
export async function fetchTutorServices(tutorUid: string): Promise<TutorService[]> {
  const snap = await getDocs(
    query(collection(db, SERVICES_COLLECTION), where("tutorUid", "==", tutorUid), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorService));
}

export interface RequestBookingInput {
  tutorUid: string;
  serviceId?: string;
  subject: string;
  sessionType: BookingSessionType;
  requestedDate: string;
  requestedStartTime: string;
  requestedEndTime: string;
}

export async function requestBookingCall(
  input: RequestBookingInput
): Promise<{ bookingId: string; status: Booking["status"] }> {
  const fn = httpsCallable<RequestBookingInput, { bookingId: string; status: Booking["status"] }>(
    functions, "requestBooking"
  );
  const res = await fn(input);
  return res.data;
}

/** ShikshaHub Phase 2 — either party (student or tutor) can cancel a
 *  "requested"/"accepted" booking. Same Admin-SDK-only write path as
 *  requestBooking/respondToBooking. */
export async function cancelBookingCall(
  bookingId: string
): Promise<{ status: Booking["status"] }> {
  const fn = httpsCallable<{ bookingId: string }, { status: Booking["status"] }>(
    functions, "cancelBooking"
  );
  const res = await fn({ bookingId });
  return res.data;
}

/** Live status for one booking the current student owns — relies on
 *  firestore.rules' bookings/{id} read rule (studentUid/tutorUid ==
 *  caller), not on trusting anything client-side. */
export function listenToBooking(bookingId: string, onChange: (booking: Booking | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, "bookings", bookingId),
    (snap) => onChange(snap.exists() ? ({ id: snap.id, ...snap.data() } as Booking) : null),
    () => onChange(null)
  );
}

// ─── ShikshaHub Phase 4 — Instant Help matching/session/billing ────────────
// Thin httpsCallable wrappers over functions/src/instantHelp.ts — see
// apps/web/src/lib/shikshahub/index.ts's mirrored header comment. Live
// state is watched via @gloows/shared-logic's
// useIncomingInstantHelpRequests/useMyInstantHelpRequest/
// useActiveInstantHelpSession hooks, not polled from here.

export async function setInstantHelpOnlineStatusCall(online: boolean): Promise<{ online: boolean }> {
  const fn = httpsCallable<{ online: boolean }, { online: boolean }>(functions, "setInstantHelpOnlineStatus");
  const res = await fn({ online });
  return res.data;
}

export async function requestInstantHelpCall(
  tutorUid: string,
  serviceId: string
): Promise<{ requestId: string; status: InstantHelpRequest["status"] }> {
  const fn = httpsCallable<{ tutorUid: string; serviceId: string }, { requestId: string; status: InstantHelpRequest["status"] }>(
    functions, "requestInstantHelp"
  );
  const res = await fn({ tutorUid, serviceId });
  return res.data;
}

export async function cancelInstantHelpRequestCall(
  requestId: string
): Promise<{ status: InstantHelpRequest["status"] }> {
  const fn = httpsCallable<{ requestId: string }, { status: InstantHelpRequest["status"] }>(
    functions, "cancelInstantHelpRequest"
  );
  const res = await fn({ requestId });
  return res.data;
}

export async function respondToInstantHelpRequestCall(
  requestId: string,
  action: "accepted" | "declined"
): Promise<{ status: InstantHelpRequest["status"]; sessionId?: string }> {
  const fn = httpsCallable<
    { requestId: string; action: "accepted" | "declined" },
    { status: InstantHelpRequest["status"]; sessionId?: string }
  >(functions, "respondToInstantHelpRequest");
  const res = await fn({ requestId, action });
  return res.data;
}

export async function endInstantHelpSessionCall(
  sessionId: string
): Promise<{ status: InstantHelpSession["status"]; endReason?: string; minutesCharged: number }> {
  const fn = httpsCallable<
    { sessionId: string },
    { status: InstantHelpSession["status"]; endReason?: string; minutesCharged: number }
  >(functions, "endInstantHelpSession");
  const res = await fn({ sessionId });
  return res.data;
}

// ─── ShikshaHub Phase 4 — tutor credits (funds Instant Help billing) ───────

const CREDIT_PACKS_COLLECTION = "tutorCreditPacks";

export async function fetchTutorCreditPacks(): Promise<TutorCreditPack[]> {
  const snap = await getDocs(collection(db, CREDIT_PACKS_COLLECTION));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as TutorCreditPack))
    .filter((p) => p.isActive !== false);
}

export async function createTutorCreditOrderCall(
  packId: string
): Promise<{ razorpayOrderId: string; amountPaise: number; credits: number; packName: string }> {
  const fn = httpsCallable<
    { packId: string },
    { razorpayOrderId: string; amountPaise: number; credits: number; packName: string }
  >(functions, "createTutorCreditOrder");
  const res = await fn({ packId });
  return res.data;
}

// ─── ShikshaHub Phase 6 — tutor ratings & reviews ───────────────────────────
export async function submitTutorReviewCall(
  sessionId: string,
  rating: number,
  reviewText?: string
): Promise<{ reviewId: string }> {
  const fn = httpsCallable<{ sessionId: string; rating: number; reviewText?: string }, { reviewId: string }>(
    functions, "submitTutorReview"
  );
  const res = await fn({ sessionId, rating, reviewText });
  return res.data;
}

// Booking completion phase — the same submitTutorReview callable, but for
// a completed (status "completed") scheduled bookings/{id} instead of an
// ended Instant Help session. Kept separate rather than widening
// submitTutorReviewCall's signature so InstantHelpBar's existing call
// site above never has to change.
export async function submitBookingReviewCall(
  bookingId: string,
  rating: number,
  reviewText?: string
): Promise<{ reviewId: string }> {
  const fn = httpsCallable<{ bookingId: string; rating: number; reviewText?: string }, { reviewId: string }>(
    functions, "submitTutorReview"
  );
  const res = await fn({ bookingId, rating, reviewText });
  return res.data;
}

// ─── ShikshaHub messaging phase — tutor-student conversations ──────────────
// See apps/web/src/lib/shikshahub/index.ts's mirrored comment /
// functions/src/tutorMessaging.ts's header comment for the full design.

export function conversationIdFor(studentUid: string, tutorUid: string): string {
  return `${studentUid}_${tutorUid}`;
}

export async function sendTutorMessageCall(
  peerUid: string,
  text: string
): Promise<{ conversationId: string; messageId: string }> {
  const fn = httpsCallable<{ peerUid: string; text: string }, { conversationId: string; messageId: string }>(
    functions, "sendTutorMessage"
  );
  const res = await fn({ peerUid, text });
  return res.data;
}

export async function markConversationReadCall(conversationId: string): Promise<{ conversationId: string }> {
  const fn = httpsCallable<{ conversationId: string }, { conversationId: string }>(functions, "markConversationRead");
  const res = await fn({ conversationId });
  return res.data;
}
