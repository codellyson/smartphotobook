import type { Photo } from "../data";
import { baseName, probe, toBase64 } from "./helpers";
import {
  PROJECTS_FILE,
  projectFile,
  type Capabilities,
  type ExportPayload,
  type ExportResult,
  type PlatformAPI,
  type PlatformState,
  type ProjectIndexEntry,
} from "./types";

// Tauri-injected globals (live on window.__TAURI__ when withGlobalTauri: true).
type TauriFs = {
  readTextFile: (path: string, opts?: unknown) => Promise<string>;
  writeTextFile: (path: string, data: string, opts?: unknown) => Promise<void>;
  mkdir: (path: string, opts?: unknown) => Promise<void>;
  remove: (path: string, opts?: unknown) => Promise<void>;
  exists?: (path: string, opts?: unknown) => Promise<boolean>;
  BaseDirectory: { AppData: number; [k: string]: number };
};
type TauriDialog = {
  open: (opts?: unknown) => Promise<string | string[] | null>;
  save: (opts?: unknown) => Promise<string | null>;
};
type TauriCore = {
  invoke: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  convertFileSrc: (path: string) => string;
};
type TauriShim = { fs: TauriFs; dialog: TauriDialog; core: TauriCore };

/** Lazy accessor — `window.__TAURI__` is injected before page scripts run, but
 *  this module may still be loaded in a Node context for SSR/build, where it's
 *  undefined. Callers that depend on it should already be inside a runtime-only
 *  code path (e.g. an effect or a click handler). */
function tauri(): TauriShim {
  if (typeof window === "undefined") {
    throw new Error("Tauri APIs unavailable outside a browser context");
  }
  const w = window as unknown as { __TAURI__?: TauriShim };
  if (!w.__TAURI__) {
    throw new Error("window.__TAURI__ missing — was the desktop build alias used in a web context?");
  }
  return w.__TAURI__;
}

export const isDesktop = true;

export const capabilities: Capabilities = {
  localPhotos: true,
  persistentPhotos: true, // file paths persist in album.json across reloads
  nativeExport: true,
};

/** Desktop hydration is async; sync callers must accept null and await loadState. */
export function loadStateSync(_projectId: string): PlatformState | null {
  return null;
}

export async function loadState(projectId: string): Promise<PlatformState | null> {
  const { fs, core } = tauri();
  try {
    const txt = await fs.readTextFile(projectFile(projectId), { baseDir: fs.BaseDirectory.AppData });
    const data = JSON.parse(txt) as PlatformState;
    if (Array.isArray(data.photos)) {
      const { inferPhotoSource } = await import("../data");
      data.photos = (data.photos as Photo[]).map((p) => {
        const source = inferPhotoSource(p);
        const src = source.kind === "path" ? core.convertFileSrc(source.absolute) : (p.src ?? "");
        return { ...p, source, src };
      });
    }
    return data;
  } catch {
    return null;
  }
}

const _saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function saveState(projectId: string, data: PlatformState): void {
  const { fs } = tauri();
  // Strip transient blob/asset URLs — desktop re-resolves src on load via convertFileSrc.
  const out = {
    ...data,
    photos: Array.isArray(data.photos)
      ? (data.photos as Photo[]).map((p) => {
          const { src: _src, ...rest } = p;
          return rest;
        })
      : data.photos,
  };
  const prev = _saveTimers.get(projectId);
  if (prev) clearTimeout(prev);
  _saveTimers.set(
    projectId,
    setTimeout(() => {
      fs.mkdir(`projects/${projectId}`, { baseDir: fs.BaseDirectory.AppData, recursive: true }).catch(() => {});
      fs.writeTextFile(projectFile(projectId), JSON.stringify(out), {
        baseDir: fs.BaseDirectory.AppData,
      }).catch(() => {});
    }, 250),
  );
}

export async function loadProjectIndex(): Promise<ProjectIndexEntry[]> {
  const { fs } = tauri();
  try {
    const txt = await fs.readTextFile(PROJECTS_FILE, { baseDir: fs.BaseDirectory.AppData });
    return JSON.parse(txt) as ProjectIndexEntry[];
  } catch {
    return [];
  }
}

export async function saveProjectIndex(entries: ProjectIndexEntry[]): Promise<void> {
  const { fs } = tauri();
  try {
    await fs.mkdir("", { baseDir: fs.BaseDirectory.AppData, recursive: true });
    await fs.writeTextFile(PROJECTS_FILE, JSON.stringify(entries), { baseDir: fs.BaseDirectory.AppData });
  } catch {
    /* ignore */
  }
}

export async function deleteProjectStorage(projectId: string): Promise<void> {
  const { fs } = tauri();
  try {
    await fs.remove(`projects/${projectId}`, { baseDir: fs.BaseDirectory.AppData, recursive: true });
  } catch {
    /* ignore */
  }
}

export function getCurrentProjectIdSync(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("smartphotobook_current_project");
  } catch {
    return null;
  }
}

export function setCurrentProjectId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id === null) window.localStorage.removeItem("smartphotobook_current_project");
    else window.localStorage.setItem("smartphotobook_current_project", id);
  } catch {
    /* ignore */
  }
}

/**
 * Pre-Phase-3 desktop builds saved a single `AppData/album.json`. Lift it into
 * the new per-project layout if present.
 */
export async function migrateLegacyStateIfNeeded(): Promise<ProjectIndexEntry | null> {
  const index = await loadProjectIndex();
  if (index.length > 0) return null;
  const { fs } = tauri();
  try {
    const txt = await fs.readTextFile("album.json", { baseDir: fs.BaseDirectory.AppData });
    const id = "p" + Date.now().toString(36);
    const entry: ProjectIndexEntry = {
      id,
      name: "Untitled album",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await fs.mkdir(`projects/${id}`, { baseDir: fs.BaseDirectory.AppData, recursive: true });
    await fs.writeTextFile(projectFile(id), txt, { baseDir: fs.BaseDirectory.AppData });
    await saveProjectIndex([entry]);
    try {
      await fs.remove("album.json", { baseDir: fs.BaseDirectory.AppData });
    } catch {
      /* keep — manual cleanup is fine */
    }
    return entry;
  } catch {
    return null;
  }
}

export async function importPhotos(_projectId: string): Promise<Photo[]> {
  const { dialog, core } = tauri();
  try {
    const sel = await dialog.open({
      multiple: true,
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "heic", "tif", "tiff"] }],
    });
    if (!sel) return [];
    const paths = Array.isArray(sel) ? sel : [sel];
    return Promise.all(
      paths.map((p) =>
        probe(core.convertFileSrc(p), baseName(p), { kind: "path", absolute: p }),
      ),
    );
  } catch {
    return [];
  }
}

export async function exportAlbum(payload?: ExportPayload): Promise<ExportResult> {
  if (!payload) {
    if (typeof window !== "undefined") window.print();
    return { kind: "cancelled" };
  }
  const { dialog, core } = tauri();
  try {
    const path = await dialog.save({
      defaultPath: payload.defaultName || "album.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!path) return { kind: "cancelled" };
    const pagesB64 = payload.jpegs.map(toBase64);
    await core.invoke("export_album_pdf", {
      path,
      pages: pagesB64,
      pageWidthMm: payload.spreadWidthMm,
      pageHeightMm: payload.spreadHeightMm,
      bleedMm: payload.bleedMm,
    });
    return { kind: "pdf", path };
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
