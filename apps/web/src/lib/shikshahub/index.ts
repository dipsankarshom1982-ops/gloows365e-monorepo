// PATH: apps/web/src/lib/shikshahub/index.ts
// ShikshaHub — browsable marketplace of verified Gloows Tutor profiles.
// Mirrors apps/mobile/lib/shikshahub. Reads from the "tutorMarketplaceProfiles"
// collection, a public-safe (no phone/email) mirror of tutors/{uid} written
// server-side by functions/src/tutorMarketplace.ts's syncTutorMarketplaceProfile
// trigger whenever a tutor is Verified — see that file's header comment for
// why this isn't a client-widened read of tutors/{uid} directly.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { where } from "firebase/firestore";
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
  // ShikshaHub Phase 1 — both optional/nullable: older mirror docs synced
  // before this phase landed won't have them, and the UI must not invent
  // a fee/schedule that isn't really there (see the Phase 1 audit's "hide
  // fields that aren't available" rule, same as every other field here).
  sessionFee: number | null;
  availability: TutorWeeklyAvailability | null;
  // ShikshaHub Phase 4 — live Instant Help presence (see
  // tutorMarketplace.ts's SAFE_FIELDS). Defaults false, never null/
  // undefined — "not online" is the correct default for any tutor who
  // predates this field, same as every other boolean flag in this file.
  isOnlineForInstantHelp: boolean;
  // ShikshaHub Phase 6 — public rating aggregate. null (not 0) when the
  // tutor has no reviews yet, so the UI can distinguish "unrated" from
  // "rated 0" and hide the rating row entirely rather than show "0.0".
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
  const db = getFirestore();
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy("name", "asc")));
  return snap.docs.map(fromDoc);
}

export async function fetchTutorById(uid: string): Promise<MarketplaceTutor | null> {
  const db = getFirestore();
  const snap = await getDoc(doc(db, COLLECTION, uid));
  if (!snap.exists()) return null;
  return fromDoc(snap);
}

/** Distinct subject values across a fetched tutor list, for filter chips.
 *  No fixed picker — tutor `subjects` is free-text (see apps/tutor's
 *  profile page), so this just dedupes/sorts whatever's actually there.
 *  A curated picker is a natural future improvement, not this pass. */
export function deriveSubjectChips(tutors: MarketplaceTutor[]): string[] {
  const set = new Set<string>();
  for (const t of tutors) for (const s of t.subjects) if (s.trim()) set.add(s.trim());
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// ─── ShikshaHub Phase 1 — minimum viable tutor booking ─────────────────────
// No payment here (see requestBooking's own header comment in
// functions/src/tutorBooking.ts) — this just calls the two callables and
// listens to the resulting bookings/{id} doc for a live status update.

const WEEKDAY_KEYS = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
] as const;

/** "YYYY-MM-DD" → the matching TutorWeekday key, parsed as a local date
 *  (not UTC) so "picking today" always maps to today's own weekday
 *  regardless of timezone offset — deliberately simple, no timezone
 *  conversion beyond that (see the Phase 1 audit: full timezone handling
 *  is Phase 3 scope). */
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
 *  that needs real availability-vs-existing-bookings cross-checking,
 *  explicitly Phase 3 scope per the audit. */
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

/** Web ShikshaHub polish pass — ported verbatim from
 *  apps/mobile/lib/shikshahub's nextAvailableLabel (same weekday-scan
 *  logic, same "today's window already passed" check). Used by the tutor
 *  card / profile Availability Preview when a tutor isn't currently
 *  online for Instant Help, so the card still shows something real
 *  ("Next available: Tomorrow, 5:00 PM") instead of nothing. */
