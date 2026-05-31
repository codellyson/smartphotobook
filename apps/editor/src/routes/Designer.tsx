import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App } from "@/components/app";
import { Platform, type ProjectIndexEntry } from "@/lib/platform";

export default function Designer() {
  const navigate = useNavigate();
  const [entry, setEntry] = useState<ProjectIndexEntry | null>(null);
  const [status, setStatus] = useState<"loading" | "missing" | "ready">("loading");

  useEffect(() => {
    document.title = "Designer — SmartPhotobook";
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const id = Platform.getCurrentProjectIdSync();
      if (!id) {
        if (alive) setStatus("missing");
        return;
      }
      const list = await Platform.loadProjectIndex();
      const found = list.find((e) => e.id === id) ?? null;
      if (!alive) return;
      if (!found) setStatus("missing");
      else {
        setEntry(found);
        setStatus("ready");
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (status === "missing") navigate("/projects", { replace: true });
  }, [status, navigate]);

  if (status !== "ready" || !entry) {
    return <div className="route-loading">Loading album…</div>;
  }
  return (
    <App
      projectId={entry.id}
      projectName={entry.name}
      onBackToProjects={() => {
        Platform.setCurrentProjectId(null);
        navigate("/projects");
      }}
    />
  );
}
