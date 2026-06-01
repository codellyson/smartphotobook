import { parse as parseExif } from "exifr";
import type { Photo } from "../data";
import { deletePhotosForProject, savePhoto } from "../photo-store";
import { probe } from "./helpers";

async function readTakenAt(file: File): Promise<number | undefined> {
  try {
    const meta = (await parseExif(file, ["DateTimeOriginal", "CreateDate"])) as
      | { DateTimeOriginal?: Date; CreateDate?: Date }
      | undefined;
    const d = meta?.DateTimeOriginal ?? meta?.CreateDate;
    if (d instanceof Date && !isNaN(d.getTime())) return d.getTime();
  } catch {
    /* not EXIF-bearing (PNG, HEIC w/o sidecar, broken JPEG) — fine */
  }
  return undefined;
}
import {
  CURRENT_KEY,
  LEGACY_STATE_KEY,
  PROJECTS_KEY,
  stateKey,
  type Capabilities,
  type ExportPayload,
  type ExportResult,
  type PlatformAPI,
  type PlatformState,
  type ProjectIndexEntry,
} from "./types";

export const isDesktop = false;

export const capabilities: Capabilities = {
  localPhotos: true,
  persistentPhotos: false, // web blobs are session-scoped (IndexedDB rehydrates them)
  nativeExport: false,
};

export function loadStateSync(projectId: string): PlatformState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(stateKey(projectId));
    return raw ? (JSON.parse(raw) as PlatformState) : null;
  } catch {
    return null;
  }
}

export async function loadState(projectId: string): Promise<PlatformState | null> {
  return loadStateSync(projectId);
}

export function saveState(projectId: string, data: PlatformState): void {
  if (typeof window === "undefined") return;
  // Web: photos live in IndexedDB (see photo-store); don't bloat localStorage.
  const { photos: _photos, ...rest } = data;
  try {
    window.localStorage.setItem(stateKey(projectId), JSON.stringify(rest));
  } catch {
    /* quota — ignore */
  }
}

export async function loadProjectIndex(): Promise<ProjectIndexEntry[]> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PROJECTS_KEY);
    return raw ? (JSON.parse(raw) as ProjectIndexEntry[]) : [];
  } catch {
    return [];
  }
}

export async function saveProjectIndex(entries: ProjectIndexEntry[]): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

export async function deleteProjectStorage(projectId: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(stateKey(projectId));
  } catch {
    /* ignore */
  }
  await deletePhotosForProject(projectId);
}

export function getCurrentProjectIdSync(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

export function setCurrentProjectId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id === null) window.localStorage.removeItem(CURRENT_KEY);
    else window.localStorage.setItem(CURRENT_KEY, id);
  } catch {
    /* ignore */
  }
}

/**
 * If the user has pre-Phase-3 state but no project index yet, lift it into a
 * "Untitled album" project so they don't lose their work. Idempotent.
 */
export async function migrateLegacyStateIfNeeded(): Promise<ProjectIndexEntry | null> {
  if (typeof window === "undefined") return null;
  const index = await loadProjectIndex();
  if (index.length > 0) return null;
  let legacy: string | null = null;
  try {
    legacy = window.localStorage.getItem(LEGACY_STATE_KEY);
  } catch {
    /* ignore */
  }
  if (!legacy) return null;
  const id = "p" + Date.now().toString(36);
  const entry: ProjectIndexEntry = {
    id,
    name: "Untitled album",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(stateKey(id), legacy);
    window.localStorage.removeItem(LEGACY_STATE_KEY);
  } catch {
    /* ignore */
  }
  await saveProjectIndex([entry]);
  // Re-parent any orphan photos sitting in IndexedDB from the previous session.
  try {
    const { adoptOrphanedPhotos } = await import("../photo-store");
    await adoptOrphanedPhotos(id);
  } catch {
    /* ignore */
  }
  return entry;
}

async function importOne(projectId: string, file: File): Promise<Photo> {
  const src = URL.createObjectURL(file);
  const cap = file.name.replace(/\.[^.]+$/, "");
  const [photo, takenAt] = await Promise.all([
    probe(src, cap, { kind: "blob" }),
    readTakenAt(file),
  ]);
  if (takenAt !== undefined) photo.takenAt = takenAt;
  try {
    await savePhoto(projectId, photo, file);
  } catch {
    /* IndexedDB unavailable — photo still works this session */
  }
  return photo;
}

export function importPhotos(projectId: string): Promise<Photo[]> {
  if (typeof document === "undefined") return Promise.resolve([]);
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.multiple = true;
    inp.style.display = "none";
    inp.onchange = () => {
      const files = Array.from(inp.files || []);
      Promise.all(files.map((f) => importOne(projectId, f))).then((next) => {
        resolve(next);
        inp.remove();
      });
    };
    document.body.appendChild(inp);
    inp.click();
  });
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function exportAlbum(payload?: ExportPayload): Promise<ExportResult> {
  if (!payload) {
    if (typeof window !== "undefined") window.print();
    return { kind: "cancelled" };
  }
  if (typeof window === "undefined") return { kind: "error", message: "no document available" };
  try {
    payload.jpegs.forEach((bytes, i) => {
      const blob = new Blob([bytes as BlobPart], { type: "image/jpeg" });
      const idx = String(i + 1).padStart(3, "0");
      downloadBlob(blob, `spread-${idx}.jpg`);
    });
    return { kind: "jpegs", files: payload.jpegs.length };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export const Platform: PlatformAPI = {
  isDesktop,
  capabilities,
  loadStateSync,
  loadState,
  saveState,
  loadProjectIndex,
  saveProjectIndex,
  deleteProjectStorage,
  getCurrentProjectIdSync,
  setCurrentProjectId,
  migrateLegacyStateIfNeeded,
  importPhotos,
  exportAlbum,
};
