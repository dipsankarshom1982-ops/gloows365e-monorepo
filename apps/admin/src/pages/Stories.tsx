// PATH: admin-web/src/pages/Stories.tsx
// Full story management with media upload:
//   • Review Queue — approve/reject user-submitted stories
//   • Create Story — upload image OR video + all metadata fields
//     - Images → Firebase Storage
//     - Videos → Cloudflare Stream (two-step upload)
//   • All stories auto-approved when created by admin

import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { db, functions, storage } from "../lib/firebase";
import ApprovalQueue, { ApprovalItem } from "../components/ApprovalQueue";

// ─── Types ────────────────────────────────────────────────────────────────────

type Filter  = "pending" | "approved" | "rejected" | "all";
type TabView = "queue" | "create";
type MediaType = "image" | "video" | null;

// Cloudflare Stream worker URL (same as mobile app)
const CF_WORKER = "https://vidya-stream.dipsankarshom1982.workers.dev";

// ─── Category options ─────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "learn",         label: "📚 Learn" },
  { id: "ai_tips",       label: "🤖 AI Tips" },
  { id: "career",        label: "💼 Career" },
  { id: "success",       label: "🌟 Success Stories" },
  { id: "opportunities", label: "🎯 Opportunities" },
];

const LANGUAGES = [
  "English", "Hindi", "Bengali", "Telugu", "Tamil", "Marathi",
  "Gujarati", "Kannada", "Malayalam", "Odia", "Punjabi",
];

const EXPIRY_OPTIONS = [
  { label: "1 day",   days: 1 },
  { label: "3 days",  days: 3 },
  { label: "7 days",  days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "1 year",  days: 365 },
];

// ─── Cloudflare Stream helpers ────────────────────────────────────────────────