export function nextAvailableLabel(availability: TutorWeeklyAvailability | null): string | null {
  if (!availability) return null;
  const now = new Date();
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(now);
    d.setDate(now.getDate() + offset);
    const key = WEEKDAY_KEYS[d.getDay()];
    const day = availability[key];
    if (!day?.enabled || !day.start || !day.end) continue;

    if (offset === 0) {
      const [endH, endM] = day.end.split(":").map(Number);
      const dayEnd = new Date(d);
      dayEnd.setHours(endH, endM || 0, 0, 0);
      if (now > dayEnd) continue; // today's window already passed
    }

    const [startH, startM] = day.start.split(":").map(Number);
    const period = startH >= 12 ? "PM" : "AM";
    const hour12 = ((startH + 11) % 12) + 1;
    const timeLabel = `${hour12}:${String(startM || 0).padStart(2, "0")} ${period}`;
    const dayLabel = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "long" });
    return `${dayLabel}, ${timeLabel}`;
  }
  return null;
}

// ─── ShikshaHub Phase 3 — tutor services ────────────────────────────────────
// Reads from tutorServicesMarketplace, the public-safe mirror written by
// functions/src/tutorServices.ts's syncTutorServiceMarketplace trigger —
// same owner-doc/public-mirror split as tutorMarketplaceProfiles above.
// Only ever contains published services of verified tutors, by
// construction — no client-side published/verified filtering needed.

const SERVICES_COLLECTION = "tutorServicesMarketplace";

/** A tutor's published, bookable services (empty array if they have none —
 *  the caller falls back to the legacy flat sessionFee/availability path
 *  in that case, matching requestBooking's own migration rule). */
export async function fetchTutorServices(tutorUid: string): Promise<TutorService[]> {
  const db = getFirestore();
  const snap = await getDocs(
    query(collection(db, SERVICES_COLLECTION), where("tutorUid", "==", tutorUid), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorService));
}

// ─── Web ShikshaHub polish pass — Instant Tutor discovery ──────────────────
// Ported verbatim (same query, same ranking) from apps/mobile/lib/shikshahub
// — that's where these were originally built for the mobile "Instant
// Tutor" hero flow (see apps/mobile/app/(drawer)/(tabs)/shikshahub.tsx and
// components/shikshahub/InstantTutorSheet.tsx). Web never had an
// equivalent hero flow; this brings the same real data-layer capability
// here so the web page can offer the identical feature, not a fake one.

/** Every published instant_help service across every tutor (not scoped to
 *  one tutorUid, unlike fetchTutorServices above) so the Instant Tutor
 *  flow can find a match by subject without the caller already knowing
 *  which tutor to ask. Single equality filter, no orderBy — no composite
 *  index needed, and firestore.rules' `allow read: if request.auth !=
 *  null` on tutorServicesMarketplace already permits this shape of query. */
