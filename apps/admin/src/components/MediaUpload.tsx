/**
 * PATH: admin-web/src/components/MediaUpload.tsx
 *
 * Reusable upload widget used across Banners, Partners, BadgesAndStars,
 * CreateAd, CreateContest, and SkillBattles.
 *
 * Props:
 *   mode         — "image" | "video" | "both"
 *   storagePath  — Firebase Storage path prefix for images (e.g. "banners")
 *   value        — current URL string (controlled)
 *   onChange     — called with the final public URL once upload completes
 *   label        — optional field label
 *   accept       — optional MIME override (default: image/*)
 *   maxMB        — max file size in MB (default: 10 for images, 500 for video)
 *   disabled     — disable the widget
 *
 * For "video" mode it uses the Cloudflare Stream two-step upload flow
 * (same as ShortReels.tsx and Stories.tsx).
 * onVideoMeta — called with { uid, hlsUrl, thumbnailUrl } after CF upload
 */

import { getDownloadURL, getStorage, ref as storageRef, uploadBytesResumable } from "firebase/storage";
import { useRef, useState } from "react";

// ── Cloudflare constants ────────────────────────────────────────────────────
const CF_WORKER        = (import.meta.env.VITE_CF_WORKER_URL ?? "https://vidya-stream.dipsankarshom1982.workers.dev").replace(/\/$/, "");
const CF_CUSTOMER_CODE = "cif09s9962jkfc36";

function cfHlsUrl(uid: string)  { return `https://customer-${CF_CUSTOMER_CODE}.cloudflarestream.com/${uid}/manifest/video.m3u8`; }
function cfThumbUrl(uid: string){ return `https://customer-${CF_CUSTOMER_CODE}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg?time=1s`; }

