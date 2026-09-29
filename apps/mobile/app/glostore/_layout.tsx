import { Stack } from "expo-router";
import { ENTRY_POINT_GATES } from "@gloows/shared-logic";
import { routeGateLayout } from "@/components/RouteGate";

export default function GloStoreLayout() {
  return <Stack screenOptions={{ headerShown: false }} screenLayout={routeGateLayout(ENTRY_POINT_GATES.glostore)} />;
}
