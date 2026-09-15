import { useTheme } from "@/context/ThemeContext";
import { useAppTranslation } from "@/context/LanguageContext";
import { getStreamUploadUrl, uploadToStream } from "@/lib/cloudflareStream";
import { auth, db, functions, storage } from "@/lib/firebase";
import { detectPostLanguage } from "@/lib/detectPostLanguage";
// Phase 2D-4 — centralized engine classification (do not reimplement this
// check locally, per the brief §4). Same function Discovery/Battle
// Details already use.
import { classifyBattleEngine, type RawBattle } from "@/components/battle/resolveBattleExperience";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import * as VideoThumbnails from "expo-video-thumbnails";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Types ───────────────────────────────────────────────────
type PostStatus = "pending" | "in_review" | "approved" | "rejected";

interface StudentData {
  name: string;
  class: string;
  school: string;
  profilePic: string;
  preferredLanguage?: string;
  location: {
    city: string;
    district: string;
    state: string;
    pincode: string;
  };
}

interface MyPost {
  id: string;
  mediaUrl: string;
  thumbnail: string;
  status: PostStatus;
  createdAt: any;
  rejectionReason?: string;
}

// ─── Phase 2D-4: canonical (Phase 2C) submission status ────────
// Deliberately a SEPARATE shape from MyPost above, not a reuse/coercion —
// the canonical submissions/{battleId}_{uid} doc genuinely has a
// different schema (status values, no thumbnail field — see the upload
// flow below for why) than the legacy posts doc. Conflating them into
// one type would be exactly the "second business-logic system" the
// brief warns against; keeping them distinct keeps each engine's real
// shape honest.
type CanonicalSubmissionStatus = "PENDING_MODERATION" | "APPROVED" | "REJECTED" | "REMOVED" | "WITHDRAWN";
interface CanonicalSubmission {
  status: CanonicalSubmissionStatus;
  rejectionReason: string;
  createdAt: any;
}

// ─── Status watermark config ──────────────────────────────────
const WATERMARK_CONFIG: Partial<
  Record<PostStatus, { labelKey: string; emoji: string; bg: string }>
> = {
  pending:   { labelKey: "pendingReview", emoji: "⏳", bg: "rgba(243,156,18,0.82)"  },
  in_review: { labelKey: "inReview",      emoji: "🔍", bg: "rgba(52,152,219,0.82)"  },
  rejected:  { labelKey: "rejected",      emoji: "❌", bg: "rgba(231,76,60,0.82)"   },
};

// ─── Status badge config ──────────────────────────────────────
const STATUS_CONFIG: Record<
  PostStatus,
  { labelKey: string; emoji: string; color: string; bg: string; description: string }
> = {
  pending: {
    labelKey: "pendingReview", emoji: "⏳", color: "#f39c12", bg: "#f39c1218",
    description: "Waiting to be reviewed by our team.",
  },
  in_review: {
    labelKey: "inReview", emoji: "🔍", color: "#3498db", bg: "#3498db18",
    description: "Our team is currently reviewing your reel.",
  },
  approved: {
    labelKey: "approved", emoji: "✅", color: "#2ecc71", bg: "#2ecc7118",
    description: "Your reel is live in the battle feed!",
  },
  rejected: {
    labelKey: "rejected", emoji: "❌", color: "#e74c3c", bg: "#e74c3c18",
    description: "Your reel did not meet the guidelines.",
  },
};

const ELIGIBLE_CLASSES = ["6", "7", "8", "9", "10", "11", "12"];

// ─── Post limit check ─────────────────────────────────────────
// UX pre-check only (SB-P1-03) — lets the app show "limit reached" before
// spending time on a video upload the server would reject anyway. The
// actual enforcement is server-side now: submitSkillBattleReel
// (functions/src/skillBattleSubmission.ts) re-checks this same limit
// inside a transaction at save time, so a stale read here (or a bypass of
// this check entirely) can't result in more than the real cap.
const checkPostLimit = async (battleId: string, uid: string): Promise<boolean> => {
  const q = query(
    collection(db, "posts"),
    where("battleId", "==", battleId),
    where("userId",   "==", uid),
    where("status",   "not-in", ["rejected"])
  );
  const snap = await getDocs(q);
  if (snap.size >= 4) {
    return false;
  }
  return true;
};

// ─── Status Watermark Overlay ─────────────────────────────────
export function PostStatusWatermark({ status }: { status: PostStatus }) {
  const { t } = useAppTranslation();
  const cfg = WATERMARK_CONFIG[status];
  if (!cfg) return null;
  return (
    <View style={wmStyles.wrapper} pointerEvents="none">
      <View style={wmStyles.dim} />
      <View style={[wmStyles.banner, { backgroundColor: cfg.bg }]}>
        <Text style={wmStyles.bannerText}>{cfg.emoji}  {t(cfg.labelKey as any)}</Text>
      </View>
    </View>
  );
}

const wmStyles = StyleSheet.create({
  wrapper: { ...StyleSheet.absoluteFillObject, overflow: "hidden", borderRadius: 14 },
  dim:     { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.38)" },
  banner: {
    position: "absolute", top: 18, left: -38,
    width: 180, paddingVertical: 5, alignItems: "center",
    transform: [{ rotate: "-35deg" }],
  },
  bannerText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
});

// ─── Upload phases ────────────────────────────────────────────
type UploadPhase =
  | "idle"
  | "getting_url"    // Step 1: asking Worker for upload URL
  | "uploading"      // Step 2: streaming video to Cloudflare
  | "thumb"          // Step 3: uploading thumbnail to Firebase
  | "saving";        // Step 4: writing Firestore doc

