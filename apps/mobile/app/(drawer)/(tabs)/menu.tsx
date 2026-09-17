// PATH: apps/mobile/app/(drawer)/(tabs)/menu.tsx
// Routing scaffold only — Expo Router's Tabs requires a screen file per
// tab, but the "Menu" tab never actually navigates here: its
// tabBarButton (see ../_layout.tsx) opens the existing Drawer instead and
// prevents default navigation. This screen is never shown to a user; it
// exists purely so the "menu" tab entry can be registered.
export default function MenuTabPlaceholder() {
  return null;
}
