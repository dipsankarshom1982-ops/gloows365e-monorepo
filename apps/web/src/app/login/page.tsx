"use client";

// apps/web/src/app/login/page.tsx
// Web login for Gloows365E — same Firebase Auth project as the mobile app.
// Modes: Sign in / Create account / Reset password. Email+password and Google.
// On success → /home (the web home page, mirroring the mobile app home).

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, app } from "@/lib/firebase";

const db = getFirestore(app);

type Mode = "signin" | "signup" | "reset";

// ---------------------------------------------------------------------------
// First-login bootstrap into the SAME collection mobile uses: users/{uid}.
// Only creates the doc if it doesn't exist. Deliberately does NOT set
// profileType — so when this user later opens the mobile app, the normal
// registration flow (class/board selection) still triggers correctly.
// VCoins fields (vCoinsYear_XXXX) are managed by Cloud Functions only.
// ---------------------------------------------------------------------------
async function ensureUserDoc(user: User) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  await setDoc(
    ref,
    {
      uid: user.uid,
      email: user.email ?? "",
      name: user.displayName ?? "",
      photoURL: user.photoURL ?? "",
      signupPlatform: "web",
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// Friendly messages for the Firebase Auth errors students will actually hit.
function friendlyError(code: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn't look right. Please check it.";
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Email or password is incorrect. Please try again.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in instead.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a minute and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return ""; // user closed the Google popup — not an error worth showing
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Already signed in? Go straight to home.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/home");
      } else {
        setCheckingAuth(false);
      }
    });
    return unsub;
  }, [router]);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);

    try {
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email.trim());
        setNotice("Password reset email sent. Check your inbox.");
        return;
      }

      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
        await ensureUserDoc(cred.user);
      } else {
        const cred = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        await ensureUserDoc(cred.user);
      }

      router.replace("/home");
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code: string }).code)
          : "";
      const msg = friendlyError(code);
      if (msg) setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await ensureUserDoc(cred.user);
      router.replace("/home");
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code: string }).code)
          : "";
      const msg = friendlyError(code);
      if (msg) setError(msg);
    } finally {
      setBusy(false);
    }
  }

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              Gloows365E
            </span>
          </Link>
          <p className="mt-2 text-sm text-neutral-400">
            {mode === "signin" && "Welcome back. Sign in to continue learning."}
            {mode === "signup" && "Create your free account and start learning."}
            {mode === "reset" && "Enter your email to reset your password."}
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-xl backdrop-blur sm:p-8">
          {/* Google sign-in (hidden in reset mode) */}
          {mode !== "reset" && (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={busy}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-neutral-700 bg-neutral-800/60 px-4 py-3 text-sm font-medium text-neutral-100 transition hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.36c1.62 0 3.06.56 4.21 1.64l3.16-3.16A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.29 9.14 5.36 12 5.36z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-neutral-800" />
                <span className="text-xs uppercase tracking-wider text-neutral-500">
                  or
                </span>
                <div className="h-px flex-1 bg-neutral-800" />
              </div>
            </>
          )}

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label
                  htmlFor="name"
                  className="mb-1.5 block text-sm font-medium text-neutral-300"
                >
                  Full name
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-800/60 px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-neutral-300"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-800/60 px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                placeholder="student@example.com"
              />
            </div>

            {mode !== "reset" && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-neutral-300"
                  >
                    Password
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => switchMode("reset")}
                      className="text-xs text-violet-400 hover:text-violet-300"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-800/60 px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  placeholder="••••••••"
                />
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-400"
              >
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-400">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-violet-500 hover:to-cyan-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50"
            >
              {busy
                ? "Please wait…"
                : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                ? "Create account"
                : "Send reset email"}
            </button>
          </form>

          {/* Mode switcher */}
          <p className="mt-6 text-center text-sm text-neutral-400">
            {mode === "signin" && (
              <>
                New to Gloows365E?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="font-medium text-violet-400 hover:text-violet-300"
                >
                  Create an account
                </button>
              </>
            )}
            {mode === "signup" && (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="font-medium text-violet-400 hover:text-violet-300"
                >
                  Sign in
                </button>
              </>
            )}
            {mode === "reset" && (
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="font-medium text-violet-400 hover:text-violet-300"
              >
                ← Back to sign in
              </button>
            )}
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-600">
          Shikshakool Academy Private Limited · gloows365.in
        </p>
      </div>
    </main>
  );
}