export async function fetchAllInstantHelpServices(): Promise<TutorService[]> {
  const db = getFirestore();
  const snap = await getDocs(
    query(collection(db, SERVICES_COLLECTION), where("serviceType", "==", "instant_help"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorService));
}

/** Subjects with at least one currently-online tutor offering Instant Help
 *  — drives the Instant Tutor flow's subject picker. Purely derived from
 *  real data (no fixed subject list), same reasoning as deriveSubjectChips
 *  above. */
export function deriveInstantHelpSubjects(tutors: MarketplaceTutor[], services: TutorService[]): string[] {
  const onlineUids = new Set(tutors.filter((tu) => tu.isOnlineForInstantHelp).map((tu) => tu.uid));
  const set = new Set<string>();
  for (const s of services) {
    if (s.serviceType === "instant_help" && onlineUids.has(s.tutorUid) && s.subject?.trim()) {
      set.add(s.subject.trim());
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export interface InstantHelpCandidate {
  tutor: MarketplaceTutor;
  service: TutorService;
}

/** Ranks currently-online, subject-matching Instant Help tutors — by
 *  rating, then experience, then name — for the Instant Tutor flow's
 *  "best match" step. No fan-out/broadcast matching engine exists
 *  server-side (see functions/src/instantHelp.ts's header comment:
 *  direct-request model only, one student -> one tutor) — this just picks
 *  the best real candidate client-side and sends the request to them. */
export function rankInstantHelpMatches(
  tutors: MarketplaceTutor[],
  services: TutorService[],
  subject: string
): InstantHelpCandidate[] {
  const onlineByUid = new Map(tutors.filter((tu) => tu.isOnlineForInstantHelp).map((tu) => [tu.uid, tu]));
  const needle = subject.trim().toLowerCase();
  const candidates: InstantHelpCandidate[] = [];
  for (const s of services) {
    if (s.serviceType !== "instant_help") continue;
    if ((s.subject ?? "").trim().toLowerCase() !== needle) continue;
    const tutor = onlineByUid.get(s.tutorUid);
    if (!tutor) continue;
    candidates.push({ tutor, service: s });
  }
  candidates.sort((a, b) => {
    const ar = a.tutor.ratingAverage ?? -1, br = b.tutor.ratingAverage ?? -1;
    if (ar !== br) return br - ar;
    const ae = a.tutor.teachingExperienceYears ?? -1, be = b.tutor.teachingExperienceYears ?? -1;
    if (ae !== be) return be - ae;
    return a.tutor.name.localeCompare(b.tutor.name);
  });
  return candidates;
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

/** Booking payment phase — starts a Razorpay order for an "accepted"
 *  booking. Server resolves the amount from bookings/{id}.sessionFee
 *  (never trusts anything sent here beyond bookingId itself); the
 *  returned razorpayOrderId/grossAmountPaise feed straight into the
 *  existing <RazorpayCheckout> component. Confirmation happens ONLY via
 *  the server-side webhook (functions/src/razorpayWebhook.ts) — there is
 *  no separate "payment success" callable for bookings to call afterward;
 *  the caller instead watches listenToBooking below for
 *  financialStatus to flip. */
export async function createBookingPaymentOrderCall(
  bookingId: string
): Promise<{ razorpayOrderId: string; grossAmountPaise: number; paymentExpiresAtMillis: number }> {
  const fn = httpsCallable<
    { bookingId: string },
    { razorpayOrderId: string; grossAmountPaise: number; keyId: string; paymentExpiresAtMillis: number }
  >(functions, "createBookingPaymentOrder");
  const res = await fn({ bookingId });
  return res.data;
}

/** Live status for one booking the current student owns — relies on
 *  firestore.rules' bookings/{id} read rule (studentUid/tutorUid ==
 *  caller), not on trusting anything client-side. */
export function listenToBooking(bookingId: string, onChange: (booking: Booking | null) => void): Unsubscribe {
  const db = getFirestore();
  return onSnapshot(
    doc(db, "bookings", bookingId),
    (snap) => onChange(snap.exists() ? ({ id: snap.id, ...snap.data() } as Booking) : null),
    () => onChange(null)
  );
}

// ─── ShikshaHub Phase 4 — Instant Help matching/session/billing ────────────
// Thin httpsCallable wrappers over functions/src/instantHelp.ts — no
// business logic here, everything (eligibility, balance checks, race
// closing, billing) is server-side. Live state (incoming requests, own
// pending request, active session) is watched via the
// useIncomingInstantHelpRequests/useMyInstantHelpRequest/
// useActiveInstantHelpSession hooks in @gloows/shared-logic, not polled
// from here.

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
  const db = getFirestore();
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
// Reviewable only off a completed (status "ended") Instant Help session —
// see functions/src/tutorReviews.ts's header comment for why scheduled
// bookings aren't reviewable yet.

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
// ended Instant Help session. Kept as a separate function rather than
// widening submitTutorReviewCall's signature so InstantHelpBar's existing
// call site above never has to change.
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
// See functions/src/tutorMessaging.ts's header comment for the full
// design (one conversation per student-tutor pair, tutor can only ever
// reply not initiate). conversationIdFor mirrors that file's own
// deterministic-id formula so the client can link straight to a thread
// (/shikshahub/messages/thread?peer={tutorUid}) without a network round
// trip just to resolve which conversation doc it is.

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