// ─── Component ────────────────────────────────────────────────
export default function CreateReelScreen() {
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const router     = useRouter();
  const params     = useLocalSearchParams<{
    battleId:    string;
    battleTitle: string;
    battleType:  string;
    month:       string;
  }>();

  const accent = "#ff9f43"; // sponsored only

  // ── State ──────────────────────────────────────────────────
  const [student,        setStudent]        = useState<StudentData | null>(null);
  const [videoAsset,     setVideoAsset]     = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [thumbnail,      setThumbnail]      = useState<string | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [phase,          setPhase]          = useState<UploadPhase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [notEligible,    setNotEligible]    = useState(false);
  const [myPosts,        setMyPosts]        = useState<MyPost[]>([]);
  const [showMyPosts,    setShowMyPosts]    = useState(true);

  // ── Phase 2D-4: engine routing state ────────────────────────
  // "loading" (not "legacy") is the default so nothing submits before the
  // battle doc is actually fetched and classified — see the effect below.
  const [engine, setEngine] = useState<"loading" | "legacy" | "canonical">("loading");
  const [canonicalSubmission, setCanonicalSubmission] = useState<CanonicalSubmission | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  // Distinct from the Alert shown on failure — a persistent, dismissable-
  // by-retry inline state so the student always has a visible next step
  // rather than only a one-shot popup (brief §16).
  const [uploadFailed, setUploadFailed] = useState(false);

  // FEATURE (language priority + scope ranking): caption is new — there
  // was no text field on this screen before, and detectPostLanguage needs
  // something to read. Scope defaults to "pan_india" (matches today's
  // implicit behavior: every post is already visible to every viewer,
  // unchanged by this feature since scope is a soft ranking, not a
  // filter — see lib/reelScoring.ts).
  const [caption,    setCaption]    = useState("");
  const [scope,      setScope]      = useState<"pan_india" | "state">("pan_india");

  const progressAnim = useRef(new Animated.Value(0)).current;

  const player = useVideoPlayer(videoAsset?.uri ?? null, (p) => {
    p.loop = true;
    p.play();
  });

  // ── Fetch student ──────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      try {
        const snap = await getDoc(doc(db, "students", uid));
        if (!snap.exists()) return;
        const d   = snap.data();
        const cls = d.class !== undefined ? String(d.class) : "";
        setStudent({
          name:       d.name       ?? "",
          class:      cls,
          school:     d.school     ?? "",
          profilePic: d.profilePic ?? "",
          preferredLanguage: d.preferredLanguage ?? "",
          location: {
            city:     d.location?.city     ?? "",
            district: d.location?.district ?? "",
            state:    d.location?.state    ?? "",
            pincode:  d.location?.pincode  ?? "",
          },
        });
        if (!ELIGIBLE_CLASSES.includes(cls)) setNotEligible(true);
      } catch (e) { console.log("loadStudent:", e); }
    };
    load();
  }, []);

  // ── Phase 2D-4: classify battle engine ─────────────────────
  // Centralized via classifyBattleEngine (resolveBattleExperience.ts) —
  // the SAME function Discovery/Battle Details use, not a second
  // independent detection mechanism (brief §4). Runs once; a battle's
  // engine never changes mid-lifecycle (Phase 2A/2B design), so no
  // realtime listener is needed here.
  useEffect(() => {
    if (!params.battleId) return;
    getDoc(doc(db, "skillBattles", params.battleId)).then((snap) => {
      if (!snap.exists()) { setEngine("legacy"); return; } // unresolvable — fail toward the proven path
      const raw = { id: snap.id, ...snap.data() } as RawBattle;
      setEngine(classifyBattleEngine(raw));
    }).catch(() => setEngine("legacy"));
  }, [params.battleId]);

  // ── Real-time: my posts in this battle (LEGACY only) ───────
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !params.battleId || engine !== "legacy") return;

    const q = query(
      collection(db, "posts"),
      where("battleId", "==", params.battleId),
      where("userId",   "==", uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const posts: MyPost[] = snap.docs.map((d) => ({
        id:              d.id,
        mediaUrl:        d.data().mediaUrl        ?? "",
        thumbnail:       d.data().thumbnail       ?? "",
        status:          (d.data().status as PostStatus) ?? "pending",
        createdAt:       d.data().createdAt,
        rejectionReason: d.data().rejectionReason ?? "",
      }));
      posts.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setMyPosts(posts);
    });

    return () => unsub();
  }, [params.battleId, engine]);

  // ── Real-time: my submission in this battle (CANONICAL only) ──
  // A single doc, not a query — submissions/{battleId}_{uid} is the
  // deterministic identity Phase 2C already owns (brief §19); this
  // screen reads it, it never invents a different ID.
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !params.battleId || engine !== "canonical") return;

    const unsub = onSnapshot(doc(db, "submissions", `${params.battleId}_${uid}`), (snap) => {
      if (!snap.exists()) { setCanonicalSubmission(null); return; }
      const d = snap.data();
      setCanonicalSubmission({
        status: (d.status as CanonicalSubmissionStatus) ?? "PENDING_MODERATION",
        rejectionReason: d.rejectionReason ?? "",
        createdAt: d.createdAt,
      });
    });

    return () => unsub();
  }, [params.battleId, engine]);

  // ── Pick video ─────────────────────────────────────────────
  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:        ["videos"] as ImagePicker.MediaType[],
      quality:           1,
      videoMaxDuration:  60,
      videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
    });

    if (!result.canceled && result.assets.length > 0) {
      const file = result.assets[0];
      setVideoAsset(file);
      setThumbnail(null);
      setUploadFailed(false);
      try {
        const { uri: thumb } = await VideoThumbnails.getThumbnailAsync(file.uri, { time: 1000 });
        setThumbnail(thumb);
      } catch {}
    }
  };

  // ── Animate progress bar ───────────────────────────────────
  const animateTo = (val: number) => {
    Animated.timing(progressAnim, {
      toValue: val, duration: 250, useNativeDriver: false,
    }).start();
  };

  // ── Upload reel ────────────────────────────────────────────
  const uploadReel = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid)             { Alert.alert("Please login first.");                                               return; }
    if (!student)         { Alert.alert("Profile not found.");                                                return; }
    if (!videoAsset)      { Alert.alert("Please select a video.");                                            return; }
    if (notEligible)      { Alert.alert("Not eligible", "Only Class 6–12 students can upload skill reels."); return; }
    if (!params.battleId) { Alert.alert("No battle selected.");                                               return; }
    if (engine === "loading") { Alert.alert("Still loading this battle — try again in a moment."); return; }

    // Phase 2D-4: the pre-flight duplicate check is engine-specific —
    // legacy allows up to 4 (checkPostLimit, unchanged); canonical allows
    // exactly 1, and we already have the authoritative answer in state
    // (from the realtime submissions/{battleId}_{uid} listener) without
    // an extra query. Either way this is UX only — the real enforcement
    // is server-side (submitSkillBattleReel's transaction / brief §20-21).
    if (engine === "legacy") {
      const allowed = await checkPostLimit(params.battleId, uid);
      if (!allowed) { Alert.alert(t("limitReached"), t("limitReachedDesc")); return; }
    } else if (canonicalSubmission && canonicalSubmission.status !== "WITHDRAWN" && canonicalSubmission.status !== "REMOVED") {
      Alert.alert("Already submitted", "You've already submitted to this battle. Withdraw your submission first if you need to resubmit.");
      return;
    }

    setLoading(true);
    setUploadFailed(false);
    setPhase("idle");
    setUploadProgress(0);
    progressAnim.setValue(0);

    try {
      // ── Step 1: Get one-time upload URL from Cloudflare Worker ──
      // Identical for both engines — media upload is engine-agnostic;
      // only the record-creation step (Step 4) differs. The Worker now
      // requires the caller's Firebase ID token (2026-09-11 audit P0
      // fix, see lib/cloudflareStream.ts) and Step 4 forwards the
      // resulting signed ownershipToken — see this function's Step 4
      // comments below.
      setPhase("getting_url");
      console.log("[Upload] Step 1: getting Cloudflare upload URL...");

      const { uploadURL, playbackUrl, thumbnailUrl: cfThumbUrl } =
        await getStreamUploadUrl(params.battleTitle ?? "Vidya Skill Reel");

      console.log("[Upload] Step 1 done. playbackUrl:", playbackUrl?.slice(0, 60));

      // ── Step 2: Upload video to Cloudflare Stream ──────────────
      setPhase("uploading");
      setUploadProgress(0);
      animateTo(0);
      console.log("[Upload] Step 2: uploading video to Cloudflare Stream...");

      const uploadResult = await uploadToStream(
        uploadURL,
        videoAsset.uri,
        (pct) => {
          setUploadProgress(Math.round(pct));
          animateTo(pct);
        },
        params.battleTitle ?? "Vidya Reel"
      );

      // Use uid/playbackUrl from worker response
      const finalPlaybackUrl  = uploadResult.playbackUrl  || playbackUrl  || "";
      const finalThumbnailUrl = uploadResult.thumbnailUrl || cfThumbUrl   || "";
      const finalVideoId      = uploadResult.uid;

      console.log("[Upload] Step 2 done. uid:", finalVideoId);

      // ── Step 3: Upload thumbnail to Firebase Storage ────────────
      // LEGACY ONLY — createBattleSubmission (Phase 2C) has no
      // thumbnail field in its accepted input at all (verified against
      // the actual function signature, not assumed); inventing one here
      // would mean either silently dropping the value server-side or
      // modifying the Phase 2C function's schema, and the brief is
      // explicit that Phase 2C's submission logic isn't this phase's to
      // change. Canonical submissions skip this step entirely — the
      // status UI shows a generic icon instead of a thumbnail image for
      // them (see the render section below), an honest, documented
      // trade-off rather than an invented field.
      let thumbUrl = finalThumbnailUrl;
      if (engine === "legacy") {
        setPhase("thumb");
        if (thumbnail) {
          try {
            console.log("[Upload] Step 3: uploading thumbnail to Firebase Storage...");
            const thumbBlob = await globalThis.fetch(thumbnail).then((r) => r.blob());
            const thumbRef  = ref(storage, `thumbnails/${uid}/${Date.now()}_thumb.jpg`);

            await new Promise<void>((resolve, reject) => {
              const task = uploadBytesResumable(thumbRef, thumbBlob, { contentType: "image/jpeg" });
              task.on("state_changed", undefined,
                (err) => { console.warn("[Upload] thumb error (non-fatal):", err); resolve(); }, // non-fatal
                async () => {
                  try { thumbUrl = await getDownloadURL(task.snapshot.ref); } catch {}
                  resolve();
                }
              );
            });

            console.log("[Upload] Step 3 done. thumbUrl:", thumbUrl?.slice(0, 60));
          } catch (e) {
            console.warn("[Upload] Step 3 failed (non-fatal — using CF thumb):", e);
          }
        }
      }

      // ── Step 4: Create the submission record ────────────────────
      // Branches on engine — this is the ONLY step that differs, and the
      // branch is explicit and isolated here, not spread across the file
      // (brief §38). The upload that already happened above (Steps 1-3)
      // is identical either way; a canonical submission is only ever
      // created AFTER that upload has actually completed successfully —
      // never pointing at a missing/failed/incomplete video (brief §13).
      setPhase("saving");
      console.log(`[Upload] Step 4: saving submission (engine=${engine})...`);

      if (engine === "legacy") {
        // FEATURE (language priority + scope ranking): targetState and
        // targetLanguage — short_reels (admin-curated) already had these
        // for the personalization scorer (lib/reelScoring.ts), but
        // student-uploaded posts never did, so they got no language/
        // state ranking boost at all. scope is the student's own choice
        // (Pan-India vs their own state — see the picker above);
        // language is auto-detected from the caption, since there's no
        // language picker by product decision. Both are soft ranking
        // signals only — neither value ever hides this post from
        // anyone, see lib/reelScoring.ts. LEGACY ONLY — the canonical
        // engine has no feed-personalization system to feed.
        const detectedLanguage = detectPostLanguage(caption, student.preferredLanguage);
        const targetState: string[] =
          scope === "state" && student.location.state ? [student.location.state] : ["All"];

        // SECURITY FIX (SB-P0-02/SB-P1-03, SkillBattle trust-boundary
        // remediation, Phase 1): this used to be a direct
        // addDoc(collection(db, "posts"), {...}) call — the only thing
        // standing between a malicious client and a pre-approved, fake-
        // engagement, over-the-submission-limit post was firestore.rules
        // and a client-side-only checkPostLimit() pre-flight query.
        // Submission goes through submitSkillBattleReel, which forces
        // status/engagement/review fields server-side and enforces the
        // per-battle submission cap inside one transaction.
        //
        // ownershipToken (2026-09-11 audit P0 fix) — the Worker-signed
        // token from uploadToStream()'s response, forwarded UNMODIFIED.
        // submitSkillBattleReel independently verifies it (mediaOwnership.ts)
        // before accepting mediaUrl; a missing/invalid token is rejected
        // server-side regardless of what this client sends.
        await httpsCallable<
          {
            battleId: string; battleTitle?: string; battleType?: string; month?: string;
            caption: string; targetState: string[]; targetLanguage: string[];
            mediaUrl: string; thumbnail: string; ownershipToken: string;
          },
          { postId: string }
        >(functions, "submitSkillBattleReel")({
          battleId:    params.battleId,
          battleTitle: params.battleTitle,
          battleType:  params.battleType,
          month:       params.month,
          caption:        caption.trim(),
          targetState,
          targetLanguage: [detectedLanguage],
          mediaUrl:  finalPlaybackUrl,
          thumbnail: thumbUrl ?? "",
          ownershipToken: uploadResult.ownershipToken,
        });
      } else {
        // CANONICAL — Phase 2C's createBattleSubmission
        // (functions/src/battleSubmissions.ts). Student identity comes
        // from the callable's own context.auth.uid server-side (brief
        // §24) — there is no uid/studentId field in this payload at all
        // for a client to override. battleTitle/battleType/month aren't
        // accepted either (verified against the real function signature,
        // not assumed) — the server resolves the battle's own fields
        // itself rather than trusting client-supplied display copies.
        // caption maps to the canonical model's `description` field (the
        // closest real equivalent — brief §10: don't invent a new field
        // for something the backend doesn't have).
        // ownershipToken — same Worker-signed token, same independent
        // server-side verification, as the legacy branch above.
        try {
          await httpsCallable<
            { battleId: string; mediaRef: string; description?: string; ownershipToken: string },
            { submissionId: string }
          >(functions, "createBattleSubmission")({
            battleId: params.battleId,
            mediaRef: finalPlaybackUrl,
            description: caption.trim(),
            ownershipToken: uploadResult.ownershipToken,
          });
        } catch (err: any) {
          // "already-exists" (brief §20/§21 — duplicate/concurrent
          // submission attempt) is not a failure to alert-and-forget: the
          // realtime listener above will already reflect the real
          // (someone else's successful) submission moments after this,
          // so the honest response is to surface that gently rather than
          // a generic error, and NOT retry/create anything further.
          if (err?.code === "functions/already-exists" || err?.details?.code === "already-exists" || /already submitted/i.test(err?.message ?? "")) {
            Alert.alert("Already submitted", "You've already submitted to this battle.");
            return;
          }
          throw err;
        }
      }

      console.log("[Upload] Step 4 done. Submission saved ✅");

      setVideoAsset(null);
      setThumbnail(null);
      setCaption("");
      setScope("pan_india");
      setShowMyPosts(true);

      Alert.alert(
        "🎉 Submitted!",
        "Your reel is pending admin review.\n\nTrack its status in 'My Submissions' below.",
        [{ text: "OK" }]
      );
    } catch (e: unknown) {
      // Friendly mapping for the canonical engine's known
      // failed-precondition reasons (deadline passed / battle not open /
      // inactive skill — brief §22/§23) instead of a raw backend message.
      const rawMsg = e instanceof Error ? e.message : "";
      let msg = "Upload failed. Please try again.";
      if (/deadline/i.test(rawMsg)) msg = "Submissions are closed. This battle is no longer accepting entries.";
      else if (/not open/i.test(rawMsg)) msg = "This battle isn't accepting submissions right now.";
      else if (/hasn.t started/i.test(rawMsg)) msg = "This battle hasn't started yet.";
      else if (/no longer active/i.test(rawMsg)) msg = "This battle is not currently active.";
      else if (/network/i.test(rawMsg)) msg = "Network error. Check your connection and try again.";
      // Phase 2D-8 polish: no longer falls back to the raw backend/Firebase
      // message (brief §20 — never expose that to a student) — an
      // unrecognized failure keeps the generic, still-actionable message
      // above. The real message is still logged below for debugging.
      console.error("[Upload] ERROR:", rawMsg);
      setUploadFailed(true);
      Alert.alert("Upload Failed", msg);
    } finally {
      setLoading(false);
      setPhase("idle");
    }
  };

  // ── Phase 2D-4: withdraw submission (CANONICAL only) ────────
  // Legacy has no withdrawal capability at all (never built, unchanged
  // by this phase — brief §30/§38: only expose it where the backend
  // actually supports it). Only offered while PENDING_MODERATION,
  // mirroring withdrawBattleSubmission's own server-side check
  // (functions/src/battleSubmissions.ts) — the button below is already
  // hidden outside that state, and the backend independently re-enforces
  // it regardless.
  const withdrawSubmission = () => {
    if (!params.battleId) return;
    Alert.alert(
      "Withdraw this submission?",
      "Your submission will no longer participate in this battle.",
      [
        { text: "Keep Submission", style: "cancel" },
        {
          text: "Withdraw", style: "destructive",
          onPress: async () => {
            setWithdrawing(true);
            try {
              await httpsCallable<{ battleId: string }, { ok: boolean }>(functions, "withdrawBattleSubmission")({
                battleId: params.battleId,
              });
              // Refresh from authoritative state rather than assuming
              // success locally (brief §32) — the realtime listener will
              // pick up the real value; this just gives immediate
              // feedback without racing it.
              Alert.alert("Submission withdrawn", "This submission is no longer participating in the battle.");
            } catch {
              Alert.alert("Couldn't withdraw the submission", "Please try again.");
            } finally {
              setWithdrawing(false);
            }
          },
        },
      ]
    );
  };

  // ── Phase label & progress ─────────────────────────────────
  const phaseLabel = (() => {
    switch (phase) {
      case "getting_url": return "🔗 Preparing upload...";
      case "uploading":   return `📤 Uploading video... ${uploadProgress}%`;
      case "thumb":       return "🖼️ Saving thumbnail...";
      case "saving":      return "💾 Saving your reel...";
      default:            return "";
    }
  })();

  const showProgressBar = phase === "uploading";
  const showSpinner     = phase === "getting_url" || phase === "thumb" || phase === "saving";

  // ── Not eligible screen ────────────────────────────────────
  if (notEligible) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.centered}>
          <Text style={{ fontSize: 50 }}>🔒</Text>
          <Text style={[styles.notEligibleTitle, { color: colors.text }]}>Not Eligible</Text>
          <Text style={[styles.notEligibleText, { color: colors.textSecondary }]}>
            Skill Battle is only available for{"\n"}students in Class 6 to 12.
            {"\n\n"}You are currently in Class {student?.class || "unknown"}.
          </Text>
          <TouchableOpacity
            style={[styles.backToListBtn, { backgroundColor: colors.accent }]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back to Battles"
          >
            <Text style={styles.backToListBtnText}>← Back to Battles</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main UI ────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Back */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>

        {/* Battle banner */}
        <LinearGradient
          colors={["#2a1500", "#1a0e00"]}
          style={styles.battleBanner}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <View style={[styles.battleTypePill, { backgroundColor: accent }]}>
            <Text style={styles.battleTypePillText}>🏅 Sponsored Battle</Text>
          </View>
          <Text style={styles.battleBannerTitle}>{params.battleTitle}</Text>
          <Text style={styles.battleBannerMonth}>📅 {params.month}</Text>
        </LinearGradient>

        {/* Student card */}
        {student && (
          <View style={[styles.studentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {student.profilePic ? (
              <Image source={{ uri: student.profilePic }} style={styles.studentAvatar} />
            ) : (
              <View style={[styles.studentAvatarPlaceholder, { backgroundColor: `${accent}20` }]}>
                <Text style={[styles.studentAvatarInitial, { color: accent }]}>
                  {student.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.studentName, { color: colors.text }]}>{student.name}</Text>
              <Text style={[styles.studentMeta, { color: colors.textSecondary }]}>
                {student.school} · Class {student.class}
              </Text>
              <Text style={[styles.studentMeta, { color: colors.textSecondary }]}>
                📍 {student.location.district}, {student.location.state}
              </Text>
            </View>
            <View style={[styles.eligibleBadge, { backgroundColor: `${accent}18`, borderColor: `${accent}35` }]}>
              <Text style={[styles.eligibleBadgeText, { color: accent }]}>✅ Eligible</Text>
            </View>
          </View>
        )}

        {/* My Submission tracker (CANONICAL) — Phase 2D-4. A single
            submission, not a list (brief §20's one-per-battle rule),
            deliberately a different layout from the legacy list below
            rather than forcing both into one shape. */}
        {engine === "canonical" && canonicalSubmission && canonicalSubmission.status !== "WITHDRAWN" && canonicalSubmission.status !== "REMOVED" && (
          <View
            style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, padding: 14, gap: 8 }]}
            accessibilityLabel={`Your submission status: ${canonicalSubmission.status === "PENDING_MODERATION" ? "pending review" : canonicalSubmission.status === "APPROVED" ? "approved" : "rejected"}`}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>📋 Your Submission</Text>
            {canonicalSubmission.status === "PENDING_MODERATION" && (
              <>
                <Text style={{ color: "#f39c12", fontSize: 13, fontWeight: "800" }}>⏳ Submitted — Under review</Text>
                <Text style={[styles.statusDesc, { color: colors.textSecondary }]}>
                  Your submission has been received. It is being reviewed.
                </Text>
              </>
            )}
            {canonicalSubmission.status === "APPROVED" && (
              <>
                <Text style={{ color: "#2ecc71", fontSize: 13, fontWeight: "800" }}>✅ Approved</Text>
                <Text style={[styles.statusDesc, { color: colors.textSecondary }]}>
                  Your submission is now eligible for competition.
                </Text>
              </>
            )}
            {canonicalSubmission.status === "REJECTED" && (
              <>
                <Text style={{ color: "#e74c3c", fontSize: 13, fontWeight: "800" }}>❌ Submission not approved</Text>
                {canonicalSubmission.rejectionReason ? (
                  <View style={styles.rejectionBox}>
                    <Text style={styles.rejectionLabel}>Reason:</Text>
                    <Text style={styles.rejectionText}>{canonicalSubmission.rejectionReason}</Text>
                  </View>
                ) : null}
              </>
            )}

            {canonicalSubmission.status === "PENDING_MODERATION" && (
              <TouchableOpacity
                onPress={withdrawSubmission}
                disabled={withdrawing}
                accessibilityRole="button"
                accessibilityLabel="Withdraw submission"
                style={{ alignSelf: "flex-start", marginTop: 4, opacity: withdrawing ? 0.5 : 1 }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "700", textDecorationLine: "underline" }}>
                  {withdrawing ? "Withdrawing…" : "Manage · Withdraw Submission"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* My Submissions tracker (LEGACY) */}
        {engine === "legacy" && myPosts.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setShowMyPosts((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={`My Submissions, ${myPosts.length} of 4`}
              accessibilityState={{ expanded: showMyPosts }}
            >
              <View style={styles.sectionHeaderLeft}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>📋 My Submissions</Text>
                <View style={[styles.countBadge, { backgroundColor: `${accent}20` }]}>
                  <Text style={[styles.countBadgeText, { color: accent }]}>{myPosts.length}/4</Text>
                </View>
              </View>
              <Ionicons
                name={showMyPosts ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {showMyPosts && (
              <View style={styles.postsList}>
                {myPosts.map((post, index) => {
                  const cfg = STATUS_CONFIG[post.status] ?? STATUS_CONFIG.pending;
                  return (
                    <View
                      key={post.id}
                      style={[
                        styles.postRow,
                        index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                      ]}
                    >
                      <View style={styles.postThumbWrap}>
                        {post.thumbnail ? (
                          <Image source={{ uri: post.thumbnail }} style={styles.postThumb} />
                        ) : (
                          <View style={[styles.postThumbEmpty, { backgroundColor: `${accent}15` }]}>
                            <Text style={{ fontSize: 20 }}>🎬</Text>
                          </View>
                        )}
                        <PostStatusWatermark status={post.status} />
                      </View>
                      <View style={{ flex: 1, gap: 5 }}>
                        <Text style={[styles.postLabel, { color: colors.text }]}>Reel #{index + 1}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                          <Text style={[styles.statusText, { color: cfg.color }]}>
                            {cfg.emoji}  {t(cfg.labelKey as any)}
                          </Text>
                        </View>
                        <Text style={[styles.statusDesc, { color: colors.textSecondary }]}>
                          {cfg.description}
                        </Text>
                        {post.status === "rejected" && post.rejectionReason ? (
                          <View style={styles.rejectionBox}>
                            <Text style={styles.rejectionLabel}>Admin note:</Text>
                            <Text style={styles.rejectionText}>{post.rejectionReason}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Info box */}
        <View style={[styles.infoBox, { backgroundColor: `${accent}10`, borderColor: `${accent}30` }]}>
          <Ionicons name="information-circle-outline" size={16} color={accent} />
          <Text style={[styles.infoBoxText, { color: accent }]}>
            Battle title and description are set by admin. Just upload your best skill reel!
          </Text>
        </View>

        {/* Video picker */}
        <TouchableOpacity
          style={[
            styles.videoPicker,
            { backgroundColor: colors.card, borderColor: videoAsset ? accent : colors.border },
            videoAsset && { borderWidth: 2 },
          ]}
          onPress={pickVideo}
          activeOpacity={0.85}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={videoAsset ? "Replace video" : "Choose a video"}
        >
          {videoAsset ? (
            <>
              <VideoView player={player} style={styles.videoPreview} nativeControls={false} />
              <View style={styles.videoOverlay}>
                <View style={styles.changeVideoBtn}>
                  <Ionicons name="camera" size={16} color="#fff" />
                  <Text style={styles.changeVideoText}>Change Video</Text>
                </View>
              </View>
              {thumbnail && (
                <Image source={{ uri: thumbnail }} style={styles.thumbnailPreview} />
              )}
            </>
          ) : (
            <View style={styles.videoPickerEmpty}>
              <LinearGradient
                colors={[`${accent}20`, `${accent}08`]}
                style={styles.videoPickerGradient}
              >
                <Text style={{ fontSize: 48 }}>🎬</Text>
                <Text style={[styles.videoPickerTitle, { color: colors.text }]}>
                  Upload Your Skill Reel
                </Text>
                <Text style={[styles.videoPickerSub, { color: colors.textSecondary }]}>
                  Tap to select a video · Max 60 seconds
                </Text>
                <View style={[styles.videoPickerBtn, { backgroundColor: accent }]}>
                  <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
                  <Text style={styles.videoPickerBtnText}>Choose Video</Text>
                </View>
              </LinearGradient>
            </View>
          )}
        </TouchableOpacity>

        {/* Caption — used to auto-detect the post's language (see lib/detectPostLanguage.ts) */}
        <View style={[styles.captionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.captionLabel, { color: colors.text }]}>Caption (optional)</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Say something about your reel..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={200}
            style={[styles.captionInput, { color: colors.text, borderColor: colors.border }]}
          />
        </View>

        {/* Scope — who sees this reel boosted in their feed. Soft ranking
            only (see lib/reelScoring.ts) — picking your state never hides
            this reel from anyone outside it, it's still visible everywhere,
            just ranked higher for viewers in that state. LEGACY ONLY — the
            canonical engine has no feed-personalization system this
            feeds into, so showing the picker there would be meaningless
            UI with no effect (Phase 2D-4 brief §11: don't let the
            student change something scope-like that the battle itself
            already determines). */}
        {engine === "legacy" && (
        <View style={[styles.scopeBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.captionLabel, { color: colors.text }]}>Who should see this most?</Text>
          <View style={styles.scopeRow}>
            <TouchableOpacity
              style={[
                styles.scopePill,
                { borderColor: scope === "pan_india" ? accent : colors.border },
                scope === "pan_india" && { backgroundColor: `${accent}18` },
              ]}
              onPress={() => setScope("pan_india")}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Show my reel higher for Pan-India audience"
              accessibilityState={{ selected: scope === "pan_india" }}
            >
              <Ionicons name="earth" size={14} color={scope === "pan_india" ? accent : colors.textSecondary} />
              <Text style={[styles.scopePillText, { color: scope === "pan_india" ? accent : colors.textSecondary }]}>
                Pan-India
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.scopePill,
                { borderColor: scope === "state" ? accent : colors.border },
                scope === "state" && { backgroundColor: `${accent}18` },
              ]}
              onPress={() => setScope("state")}
              activeOpacity={0.85}
              disabled={!student?.location.state}
              accessibilityRole="button"
              accessibilityLabel={`Show my reel higher for ${student?.location.state || "my state"} audience only`}
              accessibilityState={{ selected: scope === "state", disabled: !student?.location.state }}
            >
              <Ionicons name="location" size={14} color={scope === "state" ? accent : colors.textSecondary} />
              <Text style={[styles.scopePillText, { color: scope === "state" ? accent : colors.textSecondary }]}>
                {student?.location.state || "My State"} only
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.scopeHint, { color: colors.textSecondary }]}>
            This still reaches everyone — it just shows higher up for the audience you pick.
          </Text>
        </View>
        )}

        {/* Rules */}
        <View style={[styles.rulesBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.rulesTitle, { color: colors.text }]}>📋 Rules</Text>
          {(engine === "canonical" ? [
            "Video must be your original skill content",
            "One submission per battle · Max 60 seconds",
            "Only Class 6–12 students can participate",
            "No inappropriate content",
            "Your submission goes through review before it competes",
          ] : [
            "Video must be your original skill content",
            "Max 4 reels per battle · Max 60 seconds",
            "Only Class 6–12 students can participate",
            "No inappropriate content",
            "Your state is taken from your profile for the scope picker above",
            "All reels go through admin review before approval",
          ]).map((rule, i) => (
            <View key={i} style={styles.ruleRow}>
              <Text style={[styles.ruleDot, { color: accent }]}>•</Text>
              <Text style={[styles.ruleText, { color: colors.textSecondary }]}>{rule}</Text>
            </View>
          ))}
        </View>

        {/* Upload progress */}
        {loading && (
          <View style={[styles.progressBox, { backgroundColor: colors.card, borderColor: `${accent}40` }]}>
            <View style={styles.progressLabelRow}>
              {showSpinner && <ActivityIndicator size="small" color={accent} />}
              <Text style={[styles.progressLabel, { color: colors.text }]}>{phaseLabel}</Text>
            </View>

            {showProgressBar && (
              <View style={[styles.progressBg, { backgroundColor: "rgba(255,255,255,0.07)" }]}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: accent,
                      width: progressAnim.interpolate({
                        inputRange: [0, 100], outputRange: ["0%", "100%"],
                      }),
                    },
                  ]}
                />
              </View>
            )}

            {/* Step indicators — canonical submissions skip the thumbnail
                step entirely (see uploadReel's Step 3 comment: the
                canonical model has no thumbnail field to send it to), so
                the indicator omits that step rather than showing one
                that can never activate. */}
            <View style={styles.stepsRow}>
              {(engine === "canonical" ? [
                { key: "getting_url", label: "Prepare" },
                { key: "uploading",   label: "Upload"  },
                { key: "saving",      label: "Save"    },
              ] : [
                { key: "getting_url", label: "Prepare" },
                { key: "uploading",   label: "Upload"  },
                { key: "thumb",       label: "Thumb"   },
                { key: "saving",      label: "Save"    },
              ]).map((step, i) => {
                const phases: UploadPhase[] = engine === "canonical"
                  ? ["getting_url", "uploading", "saving"]
                  : ["getting_url", "uploading", "thumb", "saving"];
                const stepIdx  = phases.indexOf(step.key as UploadPhase);
                const curIdx   = phases.indexOf(phase);
                const done     = curIdx > stepIdx;
                const active   = curIdx === stepIdx;
                return (
                  <View key={step.key} style={styles.stepItem}>
                    <View style={[
                      styles.stepDot,
                      done   && { backgroundColor: "#2ecc71" },
                      active && { backgroundColor: accent },
                      !done && !active && { backgroundColor: "rgba(255,255,255,0.15)" },
                    ]}>
                      {done
                        ? <Text style={{ fontSize: 9, color: "#fff" }}>✓</Text>
                        : <Text style={{ fontSize: 8, color: active ? "#fff" : "rgba(255,255,255,0.4)" }}>{i + 1}</Text>
                      }
                    </View>
                    <Text style={[styles.stepLabel, { color: active ? accent : done ? "#2ecc71" : "rgba(255,255,255,0.3)" }]}>
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Upload failed — persistent retry state (brief §16), not just
            the one-shot Alert already shown at the moment of failure. */}
        {uploadFailed && videoAsset && !loading && (
          <View style={[styles.progressBox, { backgroundColor: "#e74c3c12", borderColor: "#e74c3c40" }]}>
            <Text style={{ color: "#e74c3c", fontSize: 13, fontWeight: "800" }}>Upload failed</Text>
            <Text style={[styles.statusDesc, { color: colors.textSecondary }]}>
              Your video wasn&rsquo;t uploaded successfully.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                onPress={uploadReel}
                accessibilityRole="button"
                accessibilityLabel="Try upload again"
                style={{ backgroundColor: accent, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 }}
              >
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={pickVideo}
                accessibilityRole="button"
                accessibilityLabel="Choose another video"
                style={{ borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 }}
              >
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>Choose Another Video</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Submit button */}
        {(() => {
          const alreadySubmitted = engine === "canonical" && !!canonicalSubmission
            && canonicalSubmission.status !== "WITHDRAWN" && canonicalSubmission.status !== "REMOVED";
          const disabled = !videoAsset || loading || engine === "loading" || alreadySubmitted;
          const label = alreadySubmitted ? "Already Submitted" : loading ? "Submitting…" : "Submit to Battle 🚀";
          return (
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: accent, opacity: disabled ? 0.6 : 1 }]}
              onPress={uploadReel}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ disabled }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name={alreadySubmitted ? "checkmark-circle" : "rocket"} size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>{label}</Text>
                </>
              )}
            </TouchableOpacity>
          );
        })()}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  centered:  { flex: 1, justifyContent: "center", alignItems: "center", padding: 30, gap: 16 },

  backBtn:  { flexDirection: "row", alignItems: "center", gap: 8, padding: 16 },
  backText: { fontSize: 15, fontWeight: "600" },

  notEligibleTitle:  { fontSize: 22, fontWeight: "900", textAlign: "center" },
  notEligibleText:   { fontSize: 14, fontWeight: "500", textAlign: "center", lineHeight: 22 },
  backToListBtn:     { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  backToListBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  battleBanner: { marginHorizontal: 16, marginBottom: 14, borderRadius: 18, padding: 16, gap: 6 },
  battleTypePill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 4 },
  battleTypePillText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  battleBannerTitle:  { color: "#fff", fontSize: 18, fontWeight: "900", lineHeight: 24 },
  battleBannerMonth:  { color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "600" },

  studentCard: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
  studentAvatar:            { width: 46, height: 46, borderRadius: 23 },
  studentAvatarPlaceholder: { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center" },
  studentAvatarInitial:     { fontSize: 18, fontWeight: "900" },
  studentName:  { fontSize: 14, fontWeight: "800" },
  studentMeta:  { fontSize: 11, fontWeight: "500", marginTop: 1 },
  eligibleBadge:     { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  eligibleBadgeText: { fontSize: 10, fontWeight: "800" },

  section: { marginHorizontal: 16, marginBottom: 14, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle:      { fontSize: 13, fontWeight: "800" },
  countBadge:        { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  countBadgeText:    { fontSize: 11, fontWeight: "800" },

  postsList: { paddingHorizontal: 14, paddingBottom: 14 },
  postRow:   { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 12 },
  postThumbWrap:  { position: "relative", width: 56, height: 80, borderRadius: 14, overflow: "hidden" },
  postThumb:      { width: 56, height: 80 },
  postThumbEmpty: { width: 56, height: 80, justifyContent: "center", alignItems: "center" },
  postLabel:   { fontSize: 12, fontWeight: "700" },
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText:  { fontSize: 11, fontWeight: "800" },
  statusDesc:  { fontSize: 11, fontWeight: "500", lineHeight: 16 },
  rejectionBox: { marginTop: 4, padding: 8, backgroundColor: "#e74c3c15", borderRadius: 8, borderLeftWidth: 3, borderLeftColor: "#e74c3c" },
  rejectionLabel: { color: "#e74c3c", fontSize: 10, fontWeight: "800" },
  rejectionText:  { color: "#e74c3c", fontSize: 11, fontWeight: "500", marginTop: 2 },

  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginHorizontal: 16, marginBottom: 14, padding: 12, borderRadius: 12, borderWidth: 1 },
  infoBoxText: { fontSize: 12, fontWeight: "600", flex: 1, lineHeight: 18 },

  videoPicker: { marginHorizontal: 16, marginBottom: 14, borderRadius: 18, borderWidth: 1.5, overflow: "hidden", minHeight: 220 },
  videoPreview:   { width: "100%", height: 220 },
  videoOverlay:   { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", padding: 12 },
  changeVideoBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end", backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  changeVideoText:   { color: "#fff", fontSize: 12, fontWeight: "700" },
  thumbnailPreview:  { position: "absolute", bottom: 12, left: 12, width: 48, height: 72, borderRadius: 8, borderWidth: 2, borderColor: "#fff" },
  videoPickerEmpty:    { flex: 1 },
  videoPickerGradient: { flex: 1, minHeight: 220, justifyContent: "center", alignItems: "center", gap: 10, padding: 24 },
  videoPickerTitle:   { fontSize: 16, fontWeight: "800", textAlign: "center" },
  videoPickerSub:     { fontSize: 13, fontWeight: "500", textAlign: "center" },
  videoPickerBtn:     { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 6 },
  videoPickerBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // Caption + scope (new)
  captionBox:    { marginHorizontal: 16, marginBottom: 14, padding: 14, borderRadius: 14, borderWidth: 1, gap: 8 },
  captionLabel:  { fontSize: 13, fontWeight: "800" },
  captionInput:  { fontSize: 14, fontWeight: "500", minHeight: 60, borderWidth: 1, borderRadius: 10, padding: 10, textAlignVertical: "top" },
  scopeBox:      { marginHorizontal: 16, marginBottom: 14, padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  scopeRow:      { flexDirection: "row", gap: 10 },
  scopePill:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
  scopePillText: { fontSize: 12, fontWeight: "700" },
  scopeHint:     { fontSize: 11, fontWeight: "500", lineHeight: 15 },

  rulesBox:   { marginHorizontal: 16, marginBottom: 16, padding: 14, borderRadius: 14, borderWidth: 1, gap: 8 },
  rulesTitle: { fontSize: 14, fontWeight: "800", marginBottom: 4 },
  ruleRow:    { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  ruleDot:    { fontSize: 16, lineHeight: 20 },
  ruleText:   { fontSize: 12, fontWeight: "500", flex: 1, lineHeight: 18 },

  // Progress box
  progressBox:      { marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  progressLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressLabel:    { fontSize: 13, fontWeight: "700", flex: 1 },
  progressBg:       { height: 8, borderRadius: 5, overflow: "hidden" },
  progressFill:     { height: "100%", borderRadius: 5 },

  // Step indicators
  stepsRow:   { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  stepItem:   { alignItems: "center", gap: 4, flex: 1 },
  stepDot:    { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stepLabel:  { fontSize: 10.5, fontWeight: "700" },

  submitBtn: { marginHorizontal: 16, marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 16 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});