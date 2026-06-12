import { useRef, useState } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Flashcard } from "@/lib/aiGuru/types";

interface Props {
  flashcards: Flashcard[];
}

export default function FlashcardDeck({ flashcards }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped]       = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;

  const frontInterp = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backInterp  = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });

  const handleFlip = () => {
    Animated.spring(flipAnim, {
      toValue: flipped ? 0 : 1,
      friction: 8,
      useNativeDriver: true,
    }).start();
    setFlipped((f) => !f);
  };

  const goNext = () => {
    if (currentIdx >= flashcards.length - 1) return;
    setFlipped(false);
    flipAnim.setValue(0);
    setCurrentIdx((i) => i + 1);
  };

  const goPrev = () => {
    if (currentIdx <= 0) return;
    setFlipped(false);
    flipAnim.setValue(0);
    setCurrentIdx((i) => i - 1);
  };

  const card = flashcards[currentIdx];
  if (!card) return null;

  return (
    <View style={S.wrap}>
      <Text style={S.hint}>Tap card to flip</Text>

      <TouchableOpacity activeOpacity={0.9} onPress={handleFlip} style={S.cardWrap}>
        {/* Front */}
        <Animated.View style={[S.card, S.front, { transform: [{ rotateY: frontInterp }] }]}>
          <Text style={S.sideLabel}>TERM</Text>
          <Text style={S.frontText}>{card.front}</Text>
        </Animated.View>
        {/* Back */}
        <Animated.View style={[S.card, S.back, { transform: [{ rotateY: backInterp }] }]}>
          <Text style={S.sideLabel}>MEANING</Text>
          <Text style={S.backText}>{card.back}</Text>
        </Animated.View>
      </TouchableOpacity>

      {/* Navigation */}
      <View style={S.navRow}>
        <TouchableOpacity style={[S.navBtn, currentIdx === 0 && S.navBtnDisabled]} onPress={goPrev} disabled={currentIdx === 0}>
          <Ionicons name="chevron-back" size={22} color={currentIdx === 0 ? "#374151" : "#6366f1"} />
        </TouchableOpacity>

        <View style={S.dots}>
          {flashcards.map((_, i) => (
            <View key={i} style={[S.dot, i === currentIdx && S.dotActive]} />
          ))}
        </View>

        <TouchableOpacity
          style={[S.navBtn, currentIdx === flashcards.length - 1 && S.navBtnDisabled]}
          onPress={goNext}
          disabled={currentIdx === flashcards.length - 1}
        >
          <Ionicons name="chevron-forward" size={22} color={currentIdx === flashcards.length - 1 ? "#374151" : "#6366f1"} />
        </TouchableOpacity>
      </View>

      <Text style={S.counter}>{currentIdx + 1} / {flashcards.length}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  wrap:     { alignItems: "center", gap: 16, paddingVertical: 8 },
  hint:     { color: "#475569", fontSize: 12 },
  cardWrap: { width: 300, height: 180 },
  card:     { position: "absolute", width: "100%", height: "100%", borderRadius: 20, padding: 24, backfaceVisibility: "hidden", alignItems: "center", justifyContent: "center" },
  front:    { backgroundColor: "#1e1b4b", borderWidth: 2, borderColor: "#4f46e5" },
  back:     { backgroundColor: "#0f2a1a", borderWidth: 2, borderColor: "#10b981" },
  sideLabel:{ position: "absolute", top: 14, left: 16, color: "#475569", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  frontText:{ color: "#a5b4fc", fontSize: 20, fontWeight: "900", textAlign: "center" },
  backText:  { color: "#6ee7b7", fontSize: 15, fontWeight: "600", textAlign: "center", lineHeight: 22 },
  navRow:   { flexDirection: "row", alignItems: "center", gap: 16 },
  navBtn:   { width: 44, height: 44, backgroundColor: "#1e293b", borderRadius: 12, justifyContent: "center", alignItems: "center" },
  navBtnDisabled: { opacity: 0.4 },
  dots:     { flexDirection: "row", gap: 4 },
  dot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: "#334155" },
  dotActive:{ backgroundColor: "#6366f1", width: 18 },
  counter:  { color: "#475569", fontSize: 12, fontWeight: "600" },
});
