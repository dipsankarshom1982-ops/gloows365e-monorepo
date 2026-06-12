"use client";

// packages/shared-logic/src/context/StudentProfileContext.tsx
//
// ✅ Shared — works on mobile and web.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getSharedAuth, getSharedDb } from "../lib/firebaseConfig";
import type { StudentProfile } from "../types/student";

type StudentProfileContextType = {
  user: User | null;
  authLoading: boolean;
  studentProfile: StudentProfile | null;
  profileLoading: boolean;
};

const StudentProfileContext = createContext<StudentProfileContextType>({
  user: null,
  authLoading: true,
  studentProfile: null,
  profileLoading: true,
});

export const useStudentProfile = () => useContext(StudentProfileContext);

interface Props {
  children: ReactNode;
  /** Optional callback fired when profile loads — mobile uses this to sync seekhoStore */
  onProfileLoaded?: (profile: StudentProfile) => void;
}

export function StudentProfileProvider({ children, onProfileLoaded }: Props) {
  const [user, setUser]                     = useState<User | null>(null);
  const [authLoading, setAuthLoading]       = useState(true);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const auth = getSharedAuth();
    const db   = getSharedDb();
    let unsubSnap: (() => void) | null = null;

    const unsubAuth = auth.onAuthStateChanged((firebaseUser) => {
      unsubSnap?.(); unsubSnap = null;
      setUser(firebaseUser);
      setAuthLoading(false);

      if (!firebaseUser) {
        setStudentProfile(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      unsubSnap = onSnapshot(
        doc(db, "students", firebaseUser.uid),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as StudentProfile;
            setStudentProfile(data);
            onProfileLoaded?.(data);
          } else {
            setStudentProfile(null);
          }
          setProfileLoading(false);
        },
        () => setProfileLoading(false)
      );
    });

    return () => { unsubAuth(); unsubSnap?.(); };
  }, []);

  return (
    <StudentProfileContext.Provider value={{ user, authLoading, studentProfile, profileLoading }}>
      {children}
    </StudentProfileContext.Provider>
  );
}