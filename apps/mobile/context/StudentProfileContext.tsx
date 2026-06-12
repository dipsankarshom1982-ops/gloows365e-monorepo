import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useSeekhoStore } from "@/store/seekhoStore";
import type { SeekhoBoard } from "@/lib/seekho/types";

export type StudentProfile = {
  name?: string;
  school?: string;
  class?: number | string;
  board?: string;
  phone?: string;
  location?: { district?: string; state?: string };
  interests?: string[];
  preferredLanguage?: string;
  profilePic?: string;
  LearnFunXP?: number;
  LearnFunCoins?: number;
  learnScore?: number;
  [key: string]: any;
};

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

export function StudentProfileProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const { setClassBoard } = useSeekhoStore();

  useEffect(() => {
    let unsubSnap: (() => void) | null = null;

    const unsubAuth = auth.onAuthStateChanged((firebaseUser) => {
      if (unsubSnap) { unsubSnap(); unsubSnap = null; }
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
            // Sync class+board to Seekho store whenever profile changes
            if (data.class && data.board) {
              setClassBoard(Number(data.class), data.board as SeekhoBoard);
            }
          } else {
            setStudentProfile(null);
          }
          setProfileLoading(false);
        },
        () => setProfileLoading(false)
      );
    });

    return () => { unsubAuth(); if (unsubSnap) unsubSnap(); };
  }, []);

  return (
    <StudentProfileContext.Provider value={{ user, authLoading, studentProfile, profileLoading }}>
      {children}
    </StudentProfileContext.Provider>
  );
}
