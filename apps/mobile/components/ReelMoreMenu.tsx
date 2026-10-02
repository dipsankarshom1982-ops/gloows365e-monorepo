// PATH: apps/mobile/components/ReelMoreMenu.tsx
//
// The "⋮ More" trigger on a Skill Battle reel — today its only action is
// "Report Video", but it's built as an actual small menu (not a shortcut
// straight to the report modal) so a future second action doesn't need a
// UI reshuffle. No new dependency added for this — RN has no built-in
// action sheet, and the app doesn't have one either (checked: no
// existing "⋮"/ActionSheet/BottomSheet-style menu component anywhere in
// the codebase), so this follows the SAME lightweight transparent-Modal-
// backdrop pattern the reels screens already use for their Comments
// sheet, just sized to its content instead of full height.

import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface ReelMoreMenuProps {
  colors: any;
  onReport: () => void;
  // Hides the whole "⋮" trigger, not just the Report row — used for
  // content this menu has literally nothing to offer for yet (e.g. the
  // viewer's own video — see reels.tsx's isReportable logic).
  visible?: boolean;
}

export default function ReelMoreMenu({ colors, onReport, visible = true }: ReelMoreMenuProps) {
  const [open, setOpen] = useState(false);
  if (!visible) return null;

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: `${colors.accent}20` }]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="More options"
        hitSlop={8}
      >
        <Text style={{ fontSize: 18, color: colors.text, fontWeight: "900" }}>⋮</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close menu">
          <View style={[styles.menu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setOpen(false); onReport(); }}
              accessibilityRole="button"
              accessibilityLabel="Report Video"
              hitSlop={4}
            >
              <Text style={{ fontSize: 16 }}>🚩</Text>
              <Text style={[styles.menuItemText, { color: colors.text }]}>Report Video</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-start", alignItems: "flex-end", paddingTop: 100, paddingRight: 16 },
  menu: { borderRadius: 14, borderWidth: 1, minWidth: 180, paddingVertical: 6, elevation: 8 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14, minHeight: 48 },
  menuItemText: { fontSize: 14, fontWeight: "700" },
});
