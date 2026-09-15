// PATH: apps/mobile/components/shikshahub/AdvancedFiltersSheet.tsx
// ShikshaHub redesign — advanced filters bottom sheet (section 10 of the
// redesign spec). Sort and filters are edited as a local draft and only
// committed to the parent's actual filter state on "Apply Filters", so
// browsing options doesn't re-render the results list on every tap.
//
// Sort options are limited to what's backed by real MarketplaceTutor
// fields (name, ratingAverage, teachingExperienceYears, sessionFee) — no
// "Newest" option, since nothing here tracks a tutor's join date.

import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useEffect, useState } from "react";

export type SortMode = "recommended" | "rating" | "experience" | "priceLow" | "priceHigh";
export type PriceBand = "under500" | "500to1000" | "1000plus";

export interface FilterState {
  sortMode: SortMode;
  minRating: number | null;
  priceBand: PriceBand | null;
  minExperience: number | null;
}

export const DEFAULT_FILTERS: FilterState = {
  sortMode: "recommended",
  minRating: null,
  priceBand: null,
  minExperience: null,
};

export default function AdvancedFiltersSheet({
  visible,
  onClose,
  colors,
  t,
  value,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  colors: any;
  t: (key: string) => string | undefined;
  value: FilterState;
  onApply: (next: FilterState) => void;
}) {
  const [draft, setDraft] = useState<FilterState>(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const SORT_OPTIONS: { key: SortMode; label: string }[] = [
    { key: "recommended", label: t("shikshaHubSortRecommended") ?? "Recommended" },
    { key: "rating", label: t("shikshaHubSortTopRated") ?? "Top Rated" },
    { key: "experience", label: t("shikshaHubSortExperienced") ?? "Most Experienced" },
    { key: "priceLow", label: t("shikshaHubSortPriceLow") ?? "Lowest Price" },
    { key: "priceHigh", label: t("shikshaHubSortPriceHigh") ?? "Highest Price" },
  ];
  const PRICE_OPTIONS: { key: PriceBand | null; label: string }[] = [
    { key: null, label: t("shikshaHubAnyPrice") ?? "Any Price" },
    { key: "under500", label: t("shikshaHubPriceUnder500") ?? "Under ₹500" },
    { key: "500to1000", label: t("shikshaHubPrice500to1000") ?? "₹500–₹1,000" },
    { key: "1000plus", label: t("shikshaHubPrice1000Plus") ?? "₹1,000+" },
  ];
  const RATING_OPTIONS: { key: number | null; label: string }[] = [
    { key: null, label: t("shikshaHubAnyRating") ?? "Any Rating" },
    { key: 4, label: "4★ & Above" },
    { key: 3, label: "3★ & Above" },
  ];
  const EXPERIENCE_OPTIONS: { key: number | null; label: string }[] = [
    { key: null, label: t("shikshaHubAnyExperience") ?? "Any Experience" },
    { key: 1, label: t("shikshaHubExp1Plus") ?? "1+ Years" },
    { key: 3, label: t("shikshaHubExp3Plus") ?? "3+ Years" },
    { key: 5, label: t("shikshaHubExp5Plus") ?? "5+ Years" },
  ];

  function Row<T,>({ title, options, selected, onSelect }: {
    title: string; options: { key: T; label: string }[]; selected: T; onSelect: (k: T) => void;
  }) {
    return (
      <View style={{ marginBottom: 18 }}>
        <Text style={[S.rowTitle, { color: colors.text }]}>{title}</Text>
        <View style={S.chipWrap}>
          {options.map((opt) => {
            const active = opt.key === selected;
            return (
              <TouchableOpacity
                key={String(opt.key)}
                onPress={() => onSelect(opt.key)}
                style={[S.chip, { borderColor: colors.border }, active && S.chipActive]}
              >
                <Text style={[S.chipText, { color: colors.textSecondary }, active && S.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={S.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[S.sheet, { backgroundColor: colors.card }]}>
        <View style={[S.handle, { backgroundColor: colors.border }]} />
        <Text style={[S.heading, { color: colors.text }]}>{t("shikshaHubFilters") ?? "Filters"}</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: "72%" }}>
          <Row title={t("shikshaHubSortBy") ?? "Sort By"} options={SORT_OPTIONS} selected={draft.sortMode}
            onSelect={(k) => setDraft((d) => ({ ...d, sortMode: k }))} />
          <Row title={t("shikshaHubPriceLabel") ?? "Price"} options={PRICE_OPTIONS} selected={draft.priceBand}
            onSelect={(k) => setDraft((d) => ({ ...d, priceBand: k }))} />
          <Row title={t("shikshaHubRatingLabel") ?? "Rating"} options={RATING_OPTIONS} selected={draft.minRating}
            onSelect={(k) => setDraft((d) => ({ ...d, minRating: k }))} />
          <Row title={t("shikshaHubExperienceLabel") ?? "Experience"} options={EXPERIENCE_OPTIONS} selected={draft.minExperience}
            onSelect={(k) => setDraft((d) => ({ ...d, minExperience: k }))} />
        </ScrollView>

        <View style={S.footerRow}>
          <TouchableOpacity
            style={[S.clearBtn, { borderColor: colors.border }]}
            onPress={() => setDraft(DEFAULT_FILTERS)}
          >
            <Text style={[S.clearBtnText, { color: colors.text }]}>{t("shikshaHubClearAll") ?? "Clear All"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={S.applyBtn}
            onPress={() => { onApply(draft); onClose(); }}
          >
            <Text style={S.applyBtnText}>{t("shikshaHubApplyFilters") ?? "Apply Filters"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingBottom: 28, maxHeight: "88%" },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 14 },
  heading: { fontSize: 17, fontWeight: "900", marginBottom: 14 },
  rowTitle: { fontSize: 12.5, fontWeight: "800", marginBottom: 8 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 },
  chipActive: { backgroundColor: "rgba(20,184,166,0.15)", borderColor: "#14b8a6" },
  chipText: { fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#0d9488" },
  footerRow: { flexDirection: "row", gap: 10, marginTop: 8, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(148,163,184,0.25)" },
  clearBtn: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  clearBtnText: { fontSize: 13, fontWeight: "700" },
  applyBtn: { flex: 1.4, borderRadius: 14, paddingVertical: 13, alignItems: "center", backgroundColor: "#0f766e" },
  applyBtnText: { fontSize: 13, fontWeight: "800", color: "#fff" },
});
