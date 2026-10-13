import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import type { GuruMessage } from "@/lib/skillguru/types";

interface Props {
  message: GuruMessage;
  onReplayAudio?: (msg: GuruMessage) => void;
  isDarkMode?: boolean;
  // Accent color — follows the active skill category in SkillGuru
  // instead of a hardcoded indigo identity.
  color?: string;
}

export default function ChatBubble({ message, onReplayAudio, isDarkMode = true, color = "#6366f1" }: Props) {
  const isGuru = message.role === "guru";

  const guroBg     = isDarkMode ? `${color}26` : `${color}14`;
  const studentBg  = isDarkMode ? "#1e293b" : "#f1f5f9";
  const guruText   = isDarkMode ? "#f1f5f9" : "#1e1b4b";
  const studentText= isDarkMode ? "#cbd5e1" : "#1e293b";
  const dotBg      = isDarkMode ? `${color}26` : `${color}14`;

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify()}
      style={[S.row, isGuru ? S.rowLeft : S.rowRight]}
    >
      {isGuru && (
        <View style={[S.avatarDot, { backgroundColor: dotBg }]}>
          <Text style={{ fontSize: 12 }}>🧑‍🏫</Text>
        </View>
      )}

      <View style={[S.bubble, { backgroundColor: isGuru ? guroBg : studentBg }, isGuru ? S.bubbleGuruRadius : S.bubbleStudentRadius]}>
        <Text style={[S.text, { color: isGuru ? guruText : studentText }]}>
          {message.text}
        </Text>

        {isGuru && message.audioBase64 && onReplayAudio && (
          <TouchableOpacity
            style={S.replayBtn}
            onPress={() => onReplayAudio(message)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="volume-medium-outline" size={16} color={color} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  row:               { flexDirection: "row", marginVertical: 5, paddingHorizontal: 12, maxWidth: "90%", alignItems: "flex-end", gap: 8 },
  rowLeft:           { alignSelf: "flex-start" },
  rowRight:          { alignSelf: "flex-end", flexDirection: "row-reverse" },
  avatarDot:         { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  bubble:            { borderRadius: 18, padding: 12, flexShrink: 1 },
  bubbleGuruRadius:  { borderBottomLeftRadius: 4 },
  bubbleStudentRadius:{ borderBottomRightRadius: 4 },
  text:              { fontSize: 14, lineHeight: 22 },
  replayBtn:         { marginTop: 8, alignSelf: "flex-start" },
});
