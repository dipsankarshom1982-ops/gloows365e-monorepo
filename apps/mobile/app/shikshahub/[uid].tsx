// PATH: apps/mobile/app/shikshahub/[uid].tsx
// Specific-tutor landing page — real Expo Router dynamic segment (mobile
// has a native router, no static-export constraint unlike apps/web's
// ?id= query-string equivalent). No contact/enquiry action here —
// explicitly deferred, see the approved plan's Context section.

import { useTheme } from "@/context/ThemeContext";
import { useAppTranslation } from "@/context/LanguageContext";
import {
  fetchTutorById,
  fetchTutorServices,
  requestBookingCall,
  requestInstantHelpCall,
  listenToBooking,
  slotOptionsForDate,
  type MarketplaceTutor,
} from "@/lib/shikshahub";
import type { Booking, BookingSessionType, TutorService } from "@gloows/shared-logic";

const SERVICE_TYPE_LABEL: Record<TutorService["serviceType"], string> = {
  one_time: "One-time",
  short_term: "Short-term",
  long_term: "Long-term",
  instant_help: "Instant Help",
};
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ShikshaHubProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { colors } = useTheme();
  const { t } = useAppTranslation();
  const [tutor, setTutor]     = useState<MarketplaceTutor | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!uid) return;
    fetchTutorById(uid)
      .then((tu) => { if (tu) setTutor(tu); else setNotFound(true); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [uid]);

  if (loading) {
    return (
      <SafeAreaView style={[S.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color="#14b8a6" size="large" />
      </SafeAreaView>
    );
  }

  if (notFound || !tutor) {
    return (
      <SafeAreaView style={[S.center, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 40 }}>🤔</Text>
        <Text style={[S.notFoundText, { color: colors.textSecondary }]}>
          {t("shikshaHubNotFound") ?? "This tutor profile isn't available anymore."}
        </Text>
        <TouchableOpacity style={S.backLink} onPress={() => router.replace("/shikshahub" as any)}>
          <Text style={S.backLinkText}>{t("browseShikshaHub") ?? "Browse ShikshaHub"}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[S.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={S.imageWrap}>
          {tutor.profilePic ? (
            <Image source={{ uri: tutor.profilePic }} style={S.image} resizeMode="cover" />
          ) : (
            <LinearGradient colors={["#0f766e", "#14b8a6"]} style={[S.image, S.center]}>
              <Text style={{ fontSize: 56 }}>🧑‍🏫</Text>
            </LinearGradient>
          )}
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={{ padding: 20, gap: 12 }}>
          <Text style={[S.name, { color: colors.text }]}>{tutor.name || "Tutor"}</Text>

          {tutor.subjects.length > 0 && (
            <View style={S.chipRow}>
              {tutor.subjects.map((s) => (
                <Text key={s} style={S.subjectChip}>{s}</Text>
              ))}
            </View>
          )}

          {!!tutor.qualification && (
            <Field label={t("shikshaHubQualificationLabel") ?? "Qualification"} value={tutor.qualification} colors={colors} />
          )}
          {tutor.teachingExperienceYears != null && (
            <Field label={t("shikshaHubExperienceLabel") ?? "Experience"} value={`${tutor.teachingExperienceYears} years`} colors={colors} />
          )}
          {!!tutor.preferredLanguage && (
            <Field label={t("shikshaHubLanguageLabel") ?? "Preferred Language"} value={tutor.preferredLanguage} colors={colors} />
          )}
          {!!tutor.bio && (
            <View style={{ marginTop: 4 }}>
              <Text style={[S.fieldLabel, { color: colors.textSecondary }]}>{t("shikshaHubBioLabel") ?? "About"}</Text>
              <Text style={[S.bio, { color: colors.text }]}>{tutor.bio}</Text>
            </View>
          )}

          <View style={[S.bookingCard, { borderColor: colors.border }]}>
            <Text style={[S.bookingTitle, { color: colors.text }]}>
              {(t("shikshaHubInterested") ?? "Interested in learning with") + " " + (tutor.name || "this tutor") + "?"}
            </Text>
            <BookingPanel tutor={tutor} colors={colors} t={t} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_META: Record<Booking["status"], { label: string; color: string }> = {
  requested: { label: "Requested — waiting for tutor confirmation", color: "#f59e0b" },
  accepted:  { label: "Accepted",  color: "#22c55e" },
  declined:  { label: "Declined",  color: "#ef4444" },
  cancelled: { label: "Cancelled", color: "#94a3b8" },
};

/** ShikshaHub Phase 3 — fetches this tutor's published services first; if
 *  they have any, renders the service picker (ServiceBookingPanel) and
 *  never falls back to the legacy flat fields — matches requestBooking's
 *  own migration rule (see functions/src/tutorBooking.ts's header
 *  comment). Zero services → byte-for-byte the same legacy form Phase 1/2
 *  always had (LegacyBookingPanel). */
function BookingPanel({ tutor, colors, t }: { tutor: MarketplaceTutor; colors: any; t: (k: string) => string | undefined }) {
  const [services, setServices]               = useState<TutorService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);

  useEffect(() => {
    fetchTutorServices(tutor.uid).then(setServices).finally(() => setServicesLoading(false));
  }, [tutor.uid]);

  if (servicesLoading) return null;

  return services.length > 0
    ? <ServiceBookingPanel tutor={tutor} services={services} colors={colors} t={t} />
    : <LegacyBookingPanel tutor={tutor} colors={colors} t={t} />;
}

function BookingStatusView({ bookingId, booking, colors, t }: {
  bookingId: string; booking: Booking | null; colors: any; t: (k: string) => string | undefined;
}) {
  const meta = booking ? STATUS_META[booking.status] : null;
  return (
    <View style={{ alignItems: "center", gap: 6, paddingVertical: 4 }}>
      <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text }}>
        {t("shikshaHubBookingSent") ?? "Booking request sent"}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: meta?.color ?? colors.textSecondary }} />
        <Text style={{ fontSize: 12, fontWeight: "700", color: meta?.color ?? colors.textSecondary }}>
          {meta ? meta.label : (t("shikshaHubBookingWaiting") ?? "Waiting for tutor confirmation")}
        </Text>
      </View>
    </View>
  );
}

/** ShikshaHub Phase 3 — service-based booking. Mirrors apps/web's
 *  ServiceBookingPanel: subject/fee/mode/duration all come off the
 *  selected service doc, never re-derived here. instant_help services are
 *  shown (browse/rate-visibility) but not selectable for booking. */
function ServiceBookingPanel({ tutor, services, colors, t }: {
  tutor: MarketplaceTutor; services: TutorService[]; colors: any; t: (k: string) => string | undefined;
}) {
  const [serviceId, setServiceId]     = useState(services[0]?.id ?? "");
  const [sessionType, setSessionType] = useState<BookingSessionType>("trial");
  const [date, setDate]               = useState(todayDateStr());
  const [slotStart, setSlotStart]     = useState("");
  const [phase, setPhase]             = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg]       = useState("");
  const [bookingId, setBookingId]     = useState<string | null>(null);
  const [booking, setBooking]         = useState<Booking | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const isInstantHelp = service?.serviceType === "instant_help";

  const slots = useMemo(
    () => (service && !isInstantHelp ? slotOptionsForDate(service.availability ?? null, date) : []),
    [service, isInstantHelp, date]
  );

  useEffect(() => { setSlotStart(""); }, [date, serviceId]);
  useEffect(() => {
    if (service && !isInstantHelp && sessionType === "trial" && !service.trialAvailable) setSessionType("regular");
  }, [service, isInstantHelp, sessionType]);

  useEffect(() => {
    if (!bookingId) return;
    return listenToBooking(bookingId, setBooking);
  }, [bookingId]);

  if (bookingId) return <BookingStatusView bookingId={bookingId} booking={booking} colors={colors} t={t} />;

  async function handleRequestInstantHelp() {
    if (!service || !isInstantHelp) return;
    setPhase("submitting");
    setErrorMsg("");
    try {
      await requestInstantHelpCall(tutor.uid, service.id!);
      // No local "waiting" state — components/InstantHelpBar.tsx (mounted
      // globally in app/_layout.tsx) picks up the new pending request via
      // its own live listener from anywhere in the app.
      setPhase("idle");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Could not send the request. Please try again.");
      setPhase("error");
    }
  }

  async function handleSubmit() {
    const selectedSlot = slots.find((s) => s.start === slotStart);
    if (!service || isInstantHelp || !selectedSlot) return;
    setPhase("submitting");
    setErrorMsg("");
    try {
      const res = await requestBookingCall({
        tutorUid: tutor.uid,
        serviceId: service.id!,
        subject: service.subject,
        sessionType,
        requestedDate: date,
        requestedStartTime: selectedSlot.start,
        requestedEndTime: selectedSlot.end,
      });
      setBookingId(res.bookingId);
      setPhase("idle");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Could not send the booking request. Please try again.");
      setPhase("error");
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <View>
        <Text style={[S.bookingLabel, { color: colors.textSecondary }]}>{t("serviceLabel") ?? "Service"}</Text>
        <View style={S.chipRow}>
          {services.map((s) => (
            <TouchableOpacity key={s.id} onPress={() => setServiceId(s.id!)} style={[S.pickChip, serviceId === s.id && S.pickChipActive]}>
              <Text style={[S.pickChipText, serviceId === s.id && S.pickChipTextActive]}>
                {s.serviceName} · {SERVICE_TYPE_LABEL[s.serviceType]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isInstantHelp ? (
        <View style={{ gap: 8, paddingVertical: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary }}>{t("shikshaHubFeeLabel") ?? "Fee"}</Text>
            <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>
              {service?.creditsPerMinute ?? "—"} {t("creditsPerMinuteSuffix") ?? "credits/min"}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tutor.isOnlineForInstantHelp ? "#10b981" : colors.textSecondary }} />
            <Text style={{ fontSize: 11.5, fontWeight: "700", color: tutor.isOnlineForInstantHelp ? "#10b981" : colors.textSecondary }}>
              {tutor.isOnlineForInstantHelp
                ? (t("instantHelpTutorOnline") ?? "Online now")
                : (t("instantHelpTutorOffline") ?? "Offline — can't request right now")}
            </Text>
          </View>

          {phase === "error" && (
            <Text style={{ fontSize: 11.5, fontWeight: "600", color: "#ef4444" }}>{errorMsg}</Text>
          )}

          <TouchableOpacity
            onPress={handleRequestInstantHelp}
            disabled={!tutor.isOnlineForInstantHelp || phase === "submitting"}
            style={[S.submitBtn, (!tutor.isOnlineForInstantHelp || phase === "submitting") && { opacity: 0.55 }]}
          >
            <Text style={S.submitBtnText}>
              {phase === "submitting" ? (t("shikshaHubRequesting") ?? "Sending request…") : (t("instantHelpAskNow") ?? "Ask Now")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/shikshahub/credits" as any)}>
            <Text style={{ textAlign: "center", fontSize: 11.5, fontWeight: "700", color: "#0d9488" }}>
              {t("instantHelpBuyCreditsLink") ?? "Buy credits →"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View>
            <Text style={[S.bookingLabel, { color: colors.textSecondary }]}>{t("shikshaHubSessionTypeLabel") ?? "Session"}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["trial", "regular"] as const).map((opt) => {
                const disabled = opt === "trial" && !service?.trialAvailable;
                return (
                  <TouchableOpacity
                    key={opt}
                    disabled={disabled}
                    onPress={() => setSessionType(opt)}
                    style={[S.pickChip, { flex: 1, alignItems: "center" }, sessionType === opt && S.pickChipActive, disabled && { opacity: 0.4 }]}
                  >
                    <Text style={[S.pickChipText, sessionType === opt && S.pickChipTextActive]}>
                      {opt === "trial" ? (t("shikshaHubTrial") ?? "Trial") : (t("shikshaHubRegular") ?? "Regular")}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={[S.bookingLabel, { color: colors.textSecondary }]}>{t("shikshaHubDateLabel") ?? "Date"}</Text>
            <TextInput
              value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary}
              style={[S.bookingInput, { color: colors.text, borderColor: colors.border }]}
            />
          </View>

          <View>
            <Text style={[S.bookingLabel, { color: colors.textSecondary }]}>{t("shikshaHubTimeLabel") ?? "Time"}</Text>
            {slots.length === 0 ? (
              <Text style={{ fontSize: 11.5, fontWeight: "600", color: colors.textSecondary }}>
                {t("shikshaHubNoSlots") ?? "No slots available on this date — try another day."}
              </Text>
            ) : (
              <View style={S.chipRow}>
                {slots.map((s) => (
                  <TouchableOpacity key={s.start} onPress={() => setSlotStart(s.start)} style={[S.pickChip, slotStart === s.start && S.pickChipActive]}>
                    <Text style={[S.pickChipText, slotStart === s.start && S.pickChipTextActive]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary }}>{t("shikshaHubFeeLabel") ?? "Fee"}</Text>
            <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>₹{service?.sessionFee}</Text>
          </View>

          {phase === "error" && (
            <Text style={{ fontSize: 11.5, fontWeight: "600", color: "#ef4444" }}>{errorMsg}</Text>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!slotStart || phase === "submitting"}
            style={[S.submitBtn, (!slotStart || phase === "submitting") && { opacity: 0.55 }]}
          >
            <Text style={S.submitBtnText}>
              {phase === "submitting" ? (t("shikshaHubRequesting") ?? "Sending request…") : (t("shikshaHubRequestBooking") ?? "Request Booking")}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

/** ShikshaHub Phase 1/2 legacy booking form — unchanged from before Phase
 *  3, rendered only for a tutor with zero services. */
function LegacyBookingPanel({ tutor, colors, t }: { tutor: MarketplaceTutor; colors: any; t: (k: string) => string | undefined }) {
  const [subject, setSubject]         = useState(tutor.subjects[0] ?? "");
  const [sessionType, setSessionType] = useState<BookingSessionType>("trial");
  const [date, setDate]               = useState(todayDateStr());
  const [slotStart, setSlotStart]     = useState("");
  const [phase, setPhase]             = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg]       = useState("");
  const [bookingId, setBookingId]     = useState<string | null>(null);
  const [booking, setBooking]         = useState<Booking | null>(null);

  const slots = useMemo(() => slotOptionsForDate(tutor.availability, date), [tutor.availability, date]);

  useEffect(() => { setSlotStart(""); }, [date]);

  useEffect(() => {
    if (!bookingId) return;
    return listenToBooking(bookingId, setBooking);
  }, [bookingId]);

  if (tutor.subjects.length === 0 || tutor.sessionFee == null) {
    return (
      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, textAlign: "center", paddingVertical: 8 }}>
        {t("shikshaHubBookingNotReady") ?? "This tutor hasn't set up bookable subjects/pricing yet."}
      </Text>
    );
  }

  if (bookingId) {
    const meta = booking ? STATUS_META[booking.status] : null;
    return (
      <View style={{ alignItems: "center", gap: 6, paddingVertical: 4 }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text }}>
          {t("shikshaHubBookingSent") ?? "Booking request sent"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: meta?.color ?? colors.textSecondary }} />
          <Text style={{ fontSize: 12, fontWeight: "700", color: meta?.color ?? colors.textSecondary }}>
            {meta ? meta.label : (t("shikshaHubBookingWaiting") ?? "Waiting for tutor confirmation")}
          </Text>
        </View>
      </View>
    );
  }

  async function handleSubmit() {
    const selectedSlot = slots.find((s) => s.start === slotStart);
    if (!selectedSlot) return;
    setPhase("submitting");
    setErrorMsg("");
    try {
      const res = await requestBookingCall({
        tutorUid: tutor.uid,
        subject,
        sessionType,
        requestedDate: date,
        requestedStartTime: selectedSlot.start,
        requestedEndTime: selectedSlot.end,
      });
      setBookingId(res.bookingId);
      setPhase("idle");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Could not send the booking request. Please try again.");
      setPhase("error");
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <View>
        <Text style={[S.bookingLabel, { color: colors.textSecondary }]}>{t("shikshaHubSubjectLabel") ?? "Subject"}</Text>
        <View style={S.chipRow}>
          {tutor.subjects.map((s) => (
            <TouchableOpacity key={s} onPress={() => setSubject(s)} style={[S.pickChip, subject === s && S.pickChipActive]}>
              <Text style={[S.pickChipText, subject === s && S.pickChipTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View>
        <Text style={[S.bookingLabel, { color: colors.textSecondary }]}>{t("shikshaHubSessionTypeLabel") ?? "Session"}</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["trial", "regular"] as const).map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => setSessionType(opt)}
              style={[S.pickChip, { flex: 1, alignItems: "center" }, sessionType === opt && S.pickChipActive]}
            >
              <Text style={[S.pickChipText, sessionType === opt && S.pickChipTextActive]}>
                {opt === "trial" ? (t("shikshaHubTrial") ?? "Trial") : (t("shikshaHubRegular") ?? "Regular")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View>
        <Text style={[S.bookingLabel, { color: colors.textSecondary }]}>{t("shikshaHubDateLabel") ?? "Date"}</Text>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textSecondary}
          style={[S.bookingInput, { color: colors.text, borderColor: colors.border }]}
        />
      </View>

      <View>
        <Text style={[S.bookingLabel, { color: colors.textSecondary }]}>{t("shikshaHubTimeLabel") ?? "Time"}</Text>
        {slots.length === 0 ? (
          <Text style={{ fontSize: 11.5, fontWeight: "600", color: colors.textSecondary }}>
            {t("shikshaHubNoSlots") ?? "No slots available on this date — try another day."}
          </Text>
        ) : (
          <View style={S.chipRow}>
            {slots.map((s) => (
              <TouchableOpacity
                key={s.start}
                onPress={() => setSlotStart(s.start)}
                style={[S.pickChip, slotStart === s.start && S.pickChipActive]}
              >
                <Text style={[S.pickChipText, slotStart === s.start && S.pickChipTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary }}>{t("shikshaHubFeeLabel") ?? "Fee"}</Text>
        <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>₹{tutor.sessionFee}</Text>
      </View>

      {phase === "error" && (
        <Text style={{ fontSize: 11.5, fontWeight: "600", color: "#ef4444" }}>{errorMsg}</Text>
      )}

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={!slotStart || phase === "submitting"}
        style={[S.submitBtn, (!slotStart || phase === "submitting") && { opacity: 0.55 }]}
      >
        <Text style={S.submitBtnText}>
          {phase === "submitting" ? (t("shikshaHubRequesting") ?? "Sending request…") : (t("shikshaHubRequestBooking") ?? "Request Booking")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function Field({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View>
      <Text style={[S.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[S.fieldValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  notFoundText: { fontSize: 14, fontWeight: "600" },
  backLink: { marginTop: 4, backgroundColor: "#14b8a6", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  backLinkText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  imageWrap: { position: "relative" },
  image: { width: "100%", height: 220 },
  backBtn: { position: "absolute", top: 14, left: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },

  name: { fontSize: 22, fontWeight: "900" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subjectChip: { fontSize: 11, fontWeight: "700", color: "#14b8a6", borderWidth: 1, borderColor: "#14b8a6", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },

  fieldLabel: { fontSize: 11, fontWeight: "700", marginBottom: 2 },
  fieldValue: { fontSize: 14, fontWeight: "600" },
  bio: { fontSize: 13, lineHeight: 20, fontWeight: "500" },

  bookingCard: { marginTop: 6, borderWidth: 1, borderRadius: 18, padding: 16, gap: 12, backgroundColor: "rgba(20,184,166,0.06)" },
  bookingTitle: { fontSize: 13.5, fontWeight: "800" },
  bookingLabel: { fontSize: 10.5, fontWeight: "800", marginBottom: 5 },
  bookingInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, fontWeight: "600" },

  // Reuses the chipRow key already defined above (subject-chip row) — same
  // flex-wrap layout works for the booking panel's subject/time chips too.
  pickChip: { borderWidth: 1, borderColor: "#334155", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  pickChipActive: { backgroundColor: "rgba(20,184,166,0.15)", borderColor: "#14b8a6" },
  pickChipText: { fontSize: 11.5, fontWeight: "700", color: "#94a3b8" },
  pickChipTextActive: { color: "#0d9488" },

  submitBtn: { borderRadius: 14, paddingVertical: 13, alignItems: "center", backgroundColor: "#0f766e" },
  submitBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
