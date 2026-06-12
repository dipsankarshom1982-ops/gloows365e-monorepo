// PATH: app/restart-education/_layout.tsx

import { Stack } from "expo-router";

export default function RestartEducationLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="home" />
      <Stack.Screen name="ai-advisor" />
      <Stack.Screen name="pathways" />
      <Stack.Screen name="opportunities" />
      <Stack.Screen name="success-stories" />
      <Stack.Screen name="guidance" />
    </Stack>
  );
}
