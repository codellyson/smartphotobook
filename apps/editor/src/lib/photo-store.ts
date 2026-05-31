import type { Orient, Photo } from "./data";

const DB_NAME = "smartphotobook";
const DB_VERSION = 1;
const STORE = "photos";

type StoredRecord = {
  id: string;
  blob: Blob;
  cap: string;
  orient: Orient;
  addedAt: number;
  projectId?: string; // undefined = pre-Phase-3 photo, migrated to the legacy project on demand
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbPromise;
}

function txStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDb().then((db) => db.transaction(STORE, mode).objectStore(STORE));
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function savePhoto(projectId: string, photo: Photo, blob: Blob): Promise<void> {
  const store = await txStore("readwrite");
  const record: StoredRecord = {
    id: photo.id,
    blob,
    cap: photo.cap,
    orient: photo.orient,
    addedAt: Date.now(),
    projectId,
  };
  await req(store.put(record));
}

export async function loadAllPhotos(projectId: string): Promise<Photo[]> {
  try {
    const store = await txStore("readonly");
    const records = (await req(store.getAll())) as StoredRecord[];
    return records
      .filter((r) => r.projectId === projectId)
      .sort((a, b) => b.addedAt - a.addedAt)
      .map((r) => ({
        id: r.id,
        cap: r.cap,
        orient: r.orient,
        source: { kind: "blob" as const },
        src: URL.createObjectURL(r.blob),
        imported: true,
      }));
  } catch {
    return [];
  }
}

/** Re-stamp every photo missing a projectId. Used by the one-time legacy migration. */
export async function adoptOrphanedPhotos(projectId: string): Promise<number> {
  try {
    const store = await txStore("readwrite");
    const records = (await req(store.getAll())) as StoredRecord[];
    const orphans = records.filter((r) => !r.projectId);
    for (const r of orphans) {
      r.projectId = projectId;
      await req(store.put(r));
    }
    return orphans.length;
  } catch {
    return 0;
  }
}

export async function deletePhoto(id: string): Promise<void> {
  const store = await txStore("readwrite");
  await req(store.delete(id));
}

export async function deletePhotosForProject(projectId: string): Promise<void> {
  try {
    const store = await txStore("readwrite");
    const records = (await req(store.getAll())) as StoredRecord[];
    for (const r of records) {
      if (r.projectId === projectId) await req(store.delete(r.id));
    }
  } catch {
    /* ignore */
  }
}
