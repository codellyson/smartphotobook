import {
  deleteProjectStorage,
  getCurrentProjectIdSync,
  loadProjectIndex,
  loadState,
  saveProjectIndex,
  saveState,
  setCurrentProjectId,
  type ProjectIndexEntry,
  type PlatformState,
} from "./platform";

export type { ProjectIndexEntry } from "./platform";

function uid(): string {
  return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function listProjects(): Promise<ProjectIndexEntry[]> {
  const list = await loadProjectIndex();
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createProject(name: string): Promise<ProjectIndexEntry> {
  const list = await loadProjectIndex();
  const entry: ProjectIndexEntry = {
    id: uid(),
    name: name.trim() || "Untitled album",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveProjectIndex([entry, ...list]);
  setCurrentProjectId(entry.id);
  return entry;
}

export async function renameProject(id: string, name: string): Promise<void> {
  const list = await loadProjectIndex();
  const next = list.map((e) => (e.id === id ? { ...e, name: name.trim() || e.name, updatedAt: Date.now() } : e));
  await saveProjectIndex(next);
}

export async function touchProject(id: string): Promise<void> {
  const list = await loadProjectIndex();
  const next = list.map((e) => (e.id === id ? { ...e, updatedAt: Date.now() } : e));
  await saveProjectIndex(next);
}

export async function deleteProject(id: string): Promise<void> {
  const list = await loadProjectIndex();
  await saveProjectIndex(list.filter((e) => e.id !== id));
  await deleteProjectStorage(id);
  if (getCurrentProjectIdSync() === id) setCurrentProjectId(null);
}

export async function duplicateProject(id: string): Promise<ProjectIndexEntry | null> {
  const list = await loadProjectIndex();
  const src = list.find((e) => e.id === id);
  if (!src) return null;
  const data = await loadState(id);
  const copy: ProjectIndexEntry = {
    id: uid(),
    name: `${src.name} (copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveProjectIndex([copy, ...list]);
  if (data) {
    saveState(copy.id, data as PlatformState);
  }
  return copy;
}
