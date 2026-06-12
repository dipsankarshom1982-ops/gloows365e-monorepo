import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { hasPermission } from "../lib/permissions";

export interface AdminClaims {
  admin?: boolean;
  superAdmin?: boolean;
}

interface AuthContextValue {
  user: User | null;
  claims: AdminClaims;
  permissions: string[];
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  can: (key: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, claims: {}, permissions: [], loading: true,
  isAdmin: false, isSuperAdmin: false,
  can: () => false,
  login: async () => {}, logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]             = useState<User | null>(null);
  const [claims, setClaims]         = useState<AdminClaims>({});
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const token = await u.getIdTokenResult();
        const c: AdminClaims = {
          admin:      token.claims["admin"]      === true,
          superAdmin: token.claims["superAdmin"] === true,
        };
        setClaims(c);

        // Load per-admin permissions from Firestore
        try {
          const adminDoc = await getDoc(doc(db, "admins", u.uid));
          if (adminDoc.exists()) {
            setPermissions((adminDoc.data().permissions as string[]) ?? []);
          } else {
            setPermissions([]);
          }
        } catch {
          setPermissions([]);
        }
      } else {
        setClaims({});
        setPermissions([]);
      }
      setLoading(false);
    });
  }, []);

  const isSuperAdmin = claims.superAdmin === true;
  const isAdmin      = claims.admin      === true;

  const can = (key: string) => hasPermission(isSuperAdmin, permissions, key);

  const login  = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };
  const logout = async () => signOut(auth);

  return (
    <AuthContext.Provider value={{
      user, claims, permissions, loading,
      isAdmin, isSuperAdmin, can,
      login, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
