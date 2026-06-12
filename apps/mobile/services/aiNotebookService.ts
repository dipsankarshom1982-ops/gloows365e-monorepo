// PATH: services/aiNotebookService.ts
// My AI Notebook — save any AI Q&A as a notebook entry.
// Firestore: aiNotebook/{uid}/entries/{entryId}

import { auth, db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

export interface NotebookEntry {
  id: string;
  question: string;
  answer: string;
  mode: string;           // "doubt" | "explain" | "notes" | "exam" | "summarize" | "tip" | "language"
  modeLabel: string;      // display label e.g. "Explain a Concept"
  subject?: string;
  pinned: boolean;
  createdAt: any;
}

export async function saveToNotebook(entry: {
  question: string;
  answer: string;
  mode: string;
  modeLabel: string;
  subject?: string;
}): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in");

  const ref = await addDoc(
    collection(db, "aiNotebook", uid, "entries"),
    {
      ...entry,
      pinned: false,
      createdAt: serverTimestamp(),
    }
  );
  return ref.id;
}

export async function getNotebookEntries(): Promise<NotebookEntry[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];

  const snap = await getDocs(
    query(
      collection(db, "aiNotebook", uid, "entries"),
      orderBy("createdAt", "desc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as NotebookEntry));
}

export async function deleteNotebookEntry(entryId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await deleteDoc(doc(db, "aiNotebook", uid, "entries", entryId));
}

export async function togglePin(entryId: string, currentPinned: boolean): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await updateDoc(doc(db, "aiNotebook", uid, "entries", entryId), {
    pinned: !currentPinned,
  });
}
