// Discover's server-side protection is unchanged by Stage 2.1: Class 3–5 are
// refused with 403 NOT_AVAILABLE_FOR_CLASS before any quota is touched, and
// every other class is not blocked by that gate.

jest.mock("firebase-admin", () => {
  const base = require("./helpers/mockFirebaseAdmin").mockAdminModule;
  return {
    ...base,
    // The bearer token is just the uid in these tests.
    auth: () => ({ ...base.auth(), verifyIdToken: async (token: string) => ({ uid: token }) }),
  };
});

// Nothing in these tests may reach the network: an older-class request passes
// the gate and would otherwise go on to Google Search and Gemini.
jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn().mockRejectedValue(new Error("no network in tests")) },
}));
jest.mock("../gemini", () => ({
  callGeminiText: jest.fn().mockRejectedValue(new Error("no network in tests")),
  parseJsonFromResponse: jest.fn(),
}));

jest.mock("../redish", () => ({
  getRedis: () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  }),
  RK: {
    discoverQuery: (h: string) => `discover:q:${h}`,
    discoverUsage: (u: string, d: string) => `discover:u:${u}:${d}`,
  },
  TTL: { discoverQuery: 60 },
  todayIST: () => "2099-01-01",
  ttlUntilMidnightIST: () => 60,
}));

import { fakeDb } from "./helpers/mockFirebaseAdmin";
import { discoverSearch } from "../discover";

function makeRes() {
  const res: any = { status: jest.fn(), json: jest.fn(), send: jest.fn(), set: jest.fn() };
  res.status.mockImplementation(() => res);
  res.json.mockImplementation(() => res);
  return res;
}

const request = (uid: string) => ({
  method: "POST",
  headers: { authorization: `Bearer ${uid}` },
  body: { query: "engineering" },
});

beforeEach(() => fakeDb.reset());

describe("discoverSearch class gate", () => {
  test.each(["3", "4", "5"])("a Class %s student gets 403 NOT_AVAILABLE_FOR_CLASS", async (cls) => {
    fakeDb.seed("students/kid", { class: cls });
    const res = makeRes();
    await (discoverSearch as any)(request("kid"), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Discover isn't available for your class yet.",
      code: "NOT_AVAILABLE_FOR_CLASS",
    });
  });

  test("a Class 3 student's request is refused before any usage is recorded", async () => {
    fakeDb.seed("students/kid", { class: "3" });
    await (discoverSearch as any)(request("kid"), makeRes());
    expect(fakeDb.peek("discoverUsage/kid")).toBeUndefined();
  });

  test.each(["6", "8", "12"])("a Class %s student is not blocked by the class gate", async (cls) => {
    fakeDb.seed("students/older", { class: cls });
    const res = makeRes();
    await (discoverSearch as any)(request("older"), res);
    const blocked = res.json.mock.calls.some(([body]: [any]) => body?.code === "NOT_AVAILABLE_FOR_CLASS");
    expect(blocked).toBe(false);
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  test("a student with no class on record is not blocked by the class gate either", async () => {
    fakeDb.seed("students/noclass", {});
    const res = makeRes();
    await (discoverSearch as any)(request("noclass"), res);
    const blocked = res.json.mock.calls.some(([body]: [any]) => body?.code === "NOT_AVAILABLE_FOR_CLASS");
    expect(blocked).toBe(false);
  });

  test("an unauthenticated request is still 401", async () => {
    const res = makeRes();
    await (discoverSearch as any)({ method: "POST", headers: {}, body: { query: "x" } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
