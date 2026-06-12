import { useTheme } from "@/context/ThemeContext";
import type { SeekhoPracticeQuestion } from "@/lib/seekho/types";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface Props {
  question: SeekhoPracticeQuestion;
  onEasy: () => void;
  onHard: () => void;
}

export default function RevisionCard({ question, onEasy, onHard }: Props) {
  const { colors } = useTheme();
  const [flipped, setFlipped] = useState(false);
  const rotate = useSharedValue(0);

  const flip = () => {
    rotate.value = withSpring(flipped ? 0 : 1, { damping: 14, stiffness: 120 });
    setFlipped((f) => !f);
  };

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${interpolate(rotate.value, [0, 1], [0, 180])}deg` },
    ],
    backfaceVisibility: "hidden",
    position: "absolute",
    width: "100%",
    height: "100%",
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${interpolate(rotate.value, [0, 1], [180, 360])}deg` },
    ],
    backfaceVisibility: "hidden",
    position: "absolute",
    width: "100%",
    height: "100%",
  }));

  const correctAnswer = question.options[question.correctIndex];

  return (
    <View style={S.wrapper}>
      <TouchableOpacity activeOpacity={0.9} onPress={flip} style={S.cardContainer}>
        {/* Front — question */}
        <Animated.View style={[S.card, { backgroundColor: colors.card }, frontStyle]}>
          <Text style={[S.hint, { color: colors.textSecondary }]}>Tap to reveal answer</Text>
          <Text style={[S.conceptTag, { color: "#a5b4fc" }]}>{question.conceptTag}</Text>
          <Text style={[S.question, { color: colors.text }]}>{question.question}</Text>
        </Animated.View>

        {/* Back — answer + explanation */}
        <Animated.View style={[S.card, S.cardBack, backStyle]}>
          <Text style={S.answerLabel}>Answer</Text>
          <Text style={S.answerText}>{correctAnswer}</Text>
          <View style={[S.divider, { backgroundColor: colors.border }]} />
          <Text style={[S.explanation, { color: colors.textSecondary }]}>
            {question.explanation}
          </Text>
        </Animated.View>
      </TouchableOpacity>

      {/* Rating buttons — only shown after flip */}
      {flipped && (
        <View style={S.buttons}>
          <TouchableOpacity style={[S.btn, S.hardBtn]} onPress={onHard}>
            <Text style={S.btnText}>Hard 😓</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.btn, S.easyBtn]} onPress={onEasy}>
            <Text style={S.btnText}>Easy 😊</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  wrapper: { alignItems: "center", paddingHorizontal: 16 },
  cardContainer: { width: "100%", height: 220 },
  card: {
    borderRadius: 20,
    padding: 24,
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  cardBack: { backgroundColor: "#1e293b" },
  hint: { fontSize: 11, fontWeight: "600", textAlign: "center", marginBottom: 12 },
  conceptTag: { fontSize: 11, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  question: { fontSize: 16, fontWeight: "700", lineHeight: 24, textAlign: "center" },
  answerLabel: { color: "#10b981", fontSize: 11, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  answerText: { color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  divider: { height: 1, marginVertical: 8 },
  explanation: { fontSize: 12, fontWeight: "500", lineHeight: 18, textAlign: "center" },
  buttons: { flexDirection: "row", gap: 12, marginTop: 20 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  hardBtn: { backgroundColor: "#dc2626" },
  easyBtn: { backgroundColor: "#059669" },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
