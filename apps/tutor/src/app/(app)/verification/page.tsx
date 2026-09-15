"use client";
// apps/tutor/src/app/(app)/verification/page.tsx
// Upload documents to Storage (tutorDocuments/{uid}/{fileName} — private,
// see storage.rules) directly from the client, then call
// submitTutorVerification (functions/src/tutorAccounts.ts) to record the
// refs and flip status to "Submitted". Status itself is read live via a
// direct Firestore listener on tutorVerifications/{uid} (owner-read is
// allowed by firestore.rules; only admin can write it).

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { db, storage, functions } from "@/lib/firebase";
import { useTutorProfile } from "@gloows/shared-logic";
import type { TutorVerification, TutorVerificationStatus } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import { Badge, Button, Card, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const submitTutorVerificationFn = httpsCallable<
  { documents: { name: string; storagePath: string }[] },
  { status: TutorVerificationStatus }
>(functions, "submitTutorVerification");

const STATUS_TONE: Record<TutorVerificationStatus, "default" | "success" | "warning" | "danger"> = {
  Draft: "default",
  Submitted: "warning",
  "Under Review": "warning",
  Verified: "success",
  Rejected: "danger",
  Suspended: "danger",
};

export default function VerificationPage() {
  const { t } = useTutorT();
  const { user } = useTutorProfile();

  const [verification, setVerification] = useState<TutorVerification | null>(null);
  const [loading, setLoading]           = useState(true);
  const [files, setFiles]               = useState<File[]>([]);
  const [uploading, setUploading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "tutorVerifications", user.uid), (snap) => {
      setVerification(snap.exists() ? (snap.data() as TutorVerification) : null);
      setLoading(false);
    });
  }, [user]);

  async function handleSubmit() {
    if (!user || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const documents = await Promise.all(files.map(async (file) => {
        const storagePath = `tutorDocuments/${user.uid}/${Date.now()}_${file.name}`;
        await uploadBytes(ref(storage, storagePath), file);
        return { name: file.name, storagePath };
      }));
      await submitTutorVerificationFn({ documents });
      setFiles([]);
    } catch (err: any) {
      setError(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const status = verification?.status ?? "Draft";

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-xl font-black text-slate-100 mb-1">{t("verificationTitle")}</h1>
        <p className="text-slate-500 text-sm mb-6">{t("verificationSubtitle")}</p>

        {loading ? <LoadingState /> : (
          <Card className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-xs font-semibold">Status</span>
              <Badge tone={STATUS_TONE[status]}>{t(`status${status.replace(" ", "")}`)}</Badge>
            </div>
            {status === "Rejected" && verification?.rejectionReason && (
              <p className="text-danger text-xs mt-2">
                {t("rejectionReasonLabel")}: {verification.rejectionReason}
              </p>
            )}
            {verification?.documents && verification.documents.length > 0 && (
              <ul className="mt-3 space-y-1">
                {verification.documents.map((d) => (
                  <li key={d.storagePath} className="text-slate-400 text-xs">📎 {d.name}</li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {(status === "Draft" || status === "Rejected") && (
          <>
            <label className="block mb-4">
              <span className="block text-xs font-semibold text-slate-400 mb-1.5">{t("uploadDocument")}</span>
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                className="block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-surface2 file:px-3 file:py-2 file:text-slate-100 file:text-sm"
              />
            </label>
            {files.length > 0 && (
              <ul className="mb-4 space-y-1">
                {files.map((f) => <li key={f.name} className="text-slate-400 text-xs">📎 {f.name}</li>)}
              </ul>
            )}
            {error && <p className="text-danger text-xs font-semibold mb-4">{error}</p>}
            <Button onClick={handleSubmit} disabled={uploading || files.length === 0}>
              {uploading ? t("loading") : t("submitForReview")}
            </Button>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
