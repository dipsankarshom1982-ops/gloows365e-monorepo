"use client";

// PATH: apps/web/src/app/(app)/settings/profile/page.tsx
// Mirrors mobile app/profile-settings.tsx exactly
// Sections: Avatar picker · Basic Info · Academic Details · Location (pincode auto-fill)
// Modes: View (locked) ↔ Edit (unlocked) with Edit icon button
// Actions: Save · Cancel · Delete Account (danger zone)

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getAuth, deleteUser, sendEmailVerification } from "firebase/auth";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc,
} from "firebase/firestore";
import {
  getStorage, ref, uploadBytesResumable,
  getDownloadURL, deleteObject,
} from "firebase/storage";
import { useTheme } from "@/context/ThemeContext";
import { useStudentProfile } from "@gloows/shared-logic";
import { INDIAN_LANGUAGES } from "@/lib/languages";
import { TITLES, defaultAvatarForTitle } from "@/lib/avatars";

// Max upload size for a profile photo — Firebase Storage will happily
// accept much larger files, but nothing here was capping it, so a huge
// image (e.g. a raw phone camera photo) could sit "Uploading... 0%" for a
// very long time on a slow connection with no explanation to the user.
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

// ─── Constants ────────────────────────────────────────────────
const CLASS_OPTIONS    = ["4", "6", "7", "8", "9", "10", "11", "12"];
const BOARDS           = ["CBSE", "ICSE", "State Board", "IB", "IGCSE"];
const INTEREST_OPTIONS = ["GK", "Science", "Math", "History", "Geography", "English", "Coding", "Arts"];

// ─── Icons ────────────────────────────────────────────────────
function Icon({ name, size = 20, color }: { name: string; size?: number; color: string }) {
  const icons: Record<string, JSX.Element> = {
    "create-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M364 125l-248 248-48 48 48-16 248-248-48-32zm48-48l32 32-32-32z" fill={color}/>
        <path d="M384 96l32 32L128 416l-64 32 32-64L384 96z" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
    "camera": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill={color}>
        <path d="M456 144h-83.9l-32.6-48.6C331.6 84 320 80 308.3 80H203.7c-11.7 0-23.3 4-31.2 15.4L140 144H56a24 24 0 00-24 24v280a24 24 0 0024 24h400a24 24 0 0024-24V168a24 24 0 00-24-24zM256 368a88 88 0 110-176 88 88 0 010 176z"/>
      </svg>
    ),
    "image-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <rect x="48" y="80" width="416" height="352" rx="48" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
        <circle cx="336" cy="176" r="32" fill={color}/>
        <path d="M304 304l-48-48-112 128h304L304 304z" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
      </svg>
    ),
    "trash-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M112 112l20 320c.95 18.49 14.4 32 32 32h184c17.67 0 30.87-13.51 32-32l20-320" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M80 112h352" stroke={color} strokeWidth={32} strokeLinecap="round"/>
        <path d="M192 112V72h128v40" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    "person-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <circle cx="256" cy="192" r="112" stroke={color} strokeWidth={32}/>
        <path d="M96 448c0-88.37 71.63-160 160-160s160 71.63 160 160" stroke={color} strokeWidth={32} strokeLinecap="round"/>
      </svg>
    ),
    "call-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M451 374c-15.88-16-54.34-39.35-73-48.76-24.3-12.24-26.3-13.24-45.4.95-12.74 9.47-21.21 17.93-36.12 14.75s-47.31-21.11-75.68-49.39-47.34-61.62-50.43-76.49 5.41-23.23 14.79-36c13.22-18 12.22-21 .92-45.3-8.81-18.9-32.84-57-48.9-72.8C121.3 44 120.3 44 112.2 47.1a8 8 0 00-1.3.72C97 57.2 84.2 65.7 77.6 77.8c-15.72 29.8-.42 107.3 52.29 165.4 52.7 58.1 131.49 127.6 163.09 143.2 31.6 15.7 90.2 33.8 116.8 14.9 12.1-9 21.8-21.8 31.6-35.4a6.49 6.49 0 00.6-1.3C444 356.7 467 365.14 451 374z" stroke={color} strokeWidth={32}/>
      </svg>
    ),
    "calendar-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <rect x="48" y="80" width="416" height="384" rx="48" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
        <path d="M128 48v64M384 48v64M48 192h416" stroke={color} strokeWidth={32} strokeLinecap="round"/>
      </svg>
    ),
    "hourglass-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M145 32h222v96l-96 128 96 128v96H145v-96l96-128-96-128V32z" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    "business-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M48 464h416" stroke={color} strokeWidth={32} strokeLinecap="round"/>
        <path d="M96 464V128l160-96 160 96v336" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
        <path d="M176 464v-80h160v80" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
        <path d="M176 240h48M288 240h48M176 320h48M288 320h48" stroke={color} strokeWidth={32} strokeLinecap="round"/>
      </svg>
    ),
    "pin-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <circle cx="256" cy="224" r="80" stroke={color} strokeWidth={32}/>
        <path d="M256 480S96 320 96 224a160 160 0 01320 0c0 96-160 256-160 256z" stroke={color} strokeWidth={32} strokeLinejoin="round"/>
      </svg>
    ),
    "location": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill={color}>
        <path d="M256 32C167.67 32 96 96.51 96 176c0 128 160 304 160 304s160-176 160-304c0-79.49-71.67-144-160-144zm0 224a64 64 0 110-128 64 64 0 010 128z"/>
      </svg>
    ),
    "lock-closed-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <rect x="96" y="208" width="320" height="272" rx="32" stroke={color} strokeWidth={32}/>
        <path d="M176 208v-48a80 80 0 01160 0v48" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="256" cy="320" r="20" fill={color}/>
        <path d="M256 340v32" stroke={color} strokeWidth={28} strokeLinecap="round"/>
      </svg>
    ),
    "chevron-forward": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M184 112l144 144-144 144" stroke={color} strokeWidth={48} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    "checkmark-circle": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill={color}>
        <path d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48zm108.25 138.29l-134.4 160a16 16 0 01-12 5.71h-.27a16 16 0 01-11.89-5.3l-57.6-64a16 16 0 1123.78-21.4l45.29 50.32 122.59-145.91a16 16 0 0124.5 20.58z"/>
      </svg>
    ),
    "checkmark-outline": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M416 128L192 384l-96-96" stroke={color} strokeWidth={48} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    "arrow-back": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M328 400L184 256l144-144" stroke={color} strokeWidth={48} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  };
  return icons[name] ?? <svg width={size} height={size}/>;
}

