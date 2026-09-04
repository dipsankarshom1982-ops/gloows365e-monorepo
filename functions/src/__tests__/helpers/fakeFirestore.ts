// PATH: functions/src/__tests__/helpers/fakeFirestore.ts
//
// In-memory Firestore fake used to unit-test real Cloud Functions business
// logic (refunds.ts, aiGuruSubscription.ts, etc.) WITHOUT a live emulator.
// This machine's Java is 17; firebase-tools now requires 21+ for the
// Firestore/Auth emulators, so the emulator-backed suite
// (rules-tests/firestore.rules.test.ts) is written and ready but parked
// until a JDK upgrade — see that file's header. This fake unblocks
// function-logic coverage in the meantime by mocking `firebase-admin`
// itself (see mockFirebaseAdmin.ts), never by touching the real rules or
// business logic.
//
// Supports exactly the Admin SDK surface the tested code actually calls:
// doc/collection/get/set/update, single-field equality + limit queries,
// subcollections, and transactions. Transaction writes are applied
// synchronously (matching real Firestore's tx.set/tx.update, which buffer
// but don't await) — only tx.get is async, also matching the real SDK.
// This is NOT a general-purpose Firestore emulator: no security rules, no
// real query planning, no true multi-transaction concurrency control.

export const SERVER_TIMESTAMP = Symbol("SERVER_TIMESTAMP");

interface Increment {
  __increment: number;
}

export function isIncrement(v: unknown): v is Increment {
  return !!v && typeof v === "object" && "__increment" in (v as Record<string, unknown>);
}

export class FakeTimestamp {
  constructor(public millis: number) {}
  toMillis() {
    return this.millis;
  }
  toDate() {
    return new Date(this.millis);
  }
  static now() {
    return new FakeTimestamp(Date.now());
  }
  static fromMillis(ms: number) {
    return new FakeTimestamp(ms);
  }
  static fromDate(d: Date) {
    return new FakeTimestamp(d.getTime());
  }
}

type DocData = Record<string, unknown>;

interface FakeDocRef {
  id: string;
  path: string;
  get(): Promise<{ exists: boolean; id: string; ref: FakeDocRef; data: () => DocData | undefined }>;
  set(data: DocData, opts?: { merge?: boolean }): Promise<void>;
  update(data: DocData): Promise<void>;
  collection(sub: string): FakeCollectionRef;
}

interface FakeCollectionRef {
  doc(id?: string): FakeDocRef;
  add(data: DocData): Promise<FakeDocRef>;
  where(field: string, op: "==", value: unknown): FakeQueryRef;
  orderBy(field: string, direction?: "asc" | "desc"): FakeQueryRef;
}

interface FakeQueryRef {
  where(field: string, op: "==", value: unknown): FakeQueryRef;
  orderBy(field: string, direction?: "asc" | "desc"): FakeQueryRef;
  limit(n: number): FakeQueryRef;
  // Bounds apply against the field from the most recent orderBy() call —
  // same semantics as real Firestore. Accepts a raw value or a FakeTimestamp.
  startAfter(value: unknown): FakeQueryRef;
  startAt(value: unknown): FakeQueryRef;
  endAt(value: unknown): FakeQueryRef;
  get(): Promise<{ empty: boolean; size: number; docs: Array<{ id: string; data: () => DocData; ref: FakeDocRef }> }>;
}

// Extracts a comparable primitive from a stored field value — handles
// FakeTimestamp (via toMillis) alongside plain numbers/strings, matching
// what orderBy() on a real Firestore timestamp field needs to sort by.
function sortableValue(v: unknown): number | string {
  if (v && typeof (v as FakeTimestamp).toMillis === "function") return (v as FakeTimestamp).toMillis();
  if (typeof v === "number" || typeof v === "string") return v;
  return 0;
}

export class FakeFirestore {
  store = new Map<string, DocData>();

