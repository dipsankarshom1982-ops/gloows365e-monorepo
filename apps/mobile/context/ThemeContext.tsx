import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  colors: {
    background: string;
    text: string;
    textSecondary: string;
    accent: string;
    card: string;
    border: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const lightColors = {
  background: "#ffffff",
  text: "#1f2937",
  textSecondary: "#6b7280",
  accent: "#3b82f6",
  card: "#f3f4f6",
  border: "#e5e7eb",
};

export const darkColors = {
  background: "#0f172a",
  text: "#e2e8f0",
  textSecondary: "#94a3b8",
  accent: "#38bdf8",
  card: "#1e293b",
  border: "rgba(56, 189, 248, 0.15)",
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Load saved theme preference
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem("@theme_mode");
        if (saved !== null) {
          setIsDarkMode(saved === "dark");
        }
      } catch (error) {
        console.log("Error loading theme:", error);
      }
    };

    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    try {
      await AsyncStorage.setItem("@theme_mode", newMode ? "dark" : "light");
    } catch (error) {
      console.log("Error saving theme:", error);
    }
  };

  const colors = isDarkMode ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
