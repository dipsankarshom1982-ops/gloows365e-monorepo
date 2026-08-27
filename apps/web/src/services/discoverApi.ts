// PATH: apps/web/src/services/discoverApi.ts
// Mirror of apps/mobile/services/discoverApi.ts — Cloud Function calls for
// the Discover AI career-search feature.

import { auth } from "@/lib/firebase";
import { CLOUD_FUNCTION_URL } from "@/lib/aiGuru/constants";
import type {
  DiscoverSearchPayload,
  DiscoverSearchResponse,
  DiscoverTrendingResponse,
} from "@/lib/discover/types";

async function getToken(): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("User not authenticated");
  return token;
}

async function request<T>(path: string, options: { method: "POST" | "GET"; body?: object }): Promise<T> {
  const token = await getToken();
  const url = `${CLOUD_FUNCTION_URL}/${path}`;
  const resp = await fetch(url, {
    method: options.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const data = await resp.json();
  if (!resp.ok) {
    const err: any = new Error(data.error ?? "Discover request failed");
    err.code = data.code ?? "UNKNOWN";
    err.status = resp.status;
    if (data.creditBalance   !== undefined) err.creditBalance   = data.creditBalance;
    if (data.creditsRequired !== undefined) err.creditsRequired = data.creditsRequired;
    throw err;
  }
  return data as T;
}

export async function searchDiscover(payload: DiscoverSearchPayload): Promise<DiscoverSearchResponse> {
  return request<DiscoverSearchResponse>("discoverSearch", { method: "POST", body: payload });
}

export async function getTrending(): Promise<DiscoverTrendingResponse> {
  return request<DiscoverTrendingResponse>("discoverTrending", { method: "GET" });
}