async function cfCreateUploadUrl(): Promise<{ uploadURL: string; uid: string }> {
  const res = await fetch(`${CF_WORKER}/create-upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ maxDurationSeconds: 300 }),
  });
  if (!res.ok) throw new Error(`CF create-upload-url failed: ${res.status}`);
  return res.json();
}

async function cfUploadVideo(
  uploadURL: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload  = () => (xhr.status < 400 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.open("POST", uploadURL);
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });
}

// ─── approveContent callable ──────────────────────────────────────────────────

const approveContentFn = httpsCallable<
  { collection: string; docId: string; action: "approve" | "reject"; reason?: string },
  { success: boolean }
>(functions, "approveContent");

// ─── Component ────────────────────────────────────────────────────────────────

export default function Stories() {
  const [tab,     setTab]     = useState<TabView>("queue");
  const [items,   setItems]   = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<Filter>("pending");

  // Create form state
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [category,    setCategory]    = useState("learn");
  const [language,    setLanguage]    = useState("English");
  const [classMin,    setClassMin]    = useState(1);
  const [classMax,    setClassMax]    = useState(12);
  const [isFeatured,  setIsFeatured]  = useState(false);
  const [ctaText,     setCtaText]     = useState("");
  const [ctaType,     setCtaType]     = useState<"internal" | "external">("internal");
  const [ctaLink,     setCtaLink]     = useState("");
  const [expiryDays,  setExpiryDays]  = useState(7);

  // Media state
  const [mediaType,     setMediaType]     = useState<MediaType>(null);
  const [mediaFile,     setMediaFile]     = useState<File | null>(null);
  const [mediaPreview,  setMediaPreview]  = useState<string | null>(null);
  const [uploading,     setUploading]     = useState(false);
  const [uploadPct,     setUploadPct]     = useState(0);
  const [uploadPhase,   setUploadPhase]   = useState<"idle" | "uploading" | "saving" | "done">("idle");
  const [uploadError,   setUploadError]   = useState("");

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ── Load queue ───────────────────────────────────────────────────────────

  const loadQueue = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "stories"));
      const all: ApprovalItem[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id:             d.id,
          title:          data.title || "Untitled Story",
          thumbnailUrl:   data.thumbnailUrl || data.mediaUrl || "",
          uploaderName:   data.userName || "Unknown",
          createdAt:      data.createdAt,
          approvalStatus: data.status === "approved"
            ? "approved"
            : data.status === "rejected"
            ? "rejected"
            : "pending",
          category: data.educationalCategory || data.category || "",
          subtitle: data.language || "",
        } as ApprovalItem;
      });
      const filtered = filter === "all" ? all : all.filter((i) => i.approvalStatus === filter);
      setItems(filtered);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQueue(); }, [filter]);

  // ── Approve / Reject ─────────────────────────────────────────────────────

  const handleApprove = async (id: string) => {
    await approveContentFn({ collection: "stories", docId: id, action: "approve" });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, approvalStatus: "approved" } : i));
  };

  const handleReject = async (id: string, reason: string) => {
    await approveContentFn({ collection: "stories", docId: id, action: "reject", reason });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, approvalStatus: "rejected" } : i));
  };

  // ── Media selection ──────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    setMediaType(type);
    setMediaPreview(URL.createObjectURL(file));
    setUploadError("");
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaType(null);
    setMediaPreview(null);
    setUploadPct(0);
    setUploadPhase("idle");
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  // ── Create Story ─────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!title.trim()) { setUploadError("Title is required."); return; }
    if (!mediaFile)    { setUploadError("Please select an image or video."); return; }

    setUploading(true);
    setUploadPct(0);
    setUploadPhase("uploading");
    setUploadError("");

    let mediaUrl    = "";
    let thumbnailUrl = "";

    try {
      if (mediaType === "video") {
        // ── Video → Cloudflare Stream ──────────────────────────────────────
        const { uploadURL, uid } = await cfCreateUploadUrl();

        await cfUploadVideo(uploadURL, mediaFile, (pct) => setUploadPct(pct));

        // Cloudflare Stream HLS URL pattern
        const cfCustomer = "cif09s9962jkfc36";
        mediaUrl     = `https://customer-${cfCustomer}.cloudflarestream.com/${uid}/manifest/video.m3u8`;
        thumbnailUrl = `https://customer-${cfCustomer}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`;

      } else {
        // ── Image → Firebase Storage ───────────────────────────────────────
        const storyId  = `admin_${Date.now()}`;
        const storageRef = ref(storage, `stories/admin/${storyId}`);

        mediaUrl = await new Promise<string>((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, mediaFile);
          task.on(
            "state_changed",
            (snap) => {
              const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
              setUploadPct(pct);
            },
            (err) => reject(err),
            async () => resolve(await getDownloadURL(task.snapshot.ref))
          );
        });
        thumbnailUrl = mediaUrl;
      }

      setUploadPhase("saving");

      // ── Write Firestore doc ────────────────────────────────────────────
      const payload: Record<string, any> = {
        title:               title.trim(),
        description:         description.trim(),
        educationalCategory: category,
        category,
        language,
        classRange:          [classMin, classMax],
        isFeatured,
        mediaUrl,
        thumbnailUrl,
        type:                mediaType,
        userId:              "admin",
        userName:            "Gloows Team",
        userClass:           null,
        status:              "approved",  // admin stories auto-approved
        likes:               0,
        views:               0,
        completions:         0,
        reactions:           { learned: 0, saved: 0, needHelp: 0, alreadyKnow: 0 },
        createdAt:           serverTimestamp(),
        expiresAt:           Timestamp.fromDate(
          new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
        ),
      };

      if (ctaText.trim()) {
        payload.cta = {
          text:       ctaText.trim(),
          actionType: ctaType,
          link:       ctaLink.trim(),
        };
      }

      await addDoc(collection(db, "stories"), payload);

      setUploadPhase("done");

      // Reset form after 2 seconds
      setTimeout(() => {
        setTitle(""); setDescription(""); setCtaText(""); setCtaLink("");
        setCategory("learn"); setLanguage("English"); setIsFeatured(false);
        setClassMin(1); setClassMax(12); setExpiryDays(7);
        clearMedia();
        setUploadPhase("idle");
        setUploading(false);
        loadQueue();
      }, 2000);

    } catch (e: any) {
      setUploadError(e?.message || "Upload failed. Please try again.");
      setUploadPhase("idle");
      setUploading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const counts = {
    pending: items.filter((i) => i.approvalStatus === "pending").length,
  };

  const inp = "bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-500";
  const sel = "bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 w-full";

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">📖 Stories</h1>
          <p className="text-slate-400 text-sm mt-1">
            Upload educational stories or review user submissions
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab("queue")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === "queue" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            Review Queue
            {counts.pending > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {counts.pending}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("create")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === "create" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            + Upload Story
          </button>
        </div>
      </div>

      {/* ── QUEUE TAB ── */}
      {tab === "queue" && (
        <>
          <div className="flex gap-2 flex-wrap">
            {(["pending", "approved", "rejected", "all"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors capitalize ${
                  filter === f ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <ApprovalQueue
            items={items}
            onApprove={handleApprove}
            onReject={handleReject}
            loading={loading}
            emptyMessage={`No ${filter === "all" ? "" : filter} stories.`}
          />
        </>
      )}

      {/* ── CREATE TAB ── */}
      {tab === "create" && (
        <div className="space-y-5">

          {/* ── Media Upload ── */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-white font-bold text-lg mb-1">
              📎 Media <span className="text-red-400">*</span>
            </h2>
            <p className="text-slate-400 text-xs mb-4">
              Upload an image (JPG/PNG) or video (MP4). Videos go to Cloudflare Stream, images to Firebase Storage.
            </p>

            {/* Media not selected */}
            {!mediaFile && (
              <div className="grid grid-cols-2 gap-4">
                {/* Image upload */}
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-8 transition-colors group"
                >
                  <span className="text-4xl">🖼️</span>
                  <div className="text-center">
                    <p className="text-white font-semibold text-sm group-hover:text-indigo-400 transition-colors">
                      Upload Image
                    </p>
                    <p className="text-slate-500 text-xs mt-1">JPG, PNG up to 10MB</p>
                  </div>
                </button>

                {/* Video upload */}
                <button
                  onClick={() => videoInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-2xl p-8 transition-colors group"
                >
                  <span className="text-4xl">🎬</span>
                  <div className="text-center">
                    <p className="text-white font-semibold text-sm group-hover:text-purple-400 transition-colors">
                      Upload Video
                    </p>
                    <p className="text-slate-500 text-xs mt-1">MP4 up to 300s via Cloudflare</p>
                  </div>
                </button>
              </div>
            )}

            {/* Hidden inputs */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleFileSelect(e, "image")}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={(e) => handleFileSelect(e, "video")}
            />

            {/* Media selected — preview */}
            {mediaFile && mediaPreview && (
              <div className="relative">
                {mediaType === "image" ? (
                  <img
                    src={mediaPreview}
                    alt="Preview"
                    className="w-full max-h-64 object-cover rounded-xl"
                  />
                ) : (
                  <video
                    src={mediaPreview}
                    controls
                    className="w-full max-h-64 rounded-xl bg-black"
                  />
                )}
                <button
                  onClick={clearMedia}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm transition-colors"
                >
                  ✕
                </button>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    mediaType === "video"
                      ? "bg-purple-500/20 text-purple-400"
                      : "bg-blue-500/20 text-blue-400"
                  }`}>
                    {mediaType === "video" ? "🎬 Video → Cloudflare Stream" : "🖼️ Image → Firebase Storage"}
                  </span>
                  <span className="text-slate-500 text-xs">
                    {(mediaFile.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </div>
              </div>
            )}

            {/* Upload progress */}
            {uploading && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">
                    {uploadPhase === "uploading" ? "Uploading media…"
                      : uploadPhase === "saving" ? "Saving to Firestore…"
                      : "✅ Published!"}
                  </span>
                  <span className="text-white font-bold">{uploadPhase === "done" ? "100%" : `${uploadPct}%`}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      uploadPhase === "done" ? "bg-green-500" : "bg-indigo-500"
                    }`}
                    style={{ width: uploadPhase === "done" ? "100%" : `${uploadPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Story Details ── */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-white font-bold text-lg">Story Details</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1">
                  Category *
                </label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={sel}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1">Language</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className={sel}>
                  {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-semibold mb-1">
                Title * <span className="text-slate-600">(shown as overlay on story)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Story headline"
                className={inp}
              />
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-semibold mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Story body text (optional)"
                rows={3}
                className={inp + " resize-none"}
              />
            </div>

            {/* Class range */}
            <div>
              <label className="block text-slate-400 text-xs font-semibold mb-1">
                Class Range <span className="text-slate-600">(who sees this story)</span>
              </label>
              <div className="flex items-center gap-3">
                <select
                  value={classMin}
                  onChange={(e) => setClassMin(Number(e.target.value))}
                  className={sel + " w-28"}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>Class {n}</option>
                  ))}
                </select>
                <span className="text-slate-400 text-sm">to</span>
                <select
                  value={classMax}
                  onChange={(e) => setClassMax(Number(e.target.value))}
                  className={sel + " w-28"}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>Class {n}</option>
                  ))}
                </select>
                <span className="text-slate-500 text-xs">Leave 1–12 to show all students</span>
              </div>
            </div>

            {/* Expiry + Featured */}
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-slate-400 text-xs font-semibold mb-1">Expires after</label>
                <select
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value))}
                  className={sel}
                >
                  {EXPIRY_OPTIONS.map((o) => (
                    <option key={o.days} value={o.days}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <input
                  type="checkbox"
                  id="featured"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="featured" className="text-white text-sm font-semibold cursor-pointer">
                  ★ Featured (gold border on card)
                </label>
              </div>
            </div>
          </div>

          {/* ── CTA ── */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h2 className="text-white font-bold">Call to Action <span className="text-slate-500 text-sm font-normal">(optional — swipe-up button)</span></h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1">Button Text</label>
                <input
                  type="text"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  placeholder="e.g. Apply Now"
                  className={inp}
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1">Type</label>
                <select
                  value={ctaType}
                  onChange={(e) => setCtaType(e.target.value as "internal" | "external")}
                  className={sel}
                >
                  <option value="internal">Internal (app route)</option>
                  <option value="external">External (URL)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-slate-400 text-xs font-semibold mb-1">
                {ctaType === "external" ? "URL" : "App Route (e.g. /vcoins/wallet)"}
              </label>
              <input
                type="text"
                value={ctaLink}
                onChange={(e) => setCtaLink(e.target.value)}
                placeholder={ctaType === "external" ? "https://..." : "/(drawer)/(tabs)/home"}
                className={inp}
              />
            </div>
          </div>

          {/* Error */}
          {uploadError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <p className="text-red-400 text-sm">⚠️ {uploadError}</p>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleCreate}
              disabled={uploading || !mediaFile}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl px-8 py-3 transition-colors"
            >
              {uploading
                ? uploadPhase === "done" ? "✅ Published!"
                  : uploadPhase === "saving" ? "Saving…"
                  : `Uploading ${uploadPct}%…`
                : "Publish Story"}
            </button>
            {!mediaFile && (
              <span className="text-slate-500 text-sm">Select a media file to enable publish</span>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