// ─── Section title (mirrors mobile SectionTitle) ──────────────
function SectionTitle({ icon, label, accent }: { icon: string; label: string; accent: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, marginBottom: 4 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 16, fontWeight: 800, color: accent, letterSpacing: 0.3 }}>{label}</span>
    </div>
  );
}

// ─── Field (mirrors mobile Field) ─────────────────────────────
function Field({ label, icon, value, onChange, placeholder, type = "text", isEditing, accent, surfaceBg, borderCol, textMain, textSec }: {
  label: string; icon: string; value: string; onChange: (v: string) => void;
  placeholder: string; type?: string; isEditing: boolean;
  accent: string; surfaceBg: string; borderCol: string; textMain: string; textSec: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: textSec }}>
        {label}
      </span>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        border: `1px solid ${isEditing ? accent : borderCol}`,
        borderRadius: 12, padding: "13px 14px",
        background: surfaceBg,
      }}>
        <Icon name={icon} size={17} color={isEditing ? accent : textSec}/>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={!isEditing}
          style={{
            flex: 1, border: "none", outline: "none", background: "transparent",
            fontSize: 15, fontWeight: 500, color: textMain,
            cursor: isEditing ? "text" : "default",
          }}
        />
        {!isEditing && <Icon name="lock-closed-outline" size={13} color={borderCol}/>}
      </div>
    </div>
  );
}

