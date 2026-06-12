import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";

import Header from "@/components/header";
import { useAppTranslation, useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type BaseSettingOption = {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  accentColor: string;
};

type ToggleSettingOption = BaseSettingOption & {
  toggle: true;
  value: boolean;
  route?: never;
  onToggle?: () => void;
};

type NavigationSettingOption = BaseSettingOption & {
  toggle: false;
  value?: never;
  route?: string;
  onToggle?: never;
};

type SettingOption = ToggleSettingOption | NavigationSettingOption;

export default function SettingsScreen() {
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const { t } = useAppTranslation();
  const { languageName } = useLanguage();
  const router = useRouter();
  const { enabled: notificationsEnabled, loading: notifLoading, toggle: toggleNotifications } = usePushNotifications();

  const surfaceBg  = isDarkMode ? "#1e293b" : colors.card;
  const borderCol  = isDarkMode ? "#334155" : colors.border;
  const textMain   = isDarkMode ? "#f1f5f9" : colors.text;
  const textSec    = isDarkMode ? "#94a3b8" : colors.textSecondary;
  const pageBg     = isDarkMode ? "#0a0a1a" : colors.background;

  const settingOptions: SettingOption[] = [
    {
      id: "profile",
      title: t("profileSettings"),
      description: t("editProfile"),
      icon: "person-circle-outline",
      accentColor: "#6366f1",
      toggle: false,
      route: "/profile-settings",
    },
    {
      id: "language",
      title: t("language"),
      description: t("changeLanguage"),
      icon: "globe-outline",
      accentColor: "#0ea5e9",
      toggle: false,
      route: "/language-settings",
    },
    {
      id: "theme",
      title: t("darkTheme"),
      description: isDarkMode
        ? (t("themeDescDark") ?? "Turn off for Light mode")
        : (t("themeDescLight") ?? "Turn on for Dark mode"),
      icon: isDarkMode ? "moon" : "sunny-outline",
      accentColor: "#f59e0b",
      toggle: true,
      value: isDarkMode,
      onToggle: toggleTheme,
    },
    {
      id: "notifications",
      title: t("notifications"),
      description: t("notificationsDesc") ?? "Receive push notifications",
      icon: "notifications-outline",
      accentColor: "#10b981",
      toggle: true,
      value: notificationsEnabled,
      onToggle: toggleNotifications,
    },
    {
      id: "password",
      title: t("changePassword") ?? "Change Password",
      description: t("changePasswordDesc") ?? "Update your account password",
      icon: "key-outline",
      accentColor: "#8b5cf6",
      toggle: false,
      route: "/change-password",
    },
    {
      id: "privacy",
      title: t("privacy"),
      description: t("privacyDesc") ?? "Manage your privacy settings",
      icon: "lock-closed-outline",
      accentColor: "#ef4444",
      toggle: false,
      route: "/privacy",
    },
    {
      id: "about",
      title: t("about"),
      description: t("aboutDesc") ?? "Learn more about GLOOWS365E",
      icon: "information-circle-outline",
      accentColor: "#64748b",
      toggle: false,
      route: "/about",
    },
  ];

  const handleOptionPress = (option: SettingOption): void => {
    if (!option.toggle && option.route) {
      router.push(option.route as any);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: pageBg }]}>
      {isDarkMode && (
        <LinearGradient
          colors={["#060612", "#0d0d24", "#060612"]}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      <Header hideMenu={true} />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Page title ── */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.headerText}>
          <Text style={[styles.title, { color: colors.accent }]}>
            ⚙️ {t("settings")}
          </Text>
          <Text style={[styles.subtitle, { color: textSec }]}>
            {t("customizeExperience")}
          </Text>
        </Animated.View>

        {/* ── Language indicator pill ── */}
        <Animated.View entering={FadeInDown.duration(400).delay(80)} style={styles.langPillRow}>
          <View style={[styles.langPill, { backgroundColor: isDarkMode ? "rgba(99,102,241,0.15)" : "#ede9fe", borderColor: "#6366f1" }]}>
            <Ionicons name="globe-outline" size={14} color="#6366f1" />
            <Text style={styles.langPillText}>{languageName}</Text>
            <TouchableOpacity onPress={() => router.push("/language-settings" as any)}>
              <Text style={styles.langPillChange}>{t("changeLanguage").split(" ")[0]}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Setting items ── */}
        <View style={styles.settingsContainer}>
          {settingOptions.map((option, idx) => (
            <Animated.View
              key={option.id}
              entering={FadeInDown.duration(350).delay(120 + idx * 55)}
            >
              <TouchableOpacity
                style={[
                  styles.settingItem,
                  { backgroundColor: surfaceBg, borderColor: borderCol },
                ]}
                onPress={() => handleOptionPress(option)}
                activeOpacity={option.toggle ? 1 : 0.72}
              >
                {/* Left: icon + text */}
                <View style={styles.settingLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: option.accentColor + "1a" }]}>
                    <Ionicons name={option.icon} size={22} color={option.accentColor} />
                  </View>
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: textMain }]}>
                      {option.title}
                    </Text>
                    <Text style={[styles.settingDescription, { color: textSec }]} numberOfLines={1}>
                      {option.description}
                    </Text>
                  </View>
                </View>

                {/* Right: toggle or chevron */}
                {option.toggle ? (
                  <Switch
                    value={option.value}
                    onValueChange={option.onToggle}
                    disabled={option.id === "notifications" && notifLoading}
                    thumbColor={option.value ? option.accentColor : colors.textSecondary}
                    trackColor={{ false: borderCol, true: option.accentColor + "55" }}
                  />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={textSec} />
                )}
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        {/* ── Theme indicator ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(550)}>
          <LinearGradient
            colors={isDarkMode ? ["#1e1b4b", "#1e293b"] : ["#f0f4ff", "#e8eeff"]}
            style={[styles.themeIndicator, { borderColor: isDarkMode ? "#3730a3" : "#c7d2fe" }]}
          >
            <Text style={[styles.indicatorLabel, { color: textSec }]}>
              {t("currentTheme") ?? "Current Theme:"}
            </Text>
            <Text style={[styles.indicatorValue, { color: isDarkMode ? "#818cf8" : "#4f46e5" }]}>
              {isDarkMode
                ? (t("themeDark") ?? "🌙 Dark")
                : (t("themeLight") ?? "☀️ Light")}
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* ── Go Back button ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(620)} style={styles.backButtonWrap}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: surfaceBg, borderColor: borderCol }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={textMain} />
            <Text style={[styles.backButtonText, { color: textMain }]}>
              {t("goBack") ?? "Go Back"}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  headerText:      { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  title:           { fontSize: 28, fontWeight: "800", marginBottom: 4 },
  subtitle:        { fontSize: 14, fontWeight: "500" },

  langPillRow:     { paddingHorizontal: 20, marginBottom: 4, marginTop: 8 },
  langPill:        { flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  langPillText:    { color: "#6366f1", fontSize: 13, fontWeight: "700" },
  langPillChange:  { color: "#6366f1", fontSize: 12, fontWeight: "600", textDecorationLine: "underline" },

  settingsContainer: { paddingHorizontal: 20, marginVertical: 16, gap: 10 },
  settingItem:     {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  settingLeft:     { flexDirection: "row", alignItems: "center", flex: 1 },
  iconContainer:   {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  settingText:     { flex: 1 },
  settingTitle:    { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  settingDescription: { fontSize: 12, fontWeight: "500" },

  themeIndicator:  {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  indicatorLabel:  { fontSize: 14, fontWeight: "600" },
  indicatorValue:  { fontSize: 15, fontWeight: "800" },

  backButtonWrap:  { paddingHorizontal: 20 },
  backButton:      {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  backButtonText:  { fontSize: 15, fontWeight: "700" },
});
