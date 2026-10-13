// PATH: services/dataRightsService.ts
//
// DPDP Act 2023 — typed bindings for the exportMyData / eraseMyAccount
// callables (functions/src/dataRights.ts). Same httpsCallable(functions, ...)
// pattern as services/adService.ts, services/joinContest.ts, etc.

import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

export interface MyDataExport {
  exportedBy: string;
  generatedAt: string;
  profile: Record<string, unknown>;
  activity: Record<string, unknown[]>;
}

const exportMyDataCF = httpsCallable<Record<string, never>, MyDataExport>(
  functions,
  "exportMyData"
);

const eraseMyAccountCF = httpsCallable<Record<string, never>, { success: boolean }>(
  functions,
  "eraseMyAccount"
);

export async function exportMyData(): Promise<MyDataExport> {
  const res = await exportMyDataCF({});
  return res.data;
}

export async function eraseMyAccount(): Promise<void> {
  await eraseMyAccountCF({});
}