// ─── Chip row (mirrors mobile ChipRow) ────────────────────────
function ChipRow({ label, options, selected, onToggle, isEditing, accent, surfaceBg, borderCol, textMain, textSec }: {
  label: string; options: readonly string[]; selected: string[];
  onToggle: (opt: string) => void; isEditing: boolean;
  accent: string; surfaceBg: string; borderCol: string; textMain: string; textSec: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: textSec }}>
        {label}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => isEditing && onToggle(opt)}
              style={{
                padding: "8px 14px", borderRadius: 20, border: `1px solid ${active ? accent : borderCol}`,
                background: active ? accent : surfaceBg,
                color: active ? "#fff" : textMain,
                fontSize: 13, fontWeight: 600, cursor: isEditing ? "pointer" : "default",
                opacity: !isEditing && !active ? 0.4 : 1,
                transition: "all 0.15s",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function ProfileSettingsPage() {
  const { colors, isDarkMode } = useTheme();
  const { user } = useStudentProfile();
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [loading,          setLoading]          = useState(true);
  const [saving,           setSaving]           = useState(false);
  const [deleting,         setDeleting]         = useState(false);
  const [isEditing,        setIsEditing]        = useState(false);
  const [uploadProgress,   setUploadProgress]   = useState(0);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Form state
  const [name,              setName]              = useState("");
  const [title,             setTitle]             = useState("");
  const [phone,             setPhone]             = useState("");
  const [school,            setSchool]            = useState("");
  const [studentClass,      setStudentClass]      = useState("");
  const [board,             setBoard]             = useState("");
  const [age,               setAge]               = useState("");
  const [dob,               setDob]               = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("");
  const [profilePic,        setProfilePic]        = useState("");
  const [localImage,        setLocalImage]        = useState<string | null>(null);
  const [interests,         setInterests]         = useState<string[]>([]);
  const [area,              setArea]              = useState("");
  const [district,          setDistrict]          = useState("");
  const [pincode,           setPincode]           = useState("");
  const [stateVal,          setStateVal]          = useState("");
  const [pincodeLoading,    setPincodeLoading]    = useState(false);
  const [original,          setOriginal]          = useState<Record<string, unknown> | null>(null);
  const [error,             setError]             = useState("");
  const [success,           setSuccess]           = useState("");
  const [emailVerified,     setEmailVerified]     = useState(true);
  const [resendingVerify,   setResendingVerify]   = useState(false);

  const accent    = isDarkMode ? "#38bdf8" : "#3b82f6";
  const textMain  = isDarkMode ? "#f1f5f9" : "#1e293b";
  const textSec   = isDarkMode ? "#94a3b8" : "#64748b";
  const surfaceBg = isDarkMode ? "#1e293b" : "#ffffff";
  const borderCol = isDarkMode ? "#334155" : "#e2e8f0";
  const pageBg    = isDarkMode
    ? "linear-gradient(180deg, #060612 0%, #0d0d24 50%, #060612 100%)"
    : colors.background;

  // Fetch profile
  const loadProfile = async () => {
    if (!user) return;
    setLoading(true); setError(""); setSuccess("");
    try {
      // FIX (bug report — "profile setting pre field data not shown"): this
      // used to read users/{uid}, but the rich profile fields this form
      // edits (name, school, class, board, dob, location, interests,
      // preferredLanguage) are written to students/{uid} by registration —
      // users/{uid} only ever holds role/roles/coins/profileType/
      // onboardingComplete (see StudentProfileContext.tsx). Reading users/
      // alone meant every field here loaded as blank. Mirrors mobile
      // profile-settings.tsx, which reads students/ only.
      const snap = await getDoc(doc(getFirestore(), "students", user.uid));
      if (snap.exists()) {
        const d = snap.data();
        populate(d);
        setOriginal(d);
      } else {
        // FIX (bug report — "pre filled data not shown in profile setting"):
        // a student who hasn't fully completed registration (or whose
        // students/{uid} doc genuinely doesn't exist yet) isn't an error —
        // but this used to fall through silently, leaving every field blank
        // with zero explanation of why. Seed what we *do* have from the
        // Firebase Auth record itself so the form isn't empty for no
        // apparent reason, and leave `original` as null so handleSave knows
        // to create the doc (see setDoc/merge below) rather than trying to
        // update one that was never written.
        setName(user.displayName ?? "");
        setPhone(user.phoneNumber ?? "");
        setOriginal(null);
        setError("We couldn't find saved profile details yet — fill them in below and tap Save.");
      }
    } catch (e) {
      // FIX (bug report — "Failed to load profile"): previously a single
      // flat string no matter what went wrong, with no way to try again
      // short of reloading the whole page. Surface the real reason
      // (permission-denied vs. offline vs. something else) and let the
      // person retry in place — see the Retry button rendered with this
      // error below.
      const code = (e as { code?: string })?.code;
      if (code === "permission-denied") {
        setError("You don't have permission to view this profile. Try logging out and back in.");
      } else if (code === "unavailable" || !navigator.onLine) {
        setError("Couldn't reach the server — check your connection and retry.");
      } else {
        setError("Failed to load profile" + (e instanceof Error && e.message ? `: ${e.message}` : "."));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Firebase's client SDK doesn't push server-side emailVerified changes to
  // the User object automatically — reload() is needed to notice a
  // verification click that happened elsewhere (e.g. a different tab).
  useEffect(() => {
    if (!user) return;
    setEmailVerified(user.emailVerified);
    user.reload()
      .then(() => setEmailVerified(getAuth().currentUser?.emailVerified ?? true))
      .catch(() => { /* ignore — keep cached value */ });
  }, [user]);

  const handleResendVerification = async () => {
    const current = getAuth().currentUser;
    if (!current) return;
    setResendingVerify(true); setError(""); setSuccess("");
    try {
      await sendEmailVerification(current);
      setSuccess("✅ Verification link sent to the parent's email on file.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "auth/too-many-requests") {
        setError("A verification email was already sent recently. Check the inbox (and spam folder) before requesting another.");
      } else {
        setError((e as { message?: string })?.message ?? "Couldn't send verification email. Please try again.");
      }
    } finally {
      setResendingVerify(false);
    }
  };

  const populate = (d: Record<string, unknown>) => {
    setName((d.name as string) ?? "");
    setTitle((d.title as string) ?? "");
    setPhone((d.phone as string) ?? "");
    setSchool((d.school as string) ?? "");
    setStudentClass(d.class !== undefined ? String(d.class) : "");
    setBoard((d.board as string) ?? "");
    setAge(d.age !== undefined ? String(d.age) : "");
    setDob((d.dob as string) ?? "");
    setPreferredLanguage((d.preferredLanguage as string) ?? "");
    setProfilePic((d.profilePic as string) ?? "");
    setLocalImage(null);
    setInterests((d.interests as string[]) ?? []);
    const loc = d.location as Record<string, string> | undefined;
    setArea(loc?.area ?? loc?.city ?? "");
    setDistrict(loc?.district ?? "");
    setPincode(loc?.pincode ?? "");
    setStateVal(loc?.state ?? "");
  };

  const fetchLocation = async (pin: string) => {
    if (pin.length !== 6) { setArea(""); setDistrict(""); setStateVal(""); return; }
    setPincodeLoading(true);
    try {
      const res  = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      if (data[0]?.Status === "Success") {
        const info = data[0].PostOffice[0];
        setArea(info.Name); setDistrict(info.District); setStateVal(info.State);
      } else {
        setArea(""); setDistrict(""); setStateVal("");
      }
    } catch { /* ignore */ }
    finally { setPincodeLoading(false); }
  };

  // Photo pick via file input
  const handlePickImage = () => { if (isEditing) fileInputRef.current?.click(); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // FIX (bug report — "profile picture upload problem" #1): reset the
    // input's value unconditionally, including on early return. Browsers
    // don't fire `change` again if the user picks the exact same file
    // twice in a row (e.g. pick → remove → pick the same photo again) —
    // the input's value never changed from its point of view. Clearing it
    // here means the next pick of the same file still fires onChange.
    e.target.value = "";
    if (!file) return;

    // FIX (bug report — "profile picture upload problem" #2): nothing
    // validated the file before previewing/uploading it. A non-image file
    // (accept="image/*" is only a picker hint, not an enforcement — drag &
    // drop or some mobile browsers can still hand back anything) would
    // silently "preview" as a broken image and then fail obscurely at
    // upload time; a very large image would sit uploading with no
    // explanation of why it's slow or whether it'll even fit.
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Image is too large — please choose one under 5MB.");
      return;
    }
    setError("");

    // FIX (bug report — "profile picture upload problem" #3): each pick
    // used to call createObjectURL and overwrite `localImage` without ever
    // revoking the previous blob URL — a leak that grew every time someone
    // changed their mind about which photo to use before saving.
    if (localImage) URL.revokeObjectURL(localImage);

    const url = URL.createObjectURL(file);
    setLocalImage(url);
  };

  const handleRemovePhoto = () => {
    if (!isEditing) return;
    if (confirm("Remove your current profile photo?")) {
      if (localImage) URL.revokeObjectURL(localImage);
      setLocalImage(null); setProfilePic("");
    }
  };

  const uploadTaskRef = useRef<ReturnType<typeof uploadBytesResumable> | null>(null);

  // FIX (bug report — "profile photo upload problem": picker opens, upload
  // gets stuck / never finishes): uploadBytesResumable's own retry logic
  // only kicks in once the SDK actually *sees* a network error. On a lot of
  // mobile connections a stalled upload doesn't error — a chunk's PUT
  // request just sits open with no response and no error event, so
  // "state_changed" never fires again and this promise never resolved or
  // rejected. isUploadingPhoto stayed true forever, the progress bar froze,
  // and Save stayed disabled (see the `disabled={saving || isUploadingPhoto}`
  // below) with no way out except reloading the page.
  //
  // Fix: track time since the last progress event and treat >20s of
  // silence as a stall, not just "still going" — cap the whole upload at
  // 90s regardless. Either way, cancel the task and reject with a clear,
  // actionable error instead of hanging indefinitely.
  const uploadPhoto = async (blobUrl: string, uid: string): Promise<string> => {
    setIsUploadingPhoto(true); setUploadProgress(0);
    const STALL_MS = 20_000;
    const HARD_CAP_MS = 90_000;
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    let hardCapTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const res  = await fetch(blobUrl);
      const blob = await res.blob();
      const storageRef = ref(getStorage(), `profilePics/${uid}/profile.jpg`);
      const task = uploadBytesResumable(storageRef, blob);
      uploadTaskRef.current = task;

      return await new Promise<string>((resolve, reject) => {
        const clearTimers = () => { clearTimeout(stallTimer); clearTimeout(hardCapTimer); };
        const failStalled = () => {
          clearTimers();
          task.cancel();
          reject(new Error("Upload timed out — check your connection and try again."));
        };
        const resetStallTimer = () => {
          clearTimeout(stallTimer);
          stallTimer = setTimeout(failStalled, STALL_MS);
        };
        resetStallTimer();
        hardCapTimer = setTimeout(failStalled, HARD_CAP_MS);

        task.on("state_changed",
          (s) => {
            resetStallTimer();
            setUploadProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100));
          },
          (err) => { clearTimers(); reject(err); },
          async () => {
            clearTimers();
            resolve(await getDownloadURL(task.snapshot.ref));
          }
        );
      });
    } finally {
      clearTimeout(stallTimer); clearTimeout(hardCapTimer);
      uploadTaskRef.current = null;
      setIsUploadingPhoto(false); setUploadProgress(0);
    }
  };

  // Lets the user bail out of a stuck upload immediately instead of
  // waiting for the stall/hard-cap timeout above.
  const handleCancelUpload = () => {
    uploadTaskRef.current?.cancel();
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required."); return; }
    if (!user) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      let finalPic = profilePic;
      if (localImage) {
        finalPic = await uploadPhoto(localImage, user.uid);
        // Blob URL's job is done now that we have a real Storage URL — free it.
        URL.revokeObjectURL(localImage);
      }
      if (!profilePic && !localImage && original?.profilePic) {
        try { await deleteObject(ref(getStorage(), `profilePics/${user.uid}/profile.jpg`)); } catch { /* ok */ }
      }
      const payload = {
        name: name.trim(), title, phone: phone.trim(), school: school.trim(),
        class: studentClass.trim(), board: board.trim(),
        age: age ? parseInt(age, 10) : null, dob: dob.trim(),
        preferredLanguage, profilePic: finalPic, interests,
        location: { area: area.trim(), district: district.trim(), pincode: pincode.trim(), state: stateVal.trim() },
        updatedAt: new Date().toISOString(),
      };
      // FIX (bug report — language + profile fields not saving/showing):
      // write to students/{uid}, the canonical profile doc (see load fix
      // above and StudentProfileContext.tsx for why). Matches mobile
      // profile-settings.tsx.
      //
      // FIX (bug report — "pre filled data not shown" / profile blank for
      // some accounts): updateDoc() throws "No document to update" if
      // students/{uid} doesn't exist yet — which is exactly the case for
      // the accounts hitting the blank-profile bug (see the `!snap.exists()`
      // branch in loadProfile above). setDoc(..., {merge:true}) creates the
      // doc on first save and merges into it on every save after, so
      // Save Changes works the same way whether this is the first time
      // someone has ever filled this form in or the hundredth.
      await setDoc(doc(getFirestore(), "students", user.uid), payload, { merge: true });
      setProfilePic(finalPic); setLocalImage(null);
      setOriginal((p) => ({ ...p, ...payload }));
      setIsEditing(false);
      setSuccess("✅ Profile updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "storage/canceled") {
        setError("Photo upload cancelled.");
      } else {
        setError("Failed to save: " + (e instanceof Error ? e.message : "Unknown error"));
      }
    } finally { setSaving(false); }
  };

  const handleCancel = () => {
    if (localImage) URL.revokeObjectURL(localImage);
    if (original) populate(original);
    setIsEditing(false); setError("");
  };

  const handleDelete = async () => {
    if (!confirm("⚠️ This permanently deletes your GLOOWS365E profile and cannot be undone. Continue?")) return;
    if (!user) return;
    setDeleting(true);
    try {
      try { await deleteObject(ref(getStorage(), `profilePics/${user.uid}/profile.jpg`)); } catch { /* ok */ }
      // FIX: delete students/{uid} — the doc this page reads/writes — to
      // match mobile profile-settings.tsx. (users/{uid} role doc is left
      // alone here, same as mobile; it isn't owned by this screen.)
      await deleteDoc(doc(getFirestore(), "students", user.uid));
      const auth = getAuth();
      await deleteUser(auth.currentUser!);
      router.replace("/");
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === "auth/requires-recent-login")
        setError("Please log out and log back in, then try again.");
      else
        setError(err.message ?? "Unknown error");
    } finally { setDeleting(false); }
  };

  const toggleInterest = (item: string) => {
    if (!isEditing) return;
    setInterests((p) => p.includes(item) ? p.filter((i) => i !== item) : [...p, item]);
  };

  const displayImage = localImage ?? (profilePic || null);
  const currentLangObj = INDIAN_LANGUAGES.find((l) => l.name === preferredLanguage);

  if (loading) {
    return (
      <div style={{ background: pageBg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${accent}33`, borderTop: `3px solid ${accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/>
        <span style={{ color: textSec, fontSize: 14 }}>Loading profile...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ background: pageBg, minHeight: "100vh", paddingBottom: 80 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange}/>

      {/* ── Title row + Edit button ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 4px" }}>
        <div style={{ flex: 1, marginRight: 12 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: accent, marginBottom: 4 }}>
            👤 Profile Settings
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: textSec }}>
            {isEditing ? "Editing your details..." : "View and update your personal details"}
          </div>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            style={{
              width: 44, height: 44, borderRadius: 22,
              background: accent, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <Icon name="create-outline" size={20} color="#fff"/>
          </button>
        )}
      </div>

      {/* ── Error / Success banner ── */}
      {error && (
        <div style={{ margin: "8px 20px", padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontSize: 13, display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
          <span>{error}</span>
          {/* Only offer Retry for load-phase problems (pre-edit) — a save
              error while actively editing should just let the person fix
              the form and press Save again, not re-fetch and lose edits. */}
          {!isEditing && (
            <button
              onClick={loadProfile}
              style={{ flexShrink: 0, border: "1px solid #f87171", borderRadius: 8, padding: "4px 10px", background: "transparent", color: "#f87171", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Retry
            </button>
          )}
        </div>
      )}
      {success && (
        <div style={{ margin: "8px 20px", padding: "10px 14px", borderRadius: 10, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399", fontSize: 13 }}>
          {success}
        </div>
      )}

      {/* ── Avatar section ── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "16px 0", gap: 6 }}>
        {/* Avatar */}
        <div style={{ position: "relative", marginBottom: 4 }}>
          {displayImage ? (
            <img
              src={displayImage} alt="avatar"
              style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", border: `3px solid ${accent}` }}
            />
          ) : (
            // FIX (bug report — avatar problem): previously just a bare
            // initial letter on a tinted circle. Now shows the same
            // Title-derived silhouette used app-wide (AppHeader, Drawer)
            // so the fallback is consistent everywhere, not just here.
            <img
              src={defaultAvatarForTitle(title)} alt="avatar"
              style={{ width: 96, height: 96, borderRadius: "50%", border: `3px solid ${accent}`, background: accent + "20" }}
            />
          )}
          {isEditing && (
            <button
              onClick={handlePickImage}
              style={{
                position: "absolute", bottom: 0, right: 0,
                width: 30, height: 30, borderRadius: "50%",
                background: accent, border: "2px solid #fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Icon name="camera" size={14} color="#fff"/>
            </button>
          )}
        </div>

        <span style={{ fontSize: 18, fontWeight: 800, color: textMain }}>{name || "Student"}</span>

        {/* Upload progress */}
        {isUploadingPhoto && (
          <>
            <div style={{ width: 180, height: 6, borderRadius: 3, background: borderCol, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${uploadProgress}%`, background: accent, borderRadius: 3, transition: "width 0.3s" }}/>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: textSec }}>Uploading... {uploadProgress}%</span>
              {/* FIX (bug report — "upload gets stuck / never finishes"):
                  give the user a way out immediately instead of only the
                  20s-stall / 90s hard-cap timeout in uploadPhoto(). */}
              <button
                onClick={handleCancelUpload}
                style={{ fontSize: 12, fontWeight: 700, color: "#FF4D4D", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {/* Class + Board badges */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {studentClass && (
            <div style={{ padding: "4px 10px", borderRadius: 20, background: accent + "20" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>Class {studentClass}</span>
            </div>
          )}
          {board && (
            <div style={{ padding: "4px 10px", borderRadius: 20, background: accent + "20" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{board}</span>
            </div>
          )}
        </div>

        {/* Photo action buttons */}
        {isEditing && (
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handlePickImage} style={{ display: "flex", alignItems: "center", gap: 5, border: `1px solid ${accent}`, borderRadius: 20, padding: "6px 14px", background: "transparent", cursor: "pointer" }}>
              <Icon name="image-outline" size={15} color={accent}/>
              <span style={{ color: accent, fontSize: 13, fontWeight: 600 }}>{localImage ? "Change" : "Upload"} Photo</span>
            </button>
            {displayImage && (
              <button onClick={handleRemovePhoto} style={{ display: "flex", alignItems: "center", gap: 5, border: "1px solid #FF4D4D", borderRadius: 20, padding: "6px 14px", background: "transparent", cursor: "pointer" }}>
                <Icon name="trash-outline" size={15} color="#FF4D4D"/>
                <span style={{ color: "#FF4D4D", fontSize: 13, fontWeight: 600 }}>Remove</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Form ── */}
      <div style={{ padding: "4px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

        <SectionTitle icon="🧑" label="Basic Info" accent={accent}/>
        <ChipRow label="Title" options={TITLES as unknown as string[]}
          selected={title ? [title] : []}
          onToggle={(opt) => { if (isEditing) setTitle(opt === title ? "" : opt); }}
          isEditing={isEditing}
          accent={accent} surfaceBg={surfaceBg} borderCol={borderCol} textMain={textMain} textSec={textSec}/>
        <Field label="Full Name" icon="person-outline" value={name} onChange={setName}
          placeholder="Enter full name" isEditing={isEditing}
          accent={accent} surfaceBg={surfaceBg} borderCol={borderCol} textMain={textMain} textSec={textSec}/>
        <Field label="Phone Number" icon="call-outline" value={phone} onChange={setPhone}
          placeholder="10-digit mobile number" type="tel" isEditing={isEditing}
          accent={accent} surfaceBg={surfaceBg} borderCol={borderCol} textMain={textMain} textSec={textSec}/>
        <Field label="Date of Birth" icon="calendar-outline" value={dob} onChange={setDob}
          placeholder="MM/DD/YYYY" isEditing={isEditing}
          accent={accent} surfaceBg={surfaceBg} borderCol={borderCol} textMain={textMain} textSec={textSec}/>
        <Field label="Age" icon="hourglass-outline" value={age} onChange={setAge}
          placeholder="Enter age" type="number" isEditing={isEditing}
          accent={accent} surfaceBg={surfaceBg} borderCol={borderCol} textMain={textMain} textSec={textSec}/>

        <SectionTitle icon="📚" label="Academic Details" accent={accent}/>
        <Field label="School / Institution" icon="business-outline" value={school} onChange={setSchool}
          placeholder="Enter school name" isEditing={isEditing}
          accent={accent} surfaceBg={surfaceBg} borderCol={borderCol} textMain={textMain} textSec={textSec}/>
        <ChipRow label="Class / Grade" options={CLASS_OPTIONS}
          selected={studentClass ? [studentClass] : []}
          onToggle={(opt) => { if (isEditing) setStudentClass(opt === studentClass ? "" : opt); }}
          isEditing={isEditing}
          accent={accent} surfaceBg={surfaceBg} borderCol={borderCol} textMain={textMain} textSec={textSec}/>
        <ChipRow label="Board" options={BOARDS}
          selected={board ? [board] : []}
          onToggle={(opt) => { if (isEditing) setBoard(opt === board ? "" : opt); }}
          isEditing={isEditing}
          accent={accent} surfaceBg={surfaceBg} borderCol={borderCol} textMain={textMain} textSec={textSec}/>

        {/* Language picker card */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: textSec }}>
            Preferred Language
          </span>
          <button
            onClick={() => { if (isEditing) router.push("/settings/language"); }}
            style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%",
              border: `1px solid ${isEditing ? accent : borderCol}`,
              borderRadius: 12, padding: "13px 14px", background: surfaceBg,
              cursor: isEditing ? "pointer" : "default", textAlign: "left",
            }}
          >
            {currentLangObj ? (
              <>
                <div style={{ padding: "6px 10px", borderRadius: 10, background: accent + "20", flexShrink: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: accent }}>{currentLangObj.native}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: textMain, marginBottom: 2 }}>{currentLangObj.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: textSec }}>{currentLangObj.region}</div>
                </div>
              </>
            ) : (
              <span style={{ flex: 1, fontSize: 15, color: textSec }}>Not set — tap to choose</span>
            )}
            {isEditing
              ? <Icon name="chevron-forward" size={18} color={textSec}/>
              : preferredLanguage ? <Icon name="checkmark-circle" size={18} color={accent}/> : null
            }
          </button>
          {isEditing && (
            <span style={{ fontSize: 11, color: textSec }}>
              All 22 constitutionally recognised Indian languages available
            </span>
          )}
        </div>

        <ChipRow label="Interests" options={INTEREST_OPTIONS}
          selected={interests} onToggle={toggleInterest}
          isEditing={isEditing}
          accent={accent} surfaceBg={surfaceBg} borderCol={borderCol} textMain={textMain} textSec={textSec}/>

        <SectionTitle icon="📍" label="Location" accent={accent}/>

        {/* Pincode */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: textSec }}>Pincode</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${isEditing ? accent : borderCol}`, borderRadius: 12, padding: "13px 14px", background: surfaceBg }}>
            <Icon name="pin-outline" size={17} color={isEditing ? accent : textSec}/>
            <input
              type="text" maxLength={6} value={pincode}
              onChange={(e) => { setPincode(e.target.value); if (isEditing) fetchLocation(e.target.value); }}
              placeholder="6-digit pincode"
              disabled={!isEditing}
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 15, fontWeight: 500, color: textMain, cursor: isEditing ? "text" : "default" }}
            />
            {pincodeLoading && (
              <div style={{ width: 16, height: 16, border: `2px solid ${accent}33`, borderTop: `2px solid ${accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/>
            )}
            {!isEditing && <Icon name="lock-closed-outline" size={13} color={borderCol}/>}
          </div>
        </div>

        {/* Location auto-fill card */}
        {(area || district || stateVal) ? (
          <div style={{ display: "flex", gap: 10, border: `1px solid ${borderCol}`, borderRadius: 12, padding: 14, background: surfaceBg, alignItems: "flex-start" }}>
            <Icon name="location" size={16} color={accent}/>
            <div style={{ flex: 1 }}>
              {area     && <div style={{ fontSize: 14, fontWeight: 600, color: textMain, marginBottom: 3 }}>📌 {area}</div>}
              {district && <div style={{ fontSize: 14, fontWeight: 600, color: textMain, marginBottom: 3 }}>🏛 {district}</div>}
              {stateVal && <div style={{ fontSize: 14, fontWeight: 600, color: textMain, marginBottom: 3 }}>🗺 {stateVal}</div>}
              <div style={{ fontSize: 11, color: textSec, marginTop: 4 }}>Auto-filled from pincode</div>
            </div>
          </div>
        ) : isEditing ? (
          <span style={{ fontSize: 11, color: textSec }}>
            Enter a valid 6-digit pincode to auto-fill area, district &amp; state
          </span>
        ) : null}
      </div>

      {/* ── Save / Cancel (edit mode only) ── */}
      {isEditing && (
        <div style={{ padding: "24px 20px 4px" }}>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={handleCancel} disabled={saving}
              style={{ flex: 1, border: `1px solid ${borderCol}`, borderRadius: 12, padding: "14px 0", background: "transparent", cursor: "pointer", fontSize: 15, fontWeight: 600, color: textSec }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave} disabled={saving || isUploadingPhoto}
              style={{
                flex: 2, borderRadius: 12, padding: "14px 0", border: "none",
                background: accent, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? (
                <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/>
              ) : (
                <>
                  <Icon name="checkmark-outline" size={20} color="#fff"/>
                  <span style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Email verification (soft gate — never blocks anything) ── */}
      {!emailVerified && (
        <div style={{ margin: "28px 20px 0", padding: 16, borderRadius: 12, border: "1px solid rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.08)", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#F59E0B" }}>📧 Verify Parent&apos;s Email</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: textSec, lineHeight: "18px" }}>
            We sent a verification link to the parent&apos;s email on file — ask them to check their inbox (and spam folder) to confirm it.
          </span>
          <button
            onClick={handleResendVerification} disabled={resendingVerify}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: 0, marginTop: 4, opacity: resendingVerify ? 0.6 : 1 }}
          >
            {resendingVerify
              ? <div style={{ width: 16, height: 16, border: "2px solid #F59E0B33", borderTop: "2px solid #F59E0B", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/>
              : <Icon name="checkmark-circle" size={16} color="#F59E0B"/>
            }
            <span style={{ color: "#F59E0B", fontSize: 14, fontWeight: 600 }}>Resend Verification Email</span>
          </button>
        </div>
      )}

      {/* ── Danger Zone ── */}
      <div style={{ margin: "28px 20px 0", padding: 16, borderRadius: 12, border: "1px solid rgba(255,77,77,0.2)", background: "rgba(255,77,77,0.05)", display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#FF4D4D" }}>⚠️ Danger Zone</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: textSec, lineHeight: "18px" }}>
          Deleting your account removes all your GLOOWS365E data permanently.
        </span>
        <button
          onClick={handleDelete} disabled={deleting}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: 0, marginTop: 4, opacity: deleting ? 0.6 : 1 }}
        >
          {deleting
            ? <div style={{ width: 16, height: 16, border: "2px solid #FF4D4D33", borderTop: "2px solid #FF4D4D", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/>
            : <Icon name="trash-outline" size={16} color="#FF4D4D"/>
          }
          <span style={{ color: "#FF4D4D", fontSize: 14, fontWeight: 600 }}>Delete My Account</span>
        </button>
      </div>

      {/* ── Back button ── */}
      <div style={{ padding: "20px 20px 40px" }}>
        <button
          onClick={() => router.back()}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "14px 0", borderRadius: 12, cursor: "pointer", background: surfaceBg, border: `1px solid ${borderCol}` }}
        >
          <Icon name="arrow-back" size={20} color={textMain}/>
          <span style={{ fontSize: 15, fontWeight: 600, color: textMain }}>Back to Settings</span>
        </button>
      </div>
    </div>
  );
}