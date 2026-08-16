"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useTutorT } from "@gloows/tutor-i18n";
import { Button, Input } from "@/components/ui";

export default function LoginPage() {
  const { t } = useTutorT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/");
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col justify-center p-8 bg-bg">
      <div className="max-w-sm w-full mx-auto">
        <h1 className="text-2xl font-black text-slate-100 mb-6">{t("loginTitle")}</h1>
        <form onSubmit={handleLogin}>
          <Input label={t("emailLabel")} type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <Input label={t("passwordLabel")} type="password" required value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          {error && <p className="text-danger text-xs font-semibold mb-4">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? t("loading") : t("loginButton")}
          </Button>
        </form>
        <p className="text-center text-slate-500 text-sm mt-5">
          {t("noAccount")}{" "}
          <Link href="/register" className="text-brand-400 font-semibold">{t("signUpLink")}</Link>
        </p>
      </div>
    </div>
  );
}
