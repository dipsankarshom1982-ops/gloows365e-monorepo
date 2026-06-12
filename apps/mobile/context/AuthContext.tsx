import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  roles: string[];
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  roles: [],
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: any) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setUser(null);
          setRoles([]);
          setLoading(false);
          return;
        }

        setUser(user);
        setLoading(false); // auth confirmed — stop spinner before Firestore fetch

        // Fetch roles in background; failure is non-fatal
        try {
          const ref = doc(db, "users", user.uid);
          const snap = await getDoc(ref);
          setRoles(snap.exists() ? (snap.data().roles ?? []) : []);
        } catch (error) {
          console.log("Role fetch error:", error);
        }

      } catch (error) {
        console.log("Auth Error:", error);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, roles }}>
      {children}
    </AuthContext.Provider>
  );
}