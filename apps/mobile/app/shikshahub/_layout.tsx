// PATH: apps/mobile/app/shikshahub/_layout.tsx
// Mirrors apps/mobile/app/glostore/_layout.tsx — plain Stack, header hidden
// since [uid].tsx draws its own back button.
import { Stack } from "expo-router";

export default function ShikshaHubLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
