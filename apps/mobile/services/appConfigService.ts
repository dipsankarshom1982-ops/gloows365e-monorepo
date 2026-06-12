import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";

export interface AppModule {
  id: string;
  name: string;
  icon: string;
  order: number;
  isEnabled: boolean;
  requiredPlan?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  emoji: string;
  monthlyPrice: number;
  annualPrice: number;
  annualMonthly: number;
  features: string[];
  gradient: [string, string];
  highlight: boolean;
  isActive: boolean;
  order: number;
  module?: string;  // "aiGuru" | "seekho" | "discover" — filters plans by product area
}

export async function getAppModules(): Promise<AppModule[]> {
  const q = query(
    collection(db, "appModules"),
    where("isEnabled", "==", true),
    orderBy("order", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppModule));
}

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const q = query(
    collection(db, "subscriptionPlans"),
    where("isActive", "==", true),
    orderBy("order", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SubscriptionPlan));
}
