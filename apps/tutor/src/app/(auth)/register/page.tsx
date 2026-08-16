"use client";
// apps/tutor/src/app/(auth)/register/page.tsx
// Create the Firebase Auth user client-side, then call
// registerTutorAccount to provision users/{uid}+tutors/{uid} and grant
// the role claim (functions/src/tutorAccounts.ts). Rolls back (deletes
// the just-created Auth user) if that callable fails — same
// create-then-rollback-on-failure shape as apps/web's signup.tsx, since
// this flow (unlike registerTutorAccount's own idempotent retry design)
// DOES own the Auth user's creation.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/lib/firebase";
import { useTutorT } from "@gloows/tutor-i18n";
import type { TutorRole } from "@gloows/shared-logic";
import { Button, Input } from "@/components/ui";

const ROLES: { value: TutorRole; titleKey: string; descKey: string; icon: string }[] = [
  { value: "TUTOR",           titleKey: "roleTutor",          descKey: "roleTutorDesc",          icon: "🧑‍🏫" },
  { value: "TEACHER",         titleKey: "roleTeacher",        descKey: "roleTeacherDesc",        icon: "🏫" },
  { value: "COACHING_CENTER", titleKey: "roleCoachingCenter", descKey: "roleCoachingCenterDesc", icon: "🏢" },
];

const registerTutorAccountFn = httpsCallable<
  { tutorRole: TutorRole; name: string; phone?: string },
  { uid: string; tutorRole: TutorRole }
>(functions, "registerTutorAccount");

export default function RegisterPage() {
  const { t } = useTutorT();
  const router = useRouter();

  const [role, setRole]         = useState<TutorRole | null>(null);
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [phone, setPhone]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!role) { setError(t("selectRole")); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setSubmitting(true);
    let createdUid: string | null = null;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      createdUid = cred.user.uid;

      await registerTutorAccountFn({ tutorRole: role, name: name.trim(), phone: phone.trim() });
      // Custom claim only lands on the NEXT token — force a refresh so
      // subsequent admin-gated reads/writes (none yet in Phase 1a, but
      // firestore.rules already checks request.auth.token.role for later
      // collections) see it immediately rather than after ~1hr.
      await cred.user.getIdToken(true);

      router.replace("/profile");
    } catch (err: any) {
      if (createdUid && auth.currentUser) {
        await deleteUser(auth.currentUser).catch(() => {});
      }
      setError(err?.message ?? "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col justify-center p-8 bg-bg">
      <div className="max-w-sm w-full mx-auto">
        <h1 className="text-2xl font-black text-slate-100 mb-6">{t("registerTitle")}</h1>

        <p className="text-xs font-semibold text-slate-400 mb-2">{t("selectRole")}</p>
        <div className="space-y-2 mb-5">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                role === r.value ? "border-brand-500 bg-brand-600/10" : "border-slate-700 bg-surface"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{r.icon}</span>
                <span className="font-bold text-slate-100 text-sm">{t(r.titleKey)}</span>
              </div>
              <p className="text-slate-500 text-xs mt-1">{t(r.descKey)}</p>
            </button>
          ))}
        </div>

        <form onSubmit={handleRegister}>
          <Input label={t("fullNameLabel")} required value={name} onChange={(e) => setName(e.target.value)} />
          <Input label={t("emailLabel")} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label={t("phoneLabel")} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label={t("passwordLabel")} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Input label={t("confirmPasswordLabel")} type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <p className="text-danger text-xs font-semibold mb-4">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? t("loading") : t("registerButton")}
          </Button>
        </form>
        <p className="text-center text-slate-500 text-sm mt-5">
          {t("alreadyHaveAccount")}{" "}
          <Link href="/login" className="text-brand-400 font-semibold">{t("loginLink")}</Link>
        </p>
      </div>
    </div>
  );
}
