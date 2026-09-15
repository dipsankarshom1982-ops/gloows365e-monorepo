"use client";
// apps/tutor/src/app/(app)/documents/page.tsx
// "My Documents" — Document Management screen for the Tutor Profile
// Completion & Verification Dashboard. Manages the three onboarding
// document arrays (qualificationDocuments/experienceDocuments/
// additionalCertificates) plus the profile photo. Upload mechanics
// (Storage path, size/type validation) match Step4Qualifications.tsx's
// DocumentUploader exactly but are a SEPARATE local copy rather than an
// import — see components/dashboard/PhoneVerifyModal.tsx's header for
// why (small duplication over touching already-shipped onboarding code).
//
// Known gap, not fixed here (see the approved plan): uploaded documents'
// `storagePath` field actually holds a getDownloadURL() result, not a
// bucket path — a pre-existing convention from the onboarding build this
// screen inherits rather than migrates. Viewing/replacing here works
// against that same convention.

import { useRef, useState } from "react";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { useTutorProfile } from "@gloows/shared-logic";
import type { TutorOnboardingDocument } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import { Badge, Card, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const ACCEPTED_TYPES = "application/pdf,image/jpeg,image/jpg,image/png";
const MAX_DOC_BYTES = 10 * 1024 * 1024;

type DocCategory = "qualification" | "experience" | "certificate";
type FieldName = "qualificationDocuments" | "experienceDocuments" | "additionalCertificates";

const SECTIONS: { category: DocCategory; field: FieldName; multiple: boolean; titleKey: string; hintKey: string }[] = [
  { category: "qualification", field: "qualificationDocuments", multiple: false, titleKey: "ob4QualificationDocTitle", hintKey: "ob4QualificationDocHint" },
  { category: "experience", field: "experienceDocuments", multiple: false, titleKey: "ob4ExperienceDocTitle", hintKey: "ob4ExperienceDocHint" },
  { category: "certificate", field: "additionalCertificates", multiple: true, titleKey: "ob4CertificatesTitle", hintKey: "ob4CertificatesHint" },
];

function statusTone(status: TutorOnboardingDocument["status"]): "default" | "success" | "warning" | "danger" {
  if (status === "verified") return "success";
  if (status === "rejected") return "danger";
  if (status === "under_review" || status === "submitted") return "warning";
  return "default";
}

function statusKey(status: TutorOnboardingDocument["status"]): string {
  switch (status) {
    case "verified": return "dashDocStatusVerified";
    case "rejected": return "dashDocStatusRejected";
    case "under_review": return "dashDocStatusUnderReview";
    case "submitted": return "dashDocStatusSubmitted";
    default: return "dashDocStatusNotSubmitted";
  }
}

function formatDate(ts: unknown): string {
  const d = (ts as { toDate?: () => Date } | undefined)?.toDate?.();
  if (!d) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentSection({
  uid, category, field, multiple, titleKey, hintKey, docs,
}: {
  uid: string; category: DocCategory; field: FieldName; multiple: boolean;
  titleKey: string; hintKey: string; docs: TutorOnboardingDocument[];
}) {
  const { t } = useTutorT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // QA fix — this only makes sense for a single-document (replace)
  // category: locking uploads because ONE existing item is verified/
  // under_review previously also blocked adding a brand-new, independent
  // certificate to a `multiple` category just because an earlier one
  // happened to already be verified.
  const approvedLocked = !multiple && docs.some((d) => d.status === "verified" || d.status === "under_review");

  async function saveDocs(next: TutorOnboardingDocument[]) {
    await setDoc(doc(db, "tutors", uid), { [field]: next, updatedAt: new Date() }, { merge: true });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_DOC_BYTES) { setError(t("dashDocTooLargeError")); return; }
    if (!ACCEPTED_TYPES.split(",").includes(file.type)) { setError(t("dashDocInvalidTypeError")); return; }

    setError(null);
    setUploading(true);
    try {
      const storagePath = `tutorDocuments/${uid}/${category}_${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      // QA fix — versioning only makes sense as "this replaced an earlier
      // upload", which is only true for the single-document categories
      // (qualification/experience). For `multiple` (certificates), every
      // upload is an independent new document, not a replacement of
      // docs[0] — it always starts at version 1.
      const version = multiple ? 1 : (docs[0]?.version ?? 0) + 1;
      const newDoc: TutorOnboardingDocument = {
        name: file.name, storagePath: url, status: "submitted",
        mimeType: file.type, fileSize: file.size, version, uploadedAt: new Date(),
      };
      const previous = multiple ? null : docs[0];
      await saveDocs(multiple ? [...docs, newDoc] : [newDoc]);
      // QA fix — a replacement upload previously left the OLD file behind
      // in Storage with no Firestore reference to it: not just wasted
      // storage, but a still-valid, still-downloadable orphan (see the
      // Document URL Security Review's finding on long-lived download
      // URLs). Best-effort, same pattern as this app's other
      // delete-then-ignore Storage cleanups (e.g. Step2's photo remove).
      if (previous) {
        try { await deleteObject(ref(storage, previous.storagePath)); } catch { /* best-effort */ }
      }
    } catch {
      setError(t("dashDocUploadFailedError"));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(index: number) {
    const target = docs[index];
    const next = docs.filter((_, i) => i !== index);
    await saveDocs(next);
    if (target) {
      try { await deleteObject(ref(storage, target.storagePath)); } catch { /* best-effort */ }
    }
  }

  return (
    <Card className="mb-4">
      <p className="text-sm font-black text-slate-100">{t(titleKey)}</p>
      <p className="text-xs text-slate-500 mt-0.5 mb-3">{t(hintKey)}</p>

      {docs.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {docs.map((d, i) => (
            <div key={d.storagePath} className="rounded-lg border border-slate-700 bg-bg px-3.5 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-slate-200 truncate">📎 {d.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {formatDate(d.uploadedAt)}{d.fileSize ? ` · ${formatSize(d.fileSize)}` : ""}{d.version ? ` · v${d.version}` : ""}
                  </p>
                </div>
                <Badge tone={statusTone(d.status)}>{t(statusKey(d.status))}</Badge>
              </div>
              {d.status === "rejected" && d.rejectionReason && (
                <p className="text-xs text-danger mt-2">{d.rejectionReason}</p>
              )}
              <div className="flex gap-3 mt-2">
                <a href={d.storagePath} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand-400 hover:text-brand-300">
                  {t("dashDocView")}
                </a>
                {d.status !== "verified" && d.status !== "under_review" && (
                  <button type="button" onClick={() => handleDelete(i)} className="text-xs font-bold text-slate-500 hover:text-danger">
                    {t("dashDocDelete")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(multiple || docs.length === 0) && !approvedLocked && (
        <>
          <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={handleUpload} />
          <button
            type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            className="text-xs font-bold text-brand-400 hover:text-brand-300 disabled:opacity-50"
          >
            {uploading ? t("ob4Uploading") : docs.length > 0 ? (multiple ? t("ob4AddAnother") : t("dashDocReplace")) : t("ob4UploadFile")}
          </button>
        </>
      )}
      {approvedLocked && docs.length > 0 && !multiple && (
        <p className="text-xs text-slate-600">{t("dashDocLockedNote")}</p>
      )}
      {error && <p className="text-danger text-xs font-semibold mt-2">{error}</p>}
    </Card>
  );
}

export default function DocumentsPage() {
  const { t } = useTutorT();
  const { user, tutorProfile, profileLoading } = useTutorProfile();

  if (profileLoading || !user || !tutorProfile) return <LoadingState />;

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-xl font-black text-slate-100 mb-1">{t("dashDocumentsTitle")}</h1>
        <p className="text-sm text-slate-400 mb-5">{t("dashDocumentsSubtitle")}</p>

        {SECTIONS.map((s) => (
          <DocumentSection
            key={s.field}
            uid={user.uid}
            category={s.category}
            field={s.field}
            multiple={s.multiple}
            titleKey={s.titleKey}
            hintKey={s.hintKey}
            docs={(tutorProfile[s.field] as TutorOnboardingDocument[] | undefined) ?? []}
          />
        ))}
      </div>
      <BottomNav />
    </div>
  );
}
