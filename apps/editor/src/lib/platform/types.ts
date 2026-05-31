import type { Photo } from "../data";

export type PlatformState = {
  spreads?: unknown;
  photos?: unknown;
  active?: number;
  view?: string;
  [k: string]: unknown;
};

export type ProjectIndexEntry = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type Capabilities = {
  localPhotos: boolean;
  persistentPhotos: boolean;
  nativeExport: boolean;
};

export type ExportPayload = {
  jpegs: Uint8Array[];
  /** spread (two-page) width in mm */
  spreadWidthMm: number;
  spreadHeightMm: number;
  bleedMm: number;
  /** suggested filename (without path) */
  defaultName?: string;
};

export type ExportResult =
  | { kind: "pdf"; path: string }
  | { kind: "jpegs"; files: number }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

/** Shape implemented by both `./web` and `./desktop`. The build picks one. */
export interface PlatformAPI {
  readonly isDesktop: boolean;
  readonly capabilities: Capabilities;
  loadStateSync(projectId: string): PlatformState | null;
  loadState(projectId: string): Promise<PlatformState | null>;
  saveState(projectId: string, data: PlatformState): void;
  loadProjectIndex(): Promise<ProjectIndexEntry[]>;
  saveProjectIndex(entries: ProjectIndexEntry[]): Promise<void>;
  deleteProjectStorage(projectId: string): Promise<void>;
  getCurrentProjectIdSync(): string | null;
  setCurrentProjectId(id: string | null): void;
  migrateLegacyStateIfNeeded(): Promise<ProjectIndexEntry | null>;
  importPhotos(projectId: string): Promise<Photo[]>;
  exportAlbum(payload?: ExportPayload): Promise<ExportResult>;
}

// Storage keys + paths used by both impls (web reads localStorage keys, desktop
// reads files; the desktop file path equivalents live alongside).
export const STATE_KEY_PREFIX = "smartphotobook_state_v2";
export const LEGACY_STATE_KEY = "smartphotobook_state_v2";
export const PROJECTS_KEY = "smartphotobook_projects_v1";
export const CURRENT_KEY = "smartphotobook_current_project";
export const PROJECTS_FILE = "projects.json";

export function stateKey(projectId: string): string {
  return `${STATE_KEY_PREFIX}:${projectId}`;
}
export function projectFile(id: string): string {
  return `projects/${id}/album.json`;
}
