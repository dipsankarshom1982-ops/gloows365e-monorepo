// PATH: app/vcoins/claim-gift.tsx
// Superseded — Surprise Gift claims now flow through the same prizeClaims
// system as VidyaStar Starboard prizes (see apps/admin/src/pages/
// VCoinLeaderboard.tsx's assign-gift flow and PrizeDeliveries.tsx for
// fulfillment), so the claim itself happens on the "My Prizes" screen
// alongside every other prize instead of this dedicated one. Kept as a
// redirect rather than deleted so any existing deep link (push
// notification, old app build's cached route) still lands somewhere
// useful instead of a dead screen.

import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";

export default function ClaimGiftRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/my-prizes");
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" color="#D97706" />
    </View>
  );
}
