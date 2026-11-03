"use client";

import { sessionV2Schema, type SessionV2 } from "@/domain/v2";

const DB_NAME = "evolving-resume-v2";
const STORE = "sessions";
const FILES = "files";
const CURRENT = "current";

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
) {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const request = action(tx.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function loadSession(): Promise<SessionV2 | null> {
  const raw = await transact<unknown>(STORE, "readonly", (store) => store.get(CURRENT));
  if (!raw) return null;
  const parsed = sessionV2Schema.safeParse(raw);
  if (!parsed.success) {
    await deleteSession();
    return null;
  }
  return parsed.data;
}

export async function saveSession(session: SessionV2) {
  const value = sessionV2Schema.parse({
    ...session,
    updatedAt: new Date().toISOString()
  });
  await transact<IDBValidKey>(STORE, "readwrite", (store) => store.put(value, CURRENT));
}

export async function saveOriginalFile(file: File) {
  await transact<IDBValidKey>(FILES, "readwrite", (store) => store.put(file, CURRENT));
}

export async function loadOriginalFile(): Promise<File | null> {
  return (await transact<File | undefined>(FILES, "readonly", (store) => store.get(CURRENT))) ?? null;
}

export async function deleteSession() {
  const db = await openDb();
  try {
    await Promise.all(
      [STORE, FILES].map(
        (name) =>
          new Promise<void>((resolve, reject) => {
            const tx = db.transaction(name, "readwrite");
            const request = tx.objectStore(name).delete(CURRENT);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          })
      )
    );
  } finally {
    db.close();
  }
}
