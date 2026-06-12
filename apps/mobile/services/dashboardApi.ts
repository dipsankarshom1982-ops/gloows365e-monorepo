import { auth } from "@/lib/firebase";

const BASE_URL = (process.env.EXPO_PUBLIC_CLOUD_FUNCTION_URL as string) ?? "";

async function getToken(): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("User not authenticated");
  return token;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardPayload {
  studentName: string;
  classLevel:  string | number;
  board:       string;
  interests:   string[];
  language:    string;
  learnScore:  number;
}

export interface DashboardActivity {
  id:         string;
  activityId: string;
  amount:     number;
  type:       "CREDIT" | "DEBIT" | string;
  createdAt:  number;
}

export interface DashboardStudyPlanItem {
  courseId:        string;
  subject:         string;
  chapterTitle:    string;
  chapterNumber:   number;
  percentComplete: number;
}

export interface DashboardRevisionItem {
  conceptTag: string;
  docId:      string;
}

export interface DashboardRecentLesson {
  lessonId:  string;
  subject:   string;
  chapter:   string;
  status:    string;
  createdAt: number;
  emoji:     string;
}

export interface DashboardUsageToday {
  lessonsGenerated: number;
  followUps:        number;
  vidyaGuruChats:   number;
}

export interface DashboardResponse {
  aiInsight:        string;
  revisionDueCount: number;
  revisionItems:    DashboardRevisionItem[];
  recentActivities: DashboardActivity[];
  studyPlan:        DashboardStudyPlanItem[];
  recentLessons:    DashboardRecentLesson[];
  usageToday:       DashboardUsageToday;
}

// ─── API call ─────────────────────────────────────────────────────────────────

export async function fetchPersonalizedDashboard(
  payload: DashboardPayload
): Promise<DashboardResponse> {
  const token = await getToken();
  const resp = await fetch(`${BASE_URL}/getPersonalizedDashboard`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();
  if (!resp.ok) {
    const err: any = new Error(data.error ?? "Dashboard fetch failed");
    err.code   = data.code   ?? "UNKNOWN";
    err.status = resp.status;
    throw err;
  }
  return data as DashboardResponse;
}
