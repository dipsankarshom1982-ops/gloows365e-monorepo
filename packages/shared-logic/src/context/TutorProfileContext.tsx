"use client";
// packages/shared-logic/src/context/TutorProfileContext.tsx
//
// Tutor-side analogue of StudentProfileContext.tsx — same merge pattern
// (users/{uid} + a profile collection, profile collection wins on
// overlap), just pointed at tutors/{uid} instead of students/{uid}.
// Deliberately a SEPARATE hook/provider rather than a generalization of
// useStudentProfile(): the two profile shapes (TutorProfile vs
// StudentProfile) diverge enough (tutorRole, verified, subjects, ...)
// that forcing one generic hook to cover both would need a discriminated
// union threaded through every consumer for no real benefit — apps/tutor
// and apps/tutor-mobile only ever need the tutor shape.
//
// Platform-specific side effects don't belong here — same
// onProfileLoaded escape hatch as StudentProfileContext.

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getSharedAuth, getSharedDb } from "../lib/firebaseConfig";
import type { TutorProfile } from "../types/tutor";

type TutorProfileContextType = {
  user: User | null;
  authLoading: boolean;
  tutorProfile: TutorProfile | null;
  profileLoading: boolean;
};

const TutorProfileContext = createContext<TutorProfileContextType>({
  user: null,
  authLoading: true,
  tutorProfile: null,
  profileLoading: true,
});

export const useTutorProfile = () => useContext(TutorProfileContext);

interface Props {
  children: ReactNode;
  onProfileLoaded?: (profile: TutorProfile) => void;
}

export function TutorProfileProvider({ children, onProfileLoaded }: Props) {
  const [user, setUser]                   = useState<User | null>(null);
  const [authLoading, setAuthLoading]     = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [tutorProfile, setTutorProfile]   = useState<TutorProfile | null>(null);

  // Track both docs' latest data so either listener firing can recompute
  // the merged profile without racing the other. profileLoading only
  // flips to false once BOTH docs have reported back at least once.
  const tutorDataRef   = useRef<Record<string, unknown> | null>(null);
  const userDataRef    = useRef<Record<string, unknown> | null>(null);
  const tutorLoadedRef = useRef(false);
  const userLoadedRef  = useRef(false);

  const recomputeProfile = useCallback(() => {
    const t = tutorDataRef.current;
    const u = userDataRef.current;
    if (!t && !u) {
      setTutorProfile(null);
    } else {
      // tutors/ is the canonical source for profile fields and wins on
      // overlap; users/ adds role/auth-common fields.
      const merged = { ...(u ?? {}), ...(t ?? {}) } as TutorProfile;
      setTutorProfile(merged);
      onProfileLoaded?.(merged);
    }
    if (tutorLoadedRef.current && userLoadedRef.current) {
      setProfileLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const auth = getSharedAuth();
    const db   = getSharedDb();

    let unsubTutor: (() => void) | null = null;
    let unsubUser:  (() => void) | null = null;

    const unsubAuth = auth.onAuthStateChanged((firebaseUser) => {
      unsubTutor?.(); unsubTutor = null;
      unsubUser?.();  unsubUser  = null;
      tutorDataRef.current = null;
      userDataRef.current  = null;
      tutorLoadedRef.current = false;
      userLoadedRef.current  = false;

      setUser(firebaseUser);
      setAuthLoading(false);

      if (!firebaseUser) {
        setTutorProfile(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);

      unsubTutor = onSnapshot(
        doc(db, "tutors", firebaseUser.uid),
        (snap) => {
          tutorDataRef.current = snap.exists() ? snap.data() : null;
          tutorLoadedRef.current = true;
          recomputeProfile();
        },
        () => { tutorLoadedRef.current = true; recomputeProfile(); }
      );

      unsubUser = onSnapshot(
        doc(db, "users", firebaseUser.uid),
        (snap) => {
          userDataRef.current = snap.exists() ? snap.data() : null;
          userLoadedRef.current = true;
          recomputeProfile();
        },
        () => { userLoadedRef.current = true; recomputeProfile(); }
      );
    });

    return () => { unsubAuth(); unsubTutor?.(); unsubUser?.(); };
  }, [recomputeProfile]);

  return (
    <TutorProfileContext.Provider value={{ user, authLoading, tutorProfile, profileLoading }}>
      {children}
    </TutorProfileContext.Provider>
  );
}
