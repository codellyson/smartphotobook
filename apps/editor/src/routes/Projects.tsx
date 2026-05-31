import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createProject,
  deleteProject,
  duplicateProject,
  listProjects,
  renameProject,
  type ProjectIndexEntry,
} from "@/lib/projects";
import { Platform } from "@/lib/platform";

function formatWhen(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString();
}

export default function Projects() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ProjectIndexEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    document.title = "Albums — SmartPhotobook";
  }, []);

  const refresh = useCallback(async () => {
    const list = await listProjects();
    setItems(list);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await Platform.migrateLegacyStateIfNeeded();
      } catch {
        /* non-fatal */
      }
      const list = await listProjects();
      if (!alive) return;
      setItems(list);
      setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  const openProject = (id: string) => {
    Platform.setCurrentProjectId(id);
    navigate("/designer");
  };

  const onCreate = async () => {
    const name = newName.trim() || "Untitled album";
    const entry = await createProject(name);
    setNewName("");
    setCreating(false);
    Platform.setCurrentProjectId(entry.id);
    navigate("/designer");
  };

  const onRenameConfirm = async (id: string) => {
    const name = renameValue.trim();
    if (name) await renameProject(id, name);
    setRenamingId(null);
    setRenameValue("");
    refresh();
  };

  const onDuplicate = async (id: string) => {
    await duplicateProject(id);
    refresh();
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this album? Photos and spreads cannot be recovered.")) return;
    await deleteProject(id);
    refresh();
  };

  if (!ready) return <div className="route-loading">Loading albums…</div>;

  return (
    <main className="projects">
      <header className="projects-head">
        <div>
          <p className="projects-eyebrow">Your albums</p>
          <h1>{items.length === 0 ? "Start your first album" : "Pick up where you left off"}</h1>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          New album
        </button>
      </header>

      {creating && (
        <div className="projects-create-row">
          <input
            autoFocus
            value={newName}
            placeholder="Album name (e.g. Sarah & James — June 2025)"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCreate();
              if (e.key === "Escape") { setCreating(false); setNewName(""); }
            }}
          />
          <button className="btn primary" onClick={onCreate}>Create</button>
          <button className="btn ghost" onClick={() => { setCreating(false); setNewName(""); }}>Cancel</button>
        </div>
      )}

      {items.length === 0 && !creating && (
        <div className="projects-empty">
          <p>No albums yet. Create one to start designing.</p>
        </div>
      )}

      <div className="projects-grid">
        {items.map((it) => (
          <article key={it.id} className="project-card">
            <button
              className="project-card-thumb"
              onClick={() => openProject(it.id)}
              aria-label={`Open ${it.name}`}
            >
              <div className="project-card-mark">{(it.name[0] || "·").toUpperCase()}</div>
            </button>
            <div className="project-card-body">
              {renamingId === it.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onRenameConfirm(it.id);
                    if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); }
                  }}
                  onBlur={() => onRenameConfirm(it.id)}
                />
              ) : (
                <button
                  className="project-card-name"
                  onClick={() => { setRenamingId(it.id); setRenameValue(it.name); }}
                  title="Rename"
                >
                  {it.name}
                </button>
              )}
              <div className="project-card-meta">Last edited {formatWhen(it.updatedAt)}</div>
              <div className="project-card-actions">
                <button onClick={() => openProject(it.id)}>Open</button>
                <button onClick={() => onDuplicate(it.id)}>Duplicate</button>
                <button onClick={() => onDelete(it.id)} className="danger">Delete</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
