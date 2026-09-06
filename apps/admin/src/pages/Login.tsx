import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await login(email, password);

      // Verify the signed-in user actually has an admin claim.
      // Without this check, any Firebase Auth account in this project
      // could reach the admin panel — ProtectedRoutes is the backstop
      // but we should also block at the login step for a clean UX.
      const { getAuth, getIdTokenResult } = await import("firebase/auth");
      const currentUser = getAuth().currentUser;
      if (currentUser) {
        const token = await getIdTokenResult(currentUser, /* forceRefresh */ true);
        const isAdminClaim   = token.claims["admin"]      === true;
        const isSuperAdmin   = token.claims["superAdmin"] === true;
        if (!isAdminClaim && !isSuperAdmin) {
          // Sign them back out immediately — they have a valid Firebase Auth
          // account but no admin custom claim.
          const { signOut } = await import("firebase/auth");
          await signOut(getAuth());
          setError("Your account does not have admin access. Contact a super admin.");
          return;
        }
      }

      navigate("/");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setError("Invalid email or password.");
      } else if (code === "auth/user-not-found") {
        setError("No account found with this email.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Sign-in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <span className="text-5xl">✨</span>
          <h1 className="text-2xl font-black text-white mt-3">GLOOWS365E Ads Admin</h1>
          <p className="text-slate-400 text-sm mt-1">Authorized admin access only</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-5">
          <div>
            <label className="text-slate-300 text-sm font-semibold block mb-2">Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="admin@gloows365e.com"
            />
          </div>
          <div>
            <label className="text-slate-300 text-sm font-semibold block mb-2">Password</label>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
