import type { Analysis } from "./types.ts";

export interface StoredCase {
  id: string;
  title: string;
  source: string;
  analysis: Analysis;
  createdAt: string;
  build: "pgplan_v0.2.0" | "pgplan_v0.2.1" | "pgplan_v0.3.0" | "pgplan_v0.4.0" | "pgplan_v0.5.0";
}

const DB_NAME = "pgplan-insight";
const STORE = "execution-plans";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open local plan history."));
  });
}

async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    run(tx.objectStore(STORE), resolve, reject);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

export function saveCase(item: StoredCase): Promise<void> {
  return transaction("readwrite", (store, resolve, reject) => { const request = store.put(item); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
}

export function listCases(): Promise<StoredCase[]> {
  return transaction("readonly", (store, resolve, reject) => { const request = store.getAll(); request.onsuccess = () => resolve((request.result as StoredCase[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt))); request.onerror = () => reject(request.error); });
}

export function clearCases(): Promise<void> {
  return transaction("readwrite", (store, resolve, reject) => { const request = store.clear(); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
}
