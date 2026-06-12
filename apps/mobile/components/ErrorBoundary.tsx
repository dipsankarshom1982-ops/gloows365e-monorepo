// PATH: components/ErrorBoundary.tsx
// Wraps the entire app — catches React render errors and logs to Firestore
// Shows a friendly recovery screen instead of a blank crash

import { Component, ReactNode } from "react";
import {
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { logCrash } from "@/services/crashReporter";

interface Props  { children: ReactNode; screen?: string; }
interface State  { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    logCrash("render_error", error, this.props.screen, {
      componentStack: info.componentStack?.slice(0, 1000),
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={S.container}>
          <Text style={S.emoji}>😵</Text>
          <Text style={S.title}>Something went wrong</Text>
          <Text style={S.message}>
            {this.state.error?.message ?? "An unexpected error occurred"}
          </Text>
          <TouchableOpacity
            style={S.btn}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={S.btnText}>Try Again</Text>
          </TouchableOpacity>
          <Text style={S.note}>This error has been reported automatically.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center", padding: 32 },
  emoji:     { fontSize: 52, marginBottom: 16 },
  title:     { color: "#f1f5f9", fontSize: 22, fontWeight: "800", marginBottom: 8, textAlign: "center" },
  message:   { color: "#94a3b8", fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  btn:       { backgroundColor: "#6366f1", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  btnText:   { color: "#fff", fontSize: 16, fontWeight: "700" },
  note:      { color: "#475569", fontSize: 11, marginTop: 16, textAlign: "center" },
});