  // Applies FieldValue sentinels (serverTimestamp/increment) against
  // whatever was already stored at this path, same as the real SDK
  // resolves them at write time relative to the pre-write document.
  private resolveFieldValues(existing: DocData | undefined, data: DocData): DocData {
    const out: DocData = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === SERVER_TIMESTAMP) {
        out[k] = FakeTimestamp.now();
      } else if (isIncrement(v)) {
        const current = Number((existing?.[k] as number | undefined) ?? 0);
        out[k] = current + v.__increment;
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  private writeSync(path: string, data: DocData, merge: boolean) {
    const existing = this.store.get(path);
    const resolved = this.resolveFieldValues(existing, data);
    this.store.set(path, merge && existing ? { ...existing, ...resolved } : resolved);
  }

  private updateSync(path: string, data: DocData) {
    const existing = this.store.get(path);
    if (!existing) throw new Error(`FakeFirestore: update() on missing doc "${path}"`);
    const resolved = this.resolveFieldValues(existing, data);
    this.store.set(path, { ...existing, ...resolved });
  }

  private docRef(path: string): FakeDocRef {
    const self = this;
    const segs = path.split("/");
    const id = segs[segs.length - 1];
    return {
      id,
      path,
      async get() {
        const data = self.store.get(path);
        return { exists: data !== undefined, id, ref: self.docRef(path), data: () => (data ? { ...data } : undefined) };
      },
      async set(data, opts) {
        self.writeSync(path, data, !!opts?.merge);
      },
      async update(data) {
        self.updateSync(path, data);
      },
      collection(sub: string) {
        return self.collectionRef(`${path}/${sub}`);
      },
    };
  }

  private collectionRef(path: string): FakeCollectionRef {
    const self = this;
    return {
      doc(id?: string) {
        const docId = id ?? `auto_${Math.random().toString(36).slice(2)}`;
        return self.docRef(`${path}/${docId}`);
      },
      // add() = real Firestore's auto-id create shorthand — doc(<auto-id>).set(data)
      // then resolve with the new ref, matching the real Admin SDK's return shape.
      async add(data: DocData) {
        const ref = this.doc();
        await ref.set(data);
        return ref;
      },
      where(field, op, value) {
        return self.queryRef(path, [(d) => d[field] === value]);
      },
      orderBy(field, direction) {
        return self.queryRef(path, [], undefined, { field, direction: direction ?? "asc" });
      },
    };
  }

  private queryRef(
    path: string,
    filters: Array<(d: DocData) => boolean>,
    limitN?: number,
    order?: { field: string; direction: "asc" | "desc" },
    bounds?: { startAfter?: unknown; startAt?: unknown; endAt?: unknown }
  ): FakeQueryRef {
    const self = this;
    return {
      where(field, op, value) {
        return self.queryRef(path, [...filters, (d) => d[field] === value], limitN, order, bounds);
      },
      orderBy(field, direction) {
        return self.queryRef(path, filters, limitN, { field, direction: direction ?? "asc" }, bounds);
      },
      limit(n) {
        return self.queryRef(path, filters, n, order, bounds);
      },
      startAfter(value) {
        return self.queryRef(path, filters, limitN, order, { ...bounds, startAfter: value });
      },
      startAt(value) {
        return self.queryRef(path, filters, limitN, order, { ...bounds, startAt: value });
      },
      endAt(value) {
        return self.queryRef(path, filters, limitN, order, { ...bounds, endAt: value });
      },
      async get() {
        const prefix = `${path}/`;
        let docs = [...self.store.entries()]
          .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"))
          .filter(([, data]) => filters.every((f) => f(data)))
          .map(([p, data]) => {
            const id = p.slice(prefix.length);
            return { id, data: () => ({ ...data }), ref: self.docRef(p) };
          });
        if (order) {
          const { field, direction } = order;
          docs.sort((a, b) => {
            const av = sortableValue(a.data()[field]);
            const bv = sortableValue(b.data()[field]);
            const cmp = av < bv ? -1 : av > bv ? 1 : 0;
            return direction === "desc" ? -cmp : cmp;
          });
          if (bounds?.startAfter !== undefined) {
            const boundV = sortableValue(bounds.startAfter);
            docs = docs.filter((d) => {
              const v = sortableValue(d.data()[field]);
              return direction === "desc" ? v < boundV : v > boundV;
            });
          }
          if (bounds?.startAt !== undefined) {
            const boundV = sortableValue(bounds.startAt);
            docs = docs.filter((d) => {
              const v = sortableValue(d.data()[field]);
              return direction === "desc" ? v <= boundV : v >= boundV;
            });
          }
          if (bounds?.endAt !== undefined) {
            const boundV = sortableValue(bounds.endAt);
            docs = docs.filter((d) => {
              const v = sortableValue(d.data()[field]);
              return direction === "desc" ? v >= boundV : v <= boundV;
            });
          }
        }
        if (limitN !== undefined) docs = docs.slice(0, limitN);
        return { empty: docs.length === 0, size: docs.length, docs };
      },
    };
  }

  doc(path: string): FakeDocRef {
    return this.docRef(path);
  }
  collection(path: string): FakeCollectionRef {
    return this.collectionRef(path);
  }

  async runTransaction<T>(fn: (tx: {
    get: (ref: FakeDocRef) => ReturnType<FakeDocRef["get"]>;
    set: (ref: FakeDocRef, data: DocData, opts?: { merge?: boolean }) => void;
    update: (ref: FakeDocRef, data: DocData) => void;
  }) => Promise<T>): Promise<T> {
    const self = this;
    const tx = {
      get: (ref: FakeDocRef) => self.docRef(ref.path).get(),
      set: (ref: FakeDocRef, data: DocData, opts?: { merge?: boolean }) => {
        self.writeSync(ref.path, data, !!opts?.merge);
      },
      update: (ref: FakeDocRef, data: DocData) => {
        self.updateSync(ref.path, data);
      },
    };
    return fn(tx);
  }

  reset() {
    this.store.clear();
  }

  /** Test convenience: seed a doc bypassing FieldValue resolution/merge semantics. */
  seed(path: string, data: DocData) {
    this.store.set(path, { ...data });
  }
  /** Test convenience: inspect the raw stored doc. */
  peek(path: string): DocData | undefined {
    const d = this.store.get(path);
    return d ? { ...d } : undefined;
  }
}
