// PATH: functions/src/__tests__/adminManagement.test.ts
//
// Offline unit test for functions/src/adminManagement.ts's
// getUserSubscriptionHistory — specifically the bug found during the
// Payment Management investigation and fixed alongside it: the "main"
// (AI Guru) branch queried `subscriptions` by a `userId` field that
// doesn't exist on that collection (subscriptions/{uid} is keyed by uid,
// with no userId field ever written into the doc) — so that branch could
// never have returned a result before the fix. Same mocking approach as
// the rest of this test suite (real module, mocked firebase-admin via
// FakeFirestore, no emulator). Uses v2 onCall's .run(request) testing hook
// (single CallableRequest object), not v1's .run(data, context).

jest.mock("firebase-admin", () => require("./helpers/mockFirebaseAdmin").mockAdminModule);

import { fakeDb } from "./helpers/mockFirebaseAdmin";

const ADMIN_REQUEST = (data: unknown) => ({ data, auth: { uid: "admin_1", token: { admin: true } } });

beforeEach(() => {
  fakeDb.reset();
});

describe("getUserSubscriptionHistory", () => {
  test("rejects a non-admin caller", async () => {
    const { getUserSubscriptionHistory } = require("../adminManagement");
    await expect(
      getUserSubscriptionHistory.run({ data: { userId: "student_1" }, auth: { uid: "student_1", token: {} } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("finds the main (AI Guru) subscription by direct doc lookup, not a broken userId query", async () => {
    fakeDb.seed("subscriptions/student_1", { status: "active", planId: "pro", cycle: "monthly", razorpayOrderId: "order_1" });
    const { getUserSubscriptionHistory } = require("../adminManagement");
    const result = await getUserSubscriptionHistory.run(ADMIN_REQUEST({ userId: "student_1" }));
    expect(result.subscriptions).toHaveLength(1);
    expect(result.subscriptions[0]).toMatchObject({ id: "student_1", source: "main", status: "active", planId: "pro" });
  });

  test("finds the seekho subscription (already worked before the fix — regression guard)", async () => {
    fakeDb.seed("seekho_subscriptions/student_1", { userId: "student_1", plan: "pro", classAccess: [6, 7, 8] });
    const { getUserSubscriptionHistory } = require("../adminManagement");
    const result = await getUserSubscriptionHistory.run(ADMIN_REQUEST({ userId: "student_1" }));
    expect(result.subscriptions).toHaveLength(1);
    expect(result.subscriptions[0]).toMatchObject({ id: "student_1", source: "seekho", plan: "pro" });
  });

  test("returns both when a user has an active subscription in each flow", async () => {
    fakeDb.seed("subscriptions/student_1", { status: "active", planId: "pro" });
    fakeDb.seed("seekho_subscriptions/student_1", { userId: "student_1", plan: "plus" });
    const { getUserSubscriptionHistory } = require("../adminManagement");
    const result = await getUserSubscriptionHistory.run(ADMIN_REQUEST({ userId: "student_1" }));
    expect(result.subscriptions.map((s: any) => s.source).sort()).toEqual(["main", "seekho"]);
  });

  test("returns an empty list for a user with no subscription in either flow", async () => {
    const { getUserSubscriptionHistory } = require("../adminManagement");
    const result = await getUserSubscriptionHistory.run(ADMIN_REQUEST({ userId: "student_nobody" }));
    expect(result.subscriptions).toEqual([]);
  });

  test("rejects a missing userId", async () => {
    const { getUserSubscriptionHistory } = require("../adminManagement");
    await expect(
      getUserSubscriptionHistory.run(ADMIN_REQUEST({}))
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });
});

describe("adminUpdateStudentProfile — class validation (Class 3–12)", () => {
  test("rejects a non-admin caller", async () => {
    const { adminUpdateStudentProfile } = require("../adminManagement");
    await expect(
      adminUpdateStudentProfile.run({ data: { uid: "s1", class: 5 }, auth: { uid: "s1", token: {} } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test.each([3, 4, 5, 6, 7, 8, 9, 10])("accepts Class %i and stores it as a string", async (cls) => {
    fakeDb.seed("students/s1", { name: "Test", class: "8" });
    const { adminUpdateStudentProfile } = require("../adminManagement");
    await adminUpdateStudentProfile.run(ADMIN_REQUEST({ uid: "s1", class: cls }));
    expect(fakeDb.peek("students/s1")).toMatchObject({ name: "Test", class: String(cls) });
  });

  test.each([0, 1, 2, 13, "abc", 6.5])("rejects unsupported class %p", async (cls) => {
    fakeDb.seed("students/s1", { class: "8" });
    const { adminUpdateStudentProfile } = require("../adminManagement");
    await expect(
      adminUpdateStudentProfile.run(ADMIN_REQUEST({ uid: "s1", class: cls }))
    ).rejects.toMatchObject({ code: "invalid-argument", message: "class must be one of 3–12." });
    expect(fakeDb.peek("students/s1")?.class).toBe("8");
  });

  test("stream rules follow the class: Class 11 accepts one, Class 3 rejects one", async () => {
    fakeDb.seed("students/s1", { class: "8" });
    const { adminUpdateStudentProfile } = require("../adminManagement");
    await expect(
      adminUpdateStudentProfile.run(ADMIN_REQUEST({ uid: "s1", class: 11 }))
    ).resolves.toEqual({ success: true });
    await expect(
      adminUpdateStudentProfile.run(ADMIN_REQUEST({ uid: "s1", class: 11, stream: "Science" }))
    ).resolves.toEqual({ success: true });
    await expect(
      adminUpdateStudentProfile.run(ADMIN_REQUEST({ uid: "s1", class: 3, stream: "Science" }))
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      adminUpdateStudentProfile.run(ADMIN_REQUEST({ uid: "s1", class: 3, stream: null }))
    ).resolves.toEqual({ success: true });
    expect(fakeDb.peek("students/s1")).toMatchObject({ class: "3", stream: null });
  });

  test("a stored Class 4 student can be given a stream-less update without being rejected", async () => {
    fakeDb.seed("students/s1", { class: "4", stream: null });
    const { adminUpdateStudentProfile } = require("../adminManagement");
    await expect(
      adminUpdateStudentProfile.run(ADMIN_REQUEST({ uid: "s1", stream: null }))
    ).resolves.toEqual({ success: true });
  });
});
