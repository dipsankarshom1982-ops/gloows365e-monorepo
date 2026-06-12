// PATH: app/ai-guru/notebook.tsx
// My AI Notebook — every saved AI Q&A in one place.
// Features: pin to top, filter by mode, delete, search, open full entry.

import { useCallback, useState } from "react";
import {
  Alert, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { useTheme } from "@/context/ThemeContext";
import { useAppTranslation } from "@/context/LanguageContext";
import {
  getNotebookEntries, deleteNotebookEntry, togglePin,
  NotebookEntry,
} from "@/services/aiNotebookService";

const MODE_COLORS: Record<string, string> = {
  explain:   "#6366f1",
  notes:     "#0284c7",
  exam:      "#dc2626",
  doubt:     "#d97706",
  summarize: "#059669",
  tip:       "#7c3aed",
  language:  "#be185d",
};

const ALL_FILTER = "all";

function relTime(ts: any): string {
  if (!ts) return "";
  const ms  = ts?.toMillis?.() ?? (ts?.seconds ? ts.seconds * 1000 : Date.now());
  const ago = Math.floor((Date.now() - ms) / 1000);
  if (ago < 60)    return "Just now";
  if (ago < 3600)  return `${Math.floor(ago / 60)}m ago`;
  if (ago < 86400) return `${Math.floor(ago / 3600)}h ago`;
  if (ago < 604800) return `${Math.floor(ago / 86400)}d ago`;
  return new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function NotebookScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();
  const { t } = useAppTranslation();

  const bg      = isDarkMode ? "#060612" : colors.background;
  const surface = isDarkMode ? "#1e293b" : colors.card;
  const border  = isDarkMode ? "#334155" : colors.border;
  const text    = isDarkMode ? "#f1f5f9" : colors.text;
  const muted   = isDarkMode ? "#94a3b8" : colors.textSecondary;
  const dim     = isDarkMode ? "#64748b" : colors.textSecondary;
  const backBg  = isDarkMode ? "rgba(255,255,255,0.08)" : colors.card;

  const [entries,     setEntries]     = useState<NotebookEntry[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode,  setFilterMode]  = useState<string>(ALL_FILTER);
  const [expanded,    setExpanded]    = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await getNotebookEntries();
      setEntries(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (entry: NotebookEntry) => {
    Alert.alert("Delete entry?", `"${entry.question.slice(0, 60)}…"`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await deleteNotebookEntry(entry.id);
          setEntries((prev) => prev.filter((e) => e.id !== entry.id));
        },
      },
    ]);
  };

  const handleTogglePin = async (entry: NotebookEntry) => {
    await togglePin(entry.id, entry.pinned);
    setEntries((prev) =>
      prev.map((e) => e.id === entry.id ? { ...e, pinned: !e.pinned } : e)
    );
  };

  // Filter + search + sort (pinned first)
  const filtered = entries
    .filter((e) => {
      if (filterMode !== ALL_FILTER && e.mode !== filterMode) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return e.question.toLowerCase().includes(q) || e.answer.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });

  // Unique modes present in entries for filter chips
  const modesPresent = [ALL_FILTER, ...Array.from(new Set(entries.map((e) => e.mode)))];

  return (
    <View style={[S.root, { backgroundColor: bg }]}>
      {isDarkMode && <LinearGradient colors={["#060612", "#0a0a1a"]} style={StyleSheet.absoluteFillObject} />}

      {/* Header */}
      <Animated.View entering={FadeIn.duration(350)} style={[S.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={[S.backBtn, { backgroundColor: backBg }]}>
          <Ionicons name="chevron-back" size={22} color={muted} />
        </TouchableOpacity>
        <View style={S.headerCenter}>
          <Text style={[S.headerTitle, { color: text }]}>📓 {t("notebookTitle") ?? "My AI Notebook"}</Text>
          <Text style={[S.headerSub, { color: dim }]}>{entries.length} saved conversation{entries.length !== 1 ? "s" : ""}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/ai-guru/ask" as any)}
          style={[S.askBtn, { backgroundColor: "rgba(99,102,241,0.15)", borderColor: "#6366f1" }]}
        >
          <Ionicons name="add" size={16} color="#818cf8" />
          <Text style={S.askBtnText}>Ask AI</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Search bar */}
      <View style={[S.searchBar, { backgroundColor: surface, borderColor: border, marginHorizontal: 16 }]}>
        <Ionicons name="search-outline" size={16} color={dim} />
        <TextInput
          style={[S.searchInput, { color: text }]}
          placeholder="Search your notebook…"
          placeholderTextColor={dim}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={16} color={dim} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.filterRow}
        style={{ maxHeight: 48 }}
      >
        {modesPresent.map((mode) => {
          const active = filterMode === mode;
          const color  = mode === ALL_FILTER ? "#6366f1" : (MODE_COLORS[mode] ?? "#6366f1");
          return (
            <TouchableOpacity
              key={mode}
              onPress={() => setFilterMode(mode)}
              style={[S.filterChip, { borderColor: active ? color : border, backgroundColor: active ? `${color}18` : "transparent" }]}
            >
              <Text style={[S.filterChipText, { color: active ? color : dim }]}>
                {mode === ALL_FILTER ? "All" : mode.charAt(0).toUpperCase() + mode.slice(1).replace("_", " ")}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Entries list */}
      <ScrollView
        contentContainerStyle={[S.list, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#6366f1" />}
      >
        {loading && (
          <View style={S.emptyBlock}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[S.skeleton, { backgroundColor: surface, opacity: 0.6 - i * 0.15 }]} />
            ))}
          </View>
        )}

        {!loading && filtered.length === 0 && (
          <Animated.View entering={FadeIn.duration(400)} style={S.emptyBlock}>
            <Text style={S.emptyEmoji}>📓</Text>
            <Text style={[S.emptyTitle, { color: text }]}>
              {searchQuery || filterMode !== ALL_FILTER ? "No results found" : "Your notebook is empty"}
            </Text>
            <Text style={[S.emptyBody, { color: dim }]}>
              {searchQuery || filterMode !== ALL_FILTER
                ? "Try a different search or filter"
                : "Save any AI answer by tapping \"Save to Notebook\" after asking a question"}
            </Text>
            {!searchQuery && filterMode === ALL_FILTER && (
              <TouchableOpacity onPress={() => router.push("/ai-guru/ask" as any)} style={S.emptyBtn}>
                <LinearGradient colors={["#312e81", "#4f46e5"]} style={S.emptyBtnGrad}>
                  <Text style={S.emptyBtnText}>Ask AI Guru →</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {!loading && filtered.map((entry, i) => {
          const modeColor = MODE_COLORS[entry.mode] ?? "#6366f1";
          const isExpanded = expanded === entry.id;

          return (
            <Animated.View
              key={entry.id}
              entering={FadeInDown.duration(350).delay(i * 40)}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setExpanded(isExpanded ? null : entry.id)}
                style={[S.entryCard, { backgroundColor: surface, borderColor: entry.pinned ? modeColor : border }]}
              >
                {/* Top row */}
                <View style={S.entryTop}>
                  <View style={[S.modePill, { backgroundColor: `${modeColor}18`, borderColor: `${modeColor}40` }]}>
                    <Text style={[S.modePillText, { color: modeColor }]}>{entry.modeLabel}</Text>
                  </View>
                  <View style={S.entryActions}>
                    {entry.pinned && (
                      <Ionicons name="pin" size={13} color={modeColor} style={{ marginRight: 4 }} />
                    )}
                    <Text style={[S.entryTime, { color: dim }]}>{relTime(entry.createdAt)}</Text>
                  </View>
                </View>

                {/* Question */}
                <Text style={[S.entryQuestion, { color: text }]} numberOfLines={isExpanded ? undefined : 2}>
                  {entry.question}
                </Text>

                {/* Answer — only when expanded */}
                {isExpanded && (
                  <View style={[S.answerExpanded, { borderColor: border }]}>
                    <Text style={[S.answerExpandedText, { color: muted }]}>{entry.answer}</Text>
                  </View>
                )}

                {/* Footer */}
                <View style={S.entryFooter}>
                  <Text style={[S.expandHint, { color: dim }]}>
                    {isExpanded ? "Tap to collapse ↑" : "Tap to read ↓"}
                  </Text>
                  <View style={S.entryFooterActions}>
                    <TouchableOpacity onPress={() => handleTogglePin(entry)} style={S.iconBtn}>
                      <Ionicons name={entry.pinned ? "pin" : "pin-outline"} size={16} color={entry.pinned ? modeColor : dim} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        router.push({
                          pathname: "/ai-guru/ask",
                          params: { prefill: entry.question, mode: entry.mode },
                        } as any);
                      }}
                      style={S.iconBtn}
                    >
                      <Ionicons name="refresh-outline" size={16} color={dim} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(entry)} style={S.iconBtn}>
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root:   { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  backBtn:{ width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 18, fontWeight: "900" },
  headerSub:    { fontSize: 11, marginTop: 1 },
  askBtn:       { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  askBtnText:   { color: "#818cf8", fontSize: 12, fontWeight: "700" },

  searchBar:    { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10 },
  searchInput:  { flex: 1, fontSize: 14 },

  filterRow:    { paddingHorizontal: 16, gap: 8, paddingBottom: 8, alignItems: "center" },
  filterChip:   { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  filterChipText:{ fontSize: 12, fontWeight: "700" },

  list:         { paddingHorizontal: 16, paddingTop: 8, gap: 10 },

  skeleton:     { height: 90, borderRadius: 16, marginBottom: 8 },

  emptyBlock:   { alignItems: "center", paddingTop: 60, gap: 14 },
  emptyEmoji:   { fontSize: 52 },
  emptyTitle:   { fontSize: 18, fontWeight: "800", textAlign: "center" },
  emptyBody:    { fontSize: 13, textAlign: "center", lineHeight: 20, maxWidth: 280 },
  emptyBtn:     { borderRadius: 14, overflow: "hidden", marginTop: 4 },
  emptyBtnGrad: { paddingHorizontal: 28, paddingVertical: 14 },
  emptyBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  entryCard:    { borderRadius: 18, borderWidth: 1, padding: 14, gap: 8 },
  entryTop:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modePill:     { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  modePillText: { fontSize: 11, fontWeight: "800" },
  entryActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  entryTime:    { fontSize: 11 },

  entryQuestion:   { fontSize: 14, fontWeight: "700", lineHeight: 21 },
  answerExpanded:  { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 2 },
  answerExpandedText:{ fontSize: 13, lineHeight: 22 },

  entryFooter:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  expandHint:         { fontSize: 11 },
  entryFooterActions: { flexDirection: "row", gap: 4 },
  iconBtn:            { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
});