async function cfCreateUploadUrl(): Promise<{ uploadURL: string; uid: string }> {
  const res = await fetch(`${CF_WORKER}/create-upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ maxDurationSeconds: 600 }),
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
    xhr.onerror = () => reject(new Error("Network error during CF upload"));
    xhr.open("POST", uploadURL);
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });
}

// ── Types ───────────────────────────────────────────────────────────────────
export interface VideoMeta {
  uid:          string;
  hlsUrl:       string;
  thumbnailUrl: string;
}

interface Props {
  mode?:        "image" | "video" | "both";
  storagePath:  string;               // e.g. "banners", "partners/logos"
  value:        string;               // current URL (controlled)
  onChange:     (url: string) => void;
  onVideoMeta?: (meta: VideoMeta) => void;
  label?:       string;
  maxMB?:       number;
  disabled?:    boolean;
  placeholder?: string;              // placeholder text shown in URL input
}

type Phase = "idle" | "uploading" | "done" | "error";

// ── Component ────────────────────────────────────────────────────────────────
export default function MediaUpload({
  mode = "image",
  storagePath,
  value,
  onChange,
  onVideoMeta,
  label,
  maxMB,
  disabled = false,
  placeholder = "https://…  or upload below",
}: Props) {

  const imgRef  = useRef<HTMLInputElement>(null);
  const vidRef  = useRef<HTMLInputElement>(null);

  const [phase,    setPhase]    = useState<Phase>("idle");
  const [pct,      setPct]      = useState(0);
  const [phaseMsg, setPhaseMsg] = useState("");
  const [errMsg,   setErrMsg]   = useState("");
  const [preview,  setPreview]  = useState<string | null>(null);
  const [fileType, setFileType] = useState<"image" | "video" | null>(null);

  const maxImageMB = maxMB ?? 10;
  const maxVideoMB = maxMB ?? 500;

  // ── Helpers ────────────────────────────────────────────────────────────
  const reset = () => {
    setPhase("idle"); setPct(0); setPhaseMsg(""); setErrMsg("");
    setPreview(null); setFileType(null);
    if (imgRef.current) imgRef.current.value = "";
    if (vidRef.current) vidRef.current.value = "";
  };

  // ── Image upload → Firebase Storage ────────────────────────────────────
  const handleImage = async (file: File) => {
    if (file.size > maxImageMB * 1024 * 1024) {
      setErrMsg(`Image must be under ${maxImageMB} MB`);
      return;
    }
    setPreview(URL.createObjectURL(file));
    setFileType("image");
    setPhase("uploading"); setPct(0); setErrMsg("");
    setPhaseMsg("Uploading image…");

    try {
      const storage  = getStorage();
      const fileName = `${storagePath}/${Date.now()}_${file.name.replace(/[^a-z0-9._-]/gi, "_")}`;
      const sRef     = storageRef(storage, fileName);
      const task     = uploadBytesResumable(sRef, file);

      const url = await new Promise<string>((resolve, reject) => {
        task.on(
          "state_changed",
          (snap) => setPct(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          async () => resolve(await getDownloadURL(task.snapshot.ref))
        );
      });

      onChange(url);
      setPhase("done"); setPhaseMsg("✅ Uploaded!");
    } catch (e: any) {
      setErrMsg(e?.message ?? "Upload failed");
      setPhase("error");
    }
  };

  // ── Video upload → Cloudflare Stream ───────────────────────────────────
  const handleVideo = async (file: File) => {
    if (file.size > maxVideoMB * 1024 * 1024) {
      setErrMsg(`Video must be under ${maxVideoMB} MB`);
      return;
    }
    setPreview(URL.createObjectURL(file));
    setFileType("video");
    setPhase("uploading"); setPct(0); setErrMsg("");
    setPhaseMsg("Getting upload URL…");

    try {
      const { uploadURL, uid } = await cfCreateUploadUrl();
      setPhaseMsg("Uploading to Cloudflare…");
      await cfUploadVideo(uploadURL, file, setPct);

      const hlsUrl       = cfHlsUrl(uid);
      const thumbnailUrl = cfThumbUrl(uid);

      onChange(hlsUrl);
      onVideoMeta?.({ uid, hlsUrl, thumbnailUrl });
      setPhase("done"); setPhaseMsg("✅ Uploaded to Cloudflare Stream!");
    } catch (e: any) {
      setErrMsg(e?.message ?? "Video upload failed");
      setPhase("error");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const inp = "w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors";

  const uploading = phase === "uploading";

  return (
    <div className="space-y-2">
      {label && <p className="text-slate-300 text-sm font-semibold">{label}</p>}

      {/* URL text input — always visible so admin can paste a URL too */}
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); reset(); }}
        disabled={disabled || uploading}
        className={inp}
        placeholder={placeholder}
      />

      {/* Current preview (from value prop) */}
      {value && !preview && (
        <div className="flex items-center gap-2 mt-1">
          {value.includes(".m3u8") || value.includes("cloudflarestream") ? (
            <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full">🎬 Video URL set</span>
          ) : (
            <img
              src={value}
              alt="current"
              className="h-12 w-20 object-cover rounded-lg border border-slate-700"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <span className="text-slate-500 text-xs truncate max-w-xs">{value}</span>
        </div>
      )}

      {/* Upload buttons */}
      {!uploading && (
        <div className="flex gap-2 flex-wrap">
          {(mode === "image" || mode === "both") && (
            <>
              <button
                type="button"
                onClick={() => { if (!disabled) imgRef.current?.click(); }}
                disabled={disabled}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 rounded-xl text-xs text-slate-300 font-semibold transition-colors"
              >
                🖼️ Upload Image
              </button>
              <input
                ref={imgRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); }}
              />
            </>
          )}
          {(mode === "video" || mode === "both") && (
            <>
              <button
                type="button"
                onClick={() => { if (!disabled) vidRef.current?.click(); }}
                disabled={disabled}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 rounded-xl text-xs text-purple-300 font-semibold transition-colors"
              >
                🎬 Upload Video (CF)
              </button>
              <input
                ref={vidRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideo(f); }}
              />
            </>
          )}
          {(preview || value) && (
            <button
              type="button"
              onClick={() => { onChange(""); reset(); }}
              disabled={disabled}
              className="px-3 py-2 text-red-400 hover:text-red-300 text-xs bg-red-500/10 rounded-xl border border-red-500/20 transition-colors"
            >
              ✕ Clear
            </button>
          )}
        </div>
      )}

      {/* Progress bar */}
      {uploading && (
        <div className="space-y-1.5 mt-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">{phaseMsg}</span>
            <span className="text-white font-bold">{pct}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Done / Error feedback */}
      {phase === "done" && (
        <p className="text-green-400 text-xs font-semibold">{phaseMsg}</p>
      )}
      {phase === "error" && (
        <p className="text-red-400 text-xs">⚠️ {errMsg}</p>
      )}

      {/* Preview after upload */}
      {preview && (
        <div className="relative mt-2 w-fit">
          {fileType === "image" ? (
            <img
              src={preview}
              alt="preview"
              className="h-20 rounded-xl object-cover border border-slate-700"
            />
          ) : (
            <video
              src={preview}
              className="h-20 rounded-xl bg-black border border-slate-700"
              muted
            />
          )}
        </div>
      )}
    </div>
  );
}