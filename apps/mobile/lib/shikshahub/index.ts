// PATH: apps/mobile/lib/shikshahub/index.ts
// ShikshaHub — browsable marketplace of verified Gloows Tutor profiles.
// Mirrors apps/web/src/lib/shikshahub. Reads from the "tutorMarketplaceProfiles"
// collection, a public-safe (no phone/email) mirror of tutors/{uid} written
// server-side by functions/src/tutorMarketplace.ts's syncTutorMarketplaceProfile
// trigger whenever a tutor is Verified.

import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

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
