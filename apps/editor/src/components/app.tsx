
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { cellsFor, defaultMeta, initialSpreads, photos as seedPhotos, sid, templates } from "@/lib/data";
import type { Cell, Frame, Photo, ProjectMeta, Spread } from "@/lib/data";
import { Platform } from "@/lib/platform";
import { loadAllPhotos } from "@/lib/photo-store";
import { CropModal, Filmstrip, SpreadView, TemplatePanel, Tray, type DesignerHandlers } from "./designer";
import { Library } from "./library";
import { Proofing } from "./proofing";
import { Settings } from "./settings";
import { Icon, useToast } from "./icons";
import { renderAlbum, trimSizeToMm } from "@/lib/render";
import {
  createShare,
  markRevoked,
  recentShares,
  rememberShare,
  revokeShare,
  type RecentShare,
} from "@/lib/proofing";

type View = "designer" | "library" | "proof" | "settings";

// -------- undo/redo store -------------------------------------------------

type AlbumState = {
  spreads: Spread[];
  favSpreads: Set<string>;
  meta: ProjectMeta;
};

type HistoryStore = {
  present: AlbumState;
  past: AlbumState[];
  future: AlbumState[];
  lastTag: string | null;
};

type Action =
  | { type: "commit"; fn: (s: AlbumState) => AlbumState; tag?: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "replace"; state: AlbumState };

const MAX_HISTORY = 50;

function albumReducer(store: HistoryStore, action: Action): HistoryStore {
  switch (action.type) {
    case "commit": {
      const next = action.fn(store.present);
      if (next === store.present) return store;
      if (action.tag && action.tag === store.lastTag) {
        return { ...store, present: next, future: [] };
      }
      const past = [...store.past, store.present];
      if (past.length > MAX_HISTORY) past.shift();
      return { present: next, past, future: [], lastTag: action.tag ?? null };
    }
    case "undo": {
      if (store.past.length === 0) return store;
      const newPast = store.past.slice(0, -1);
      const last = store.past[store.past.length - 1];
      return { present: last, past: newPast, future: [store.present, ...store.future], lastTag: null };
    }
    case "redo": {
      if (store.future.length === 0) return store;
      const [first, ...rest] = store.future;
      return { present: first, past: [...store.past, store.present], future: rest, lastTag: null };
    }
    case "replace":
      return { present: action.state, past: [], future: [], lastTag: null };
  }
}

function TopBar({
  view,
  setView,
  onAutofill,
  projectName,
  meta,
  onBackToProjects,
  onShare,
  sharing,
}: {
  view: View;
  setView: (v: View) => void;
  onAutofill: () => void;
  projectName: string;
  meta: ProjectMeta;
  onBackToProjects: () => void;
  onShare: () => void;
  sharing: boolean;
}) {
  const tab = (id: View, label: string, icon: string) =>
    React.createElement(
      "button",
      {
        className: view === id ? "on" : "",
        onClick: () => setView(id),
        "aria-label": label,
        "aria-pressed": view === id,
      },
      React.createElement(Icon, { n: icon }),
      label,
    );
  return React.createElement(
    "div",
    { className: "topbar" },
    React.createElement(
      "button",
      {
        className: "brand",
        onClick: onBackToProjects,
        title: "Back to all albums",
        "aria-label": "Back to all albums",
      },
      React.createElement(Icon, { n: "book" }),
    ),
    React.createElement(
      "div",
      { className: "proj-meta" },
      React.createElement("div", { className: "t" }, projectName || "Untitled album"),
      React.createElement(
        "div",
        { className: "s" },
        [meta.title, meta.date].filter(Boolean).join(" · ") || "Add a title and date",
      ),
    ),
    React.createElement(
      "div",
      { className: "viewswitch" },
      tab("designer", "Designer", "designer"),
      tab("library", "Library", "library"),
      tab("proof", "Preview", "proof"),
      tab("settings", "Settings", "sliders"),
    ),
    React.createElement(
      "div",
      { className: "right" },
      React.createElement("button", { className: "btn", onClick: onAutofill }, React.createElement(Icon, { n: "wand" }), "Auto-fill"),
      React.createElement(
        "button",
        { className: "btn primary", onClick: onShare, disabled: sharing },
        React.createElement(Icon, { n: "share" }),
        sharing ? "Sharing…" : "Send preview link",
      ),
    ),
  );
}

const ACCENT = "#c98a5e";
const LAYOUT = { gap: "10px", margin: "26px" };
const THUMB = "132px";

export function App({
  projectId,
  projectName,
  onBackToProjects,
}: {
  projectId: string;
  projectName: string;
  onBackToProjects: () => void;
}) {
  const saved = useRef(Platform.loadStateSync(projectId));
  const ready = useRef(!Platform.isDesktop); // desktop must finish async hydrate before we save
  const [view, setView] = useState<View>(() => (saved.current?.view as View) || "designer");

  const initialAlbum: AlbumState = useMemo(
    () => ({
      spreads:
        (saved.current?.spreads as Spread[] | undefined) ?? JSON.parse(JSON.stringify(initialSpreads)),
      favSpreads: new Set<string>((saved.current?.favSpreads as string[] | undefined) ?? []),
      meta: { ...defaultMeta, ...((saved.current?.meta as Partial<ProjectMeta> | undefined) ?? {}) },
    }),
    // initialAlbum is read once by useReducer's init lambda; deps intentionally empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [store, dispatch] = useReducer(albumReducer, undefined, (): HistoryStore => ({
    present: initialAlbum,
    past: [],
    future: [],
    lastTag: null,
  }));
  const { spreads, favSpreads, meta } = store.present;

  const setSpreads = useCallback(
    (updater: Spread[] | ((prev: Spread[]) => Spread[]), tag?: string) => {
      dispatch({
        type: "commit",
        tag,
        fn: (s) => ({
          ...s,
          spreads: typeof updater === "function" ? (updater as (p: Spread[]) => Spread[])(s.spreads) : updater,
        }),
      });
    },
    [],
  );

  const setFavSpreads = useCallback(
    (updater: Set<string> | ((prev: Set<string>) => Set<string>), tag?: string) => {
      dispatch({
        type: "commit",
        tag,
        fn: (s) => ({
          ...s,
          favSpreads:
            typeof updater === "function"
              ? (updater as (p: Set<string>) => Set<string>)(s.favSpreads)
              : updater,
        }),
      });
    },
    [],
  );

  const setMeta = useCallback((next: ProjectMeta, tag?: string) => {
    dispatch({ type: "commit", tag, fn: (s) => ({ ...s, meta: next }) });
  }, []);

  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  const [photos, setPhotos] = useState<Photo[]>(() => {
    const favs = (saved.current?.favs as string[]) || [];
    return seedPhotos.map((p) => Object.assign({}, p, { fav: favs.includes(p.id) }));
  });
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [selOverlay, setSelOverlay] = useState<string | null>(null);
  const [allSel, setAllSel] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"story" | "fav">("story");
  const [sel, setSel] = useState<Set<string>>(() => new Set());
  const [crop, setCrop] = useState<{ idx: number } | null>(null);
  const [toast, showToast] = useToast();
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareModal, setShareModal] = useState<
    | null
    | {
        latest?: { url: string; revokeToken: string; copied: boolean };
        recents: RecentShare[];
      }
  >(null);
  const [zoom, setZoom] = useState(1);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--accent", ACCENT);
    r.setProperty("--accent-soft", `color-mix(in srgb, ${ACCENT} 16%, transparent)`);
    r.setProperty("--gap", LAYOUT.gap);
    r.setProperty("--margin", LAYOUT.margin);
    r.setProperty("--thumb", THUMB);
  }, []);

  useEffect(() => {
    if (Platform.isDesktop) return; // desktop hydrates photos via album.json (loadState)
    let alive = true;
    loadAllPhotos(projectId).then((stored) => {
      if (!alive || stored.length === 0) return;
      const favs = (saved.current?.favs as string[] | undefined) || [];
      const hydrated = stored.map((p) => ({ ...p, fav: favs.includes(p.id) }));
      setPhotos((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...hydrated.filter((p) => !seen.has(p.id)), ...prev];
      });
    });
    return () => { alive = false; };
  }, [projectId]);

  useEffect(() => {
    if (!ready.current) return;
    Platform.saveState(projectId, {
      view,
      spreads,
      photos,
      meta,
      favs: photos.filter((p) => p.fav).map((p) => p.id),
      favSpreads: [...favSpreads],
    });
  }, [projectId, view, spreads, photos, meta, favSpreads]);

  useEffect(() => {
    if (!Platform.isDesktop) return;
    let alive = true;
    Platform.loadState(projectId).then((data) => {
      if (!alive) return;
      if (data) {
        const nextState: AlbumState = {
          spreads: Array.isArray(data.spreads) ? (data.spreads as Spread[]) : spreads,
          favSpreads: Array.isArray(data.favSpreads) ? new Set(data.favSpreads as string[]) : favSpreads,
          meta: { ...defaultMeta, ...((data.meta as Partial<ProjectMeta> | undefined) ?? {}) },
        };
        dispatch({ type: "replace", state: nextState });
        if (typeof data.view === "string") setView(data.view as View);
        if (Array.isArray(data.photos)) setPhotos(data.photos as Photo[]);
      }
      ready.current = true;
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      const isTyping =
        !!tgt &&
        (tgt.tagName === "INPUT" ||
          tgt.tagName === "TEXTAREA" ||
          tgt.tagName === "SELECT" ||
          tgt.isContentEditable);
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        if (isTyping) return;
        e.preventDefault();
        undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        if (isTyping) return;
        e.preventDefault();
        redo();
      } else if (k === "d") {
        if (isTyping) return;
        e.preventDefault();
        handlersRef.current?.onDuplicateActive?.();
      } else if (k === "0") {
        if (isTyping) return;
        e.preventDefault();
        setZoom(1);
      } else if (k === "=" || k === "+") {
        if (isTyping) return;
        e.preventDefault();
        setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)));
      } else if (k === "-") {
        if (isTyping) return;
        e.preventDefault();
        setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      // Trackpad pinch fires wheel with ctrlKey + small deltaY in deltaMode 0.
      const factor = Math.exp(-e.deltaY * 0.01);
      setZoom((z) => Math.min(3, Math.max(0.4, +(z * factor).toFixed(3))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const photosById = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, p])), [photos]);
  const usedIds = useMemo(() => {
    const s = new Set<string>();
    spreads.forEach((sp) => {
      sp.cells.forEach((c) => { if (c.photoId) s.add(c.photoId); });
      (sp.overlays || []).forEach((o) => { if (o.kind !== "text" && o.photoId) s.add(o.photoId); });
      const dp = sp.dice ? sp.dice.photoId : sp.dicePhotoId;
      if (dp) s.add(dp);
    });
    return s;
  }, [spreads]);

  const mutateCells = useCallback(
    (fn: (cells: Cell[]) => void, tag?: string) => {
      setSpreads(
        (prev) =>
          prev.map((sp, i) => {
            if (i !== active) return sp;
            const cells = sp.cells.map((c) => Object.assign({}, c));
            fn(cells);
            return Object.assign({}, sp, { cells });
          }),
        tag,
      );
    },
    [active, setSpreads],
  );

  const mutateSpread = useCallback(
    (fn: (sp: Spread) => Spread, tag?: string) => {
      setSpreads(
        (prev) => prev.map((sp, i) => (i === active ? fn(Object.assign({}, sp)) : sp)),
        tag,
      );
    },
    [active, setSpreads],
  );

  const uid = () => "ov" + Math.random().toString(36).slice(2, 8);

  const clearDiceOnActive = () =>
    setSpreads((prev) =>
      prev.map((sp, i) =>
        i === active && (sp.dice || sp.dicePhotoId)
          ? Object.assign({}, sp, { dice: undefined, dicePhotoId: undefined })
          : sp,
      ),
    );

  const diceActiveWith = (pid: string, rc?: { rows: number; cols: number } | null) => {
    if (!pid) return;
    let r = rc as { rows: number; cols: number } | null | undefined;
    if (!r) {
      const o = photosById[pid] && photosById[pid].orient;
      r =
        o === "L"
          ? { rows: 1, cols: 3 }
          : o === "P"
            ? { rows: 1, cols: 2 }
            : { rows: 2, cols: 2 };
    }
    setSpreads((prev) =>
      prev.map((sp, i) =>
        i === active
          ? Object.assign({}, sp, {
              dice: { photoId: pid, rows: r!.rows, cols: r!.cols },
              dicePhotoId: undefined,
            })
          : sp,
      ),
    );
  };

  // Forward-declare placeSequence so handlers can reference it.
  const placeSequence = (startSi: number, startCi: number, ids: string[]) => {
    let placed = 0;
    setSpreads((prev) => {
      const flat: Array<{ si: number; ci: number }> = [];
      prev.forEach((sp, si) => sp.cells.forEach((_, ci) => flat.push({ si, ci })));
      let start = flat.findIndex((f) => f.si === startSi && f.ci === startCi);
      if (start < 0) start = 0;
      const next = prev.map((sp) =>
        Object.assign({}, sp, { cells: sp.cells.map((c) => Object.assign({}, c)) }),
      );
      ids.forEach((id, k) => {
        const slot = flat[start + k];
        if (slot) {
          next[slot.si].cells[slot.ci] = { photoId: id, zoom: 1, ox: 50, oy: 50 };
          next[slot.si].dice = undefined;
          next[slot.si].dicePhotoId = undefined;
          placed++;
        }
      });
      return next;
    });
    showToast(`Placed ${placed} photo${placed > 1 ? "s" : ""}`);
  };

  const handlers: DesignerHandlers = {
    onSelect: (idx: number) => {
      setSelOverlay(null);
      setAllSel(false);
      setSelected((s) => (s === idx ? null : idx));
    },
    onStartDrag: () => {},
    onDropContent: (toIdx, payload) => {
      if (payload.photoIds != null) {
        placeSequence(active, toIdx, payload.photoIds);
        setSel(new Set());
      } else if (payload.photoId != null) {
        mutateCells((cells) => {
          cells[toIdx] = { photoId: payload.photoId!, zoom: 1, ox: 50, oy: 50 };
        });
        clearDiceOnActive();
        setSelected(toIdx);
      } else if (payload.fromCell != null && payload.fromCell !== toIdx) {
        mutateCells((cells) => {
          const a = cells[payload.fromCell!];
          cells[payload.fromCell!] = cells[toIdx];
          cells[toIdx] = a;
        });
        setSelected(toIdx);
      }
    },
    onRemove: (idx: number) => {
      mutateCells((cells) => {
        cells[idx] = { photoId: null, zoom: 1, ox: 50, oy: 50 };
      });
      setSelected(null);
    },
    onRecenter: (idx: number) =>
      mutateCells((cells) => {
        cells[idx] = Object.assign({}, cells[idx], { zoom: 1, ox: 50, oy: 50 });
      }),
    onZoom: (idx: number, z: number) =>
      mutateCells(
        (cells) => {
          cells[idx].zoom = z;
        },
        `zoom:${active}:${idx}`,
      ),
    onPan: (idx: number, ox: number, oy: number) =>
      mutateCells(
        (cells) => {
          cells[idx].ox = ox;
          cells[idx].oy = oy;
        },
        `pan:${active}:${idx}`,
      ),
    onCrop: (idx: number) => setCrop({ idx }),
    onDice: (idx: number) => {
      const sp = spreads[active];
      const pid = sp && sp.cells[idx] && sp.cells[idx].photoId;
      if (!pid) return;
      diceActiveWith(pid);
      setSelected(null);
      showToast("Sliced photo across the spread");
    },
    onRepattern: (rows: number, cols: number) =>
      setSpreads((prev) =>
        prev.map((sp, i) =>
          i === active && (sp.dice || sp.dicePhotoId)
            ? Object.assign({}, sp, {
                dice: { photoId: sp.dice ? sp.dice.photoId : sp.dicePhotoId!, rows, cols },
                dicePhotoId: undefined,
              })
            : sp,
        ),
      ),
    onDiceSwap: (pid: string) => {
      const sp = spreads[active];
      const rc = sp && sp.dice ? { rows: sp.dice.rows, cols: sp.dice.cols } : null;
      diceActiveWith(pid, rc);
      showToast("Replaced the diced photo");
    },
    onClearDice: () => {
      clearDiceOnActive();
      showToast("Un-diced — frames restored");
    },
    onSetBg: (color: string) => mutateSpread((sp) => Object.assign(sp, { pageColor: color })),
    onSetCellFrame: (idx: number, frame: Frame) =>
      mutateCells((cells) => {
        cells[idx] = Object.assign({}, cells[idx], { frame: frame.w ? frame : undefined });
      }),
    onSetAllFrames: (frame: Frame) =>
      setSpreads((prev) =>
        prev.map((sp, i) => {
          if (i !== active) return sp;
          const cells = sp.cells.map((c) =>
            c.photoId ? Object.assign({}, c, { frame: frame.w ? frame : undefined }) : c,
          );
          const overlays = (sp.overlays || []).map((o) =>
            Object.assign({}, o, { frame: frame.w ? frame : undefined }),
          );
          return Object.assign({}, sp, { cells, overlays });
        }),
      ),
    onSetPad: (px: number | null) =>
      mutateSpread(
        (sp) => Object.assign(sp, { padding: px == null ? undefined : px }),
        `pad:${active}`,
      ),
    onAddOverlay: (pid: string, xPct: number, yPct: number) => {
      const id = uid();
      const o = photosById[pid] && photosById[pid].orient;
      const wPct = o === "P" ? 26 : o === "S" ? 32 : 40;
      mutateSpread((sp) =>
        Object.assign(sp, {
          overlays: [
            ...(sp.overlays || []),
            { id, photoId: pid, xPct, yPct, wPct, frame: { w: 6, color: "#ffffff" } },
          ],
        }),
      );
      setSelected(null);
      setSelOverlay(id);
      showToast("Floating image added — drag to place, corner to scale");
    },
    onSelectOverlay: (id: string) => {
      setSelected(null);
      setAllSel(false);
      setSelOverlay(id);
    },
    onMoveOverlay: (id: string, xPct: number, yPct: number) =>
      mutateSpread(
        (sp) =>
          Object.assign(sp, {
            overlays: (sp.overlays || []).map((o) =>
              o.id === id ? Object.assign({}, o, { xPct, yPct }) : o,
            ),
          }),
        `mov:${id}`,
      ),
    onScaleOverlay: (id: string, wPct: number) =>
      mutateSpread(
        (sp) =>
          Object.assign(sp, {
            overlays: (sp.overlays || []).map((o) =>
              o.id === id ? Object.assign({}, o, { wPct }) : o,
            ),
          }),
        `scl:${id}`,
      ),
    onSetOverlayFrame: (id: string, frame: Frame) =>
      mutateSpread((sp) =>
        Object.assign(sp, {
          overlays: (sp.overlays || []).map((o) =>
            o.id === id ? Object.assign({}, o, { frame: frame.w ? frame : undefined }) : o,
          ),
        }),
      ),
    onReplaceOverlay: (id: string, pid: string) =>
      mutateSpread((sp) =>
        Object.assign(sp, {
          overlays: (sp.overlays || []).map((o) =>
            o.id === id ? Object.assign({}, o, { photoId: pid }) : o,
          ),
        }),
      ),
    onRemoveOverlay: (id: string) => {
      mutateSpread((sp) =>
        Object.assign(sp, {
          overlays: (sp.overlays || []).filter((o) => o.id !== id),
        }),
      );
      setSelOverlay(null);
      showToast("Removed");
    },
    onAddTextOverlay: (xPct?: number, yPct?: number) => {
      const id = uid();
      mutateSpread((sp) =>
        Object.assign(sp, {
          overlays: [
            ...(sp.overlays || []),
            {
              id,
              kind: "text" as const,
              text: "Title",
              xPct: xPct ?? 50,
              yPct: yPct ?? 50,
              wPct: 60,
              fontFamily: '"Cormorant Garamond", "Times New Roman", serif',
              fontSize: 48,
              color: "#16151a",
              align: "center" as const,
              weight: "normal" as const,
            },
          ],
        }),
      );
      setSelected(null);
      setSelOverlay(id);
      showToast("Text added — edit in the Design panel");
    },
    onUpdateTextOverlay: (id: string, patch) =>
      mutateSpread(
        (sp) =>
          Object.assign(sp, {
            overlays: (sp.overlays || []).map((o) =>
              o.id === id && o.kind === "text" ? Object.assign({}, o, patch) : o,
            ),
          }),
        `txt:${id}`,
      ),
    onDuplicateActive: () => {
      setSpreads((prev) => {
        if (prev.length === 0) return prev;
        const src = prev[active];
        const copy: Spread = JSON.parse(JSON.stringify(src));
        copy.id = sid();
        if (copy.overlays) copy.overlays = copy.overlays.map((o) => ({ ...o, id: uid() }));
        const next = [...prev];
        next.splice(active + 1, 0, copy);
        return next;
      });
      setActive(active + 1);
      setSelected(null);
      setSelOverlay(null);
      showToast("Spread duplicated");
    },
  };

  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const toggleSel = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const clearSel = () => setSel(new Set());

  const importPhotos = async () => {
    const added = await Platform.importPhotos(projectId);
    if (added && added.length) {
      setPhotos((prev) => [...added, ...prev]);
      showToast(`Imported ${added.length} photo${added.length > 1 ? "s" : ""}`);
    }
  };

  const addSelected = () => {
    const ids = [...sel];
    if (!ids.length) return;
    let n = 0;
    setSpreads((prev) => {
      let qi = 0;
      return prev.map((sp) =>
        Object.assign({}, sp, {
          cells: sp.cells.map((c) => {
            if (!c.photoId && qi < ids.length) {
              n++;
              return { photoId: ids[qi++], zoom: 1, ox: 50, oy: 50 };
            }
            return c;
          }),
        }),
      );
    });
    clearSel();
    setView("designer");
    showToast(
      n < ids.length
        ? `Added ${n} photo${n > 1 ? "s" : ""} — album is full`
        : `Added ${n} photo${n > 1 ? "s" : ""} to empty frames`,
    );
  };

  const pickTemplate = (tid: string) => {
    setSpreads((prev) =>
      prev.map((sp, i) => {
        if (i !== active) return sp;
        const next = cellsFor(tid);
        sp.cells.forEach((c, k) => {
          if (next[k] && c.photoId) next[k] = Object.assign({}, c);
        });
        return Object.assign({}, sp, { templateId: tid, cells: next, dice: undefined, dicePhotoId: undefined });
      }),
    );
    setSelected(null);
  };

  const autofill = () => {
    const unused = photos.filter((p) => !usedIds.has(p.id)).map((p) => p.id);
    let n = 0;
    setSpreads((prev) => {
      let qi = 0;
      return prev.map((sp) => {
        const cells = sp.cells.map((c) => {
          if (!c.photoId && qi < unused.length) {
            n++;
            return { photoId: unused[qi++], zoom: 1, ox: 50, oy: 50 };
          }
          return c;
        });
        return Object.assign({}, sp, { cells });
      });
    });
    showToast(n ? `Auto-filled ${n} photo${n > 1 ? "s" : ""} into empty frames` : "Every frame is already filled");
  };

  const addSpread = () => {
    const sp: Spread = { id: sid(), templateId: "duo", cells: cellsFor("duo") };
    setSpreads((prev) => [...prev, sp]);
    setActive(spreads.length);
    setSelected(null);
    showToast("New spread added");
  };

  const removeSpread = (i: number) => {
    if (spreads.length <= 1) {
      showToast("Can't remove the last spread");
      return;
    }
    setSpreads((prev) => prev.filter((_, idx) => idx !== i));
    setActive((cur) => (cur < i ? cur : cur === i ? Math.max(0, i - 1) : cur - 1));
    setSelected(null);
    setSelOverlay(null);
    setAllSel(false);
    showToast("Spread removed");
  };

  const reorder = (from: number, dropIdx: number) => {
    setSpreads((prev) => {
      const arr = [...prev];
      const [m] = arr.splice(from, 1);
      const idx = dropIdx > from ? dropIdx - 1 : dropIdx;
      arr.splice(idx, 0, m);
      return arr;
    });
    setActive(0);
    setSelected(null);
  };

  const runExport = async () => {
    if (exporting) return;
    if (spreads.length === 0) {
      showToast("Nothing to export — add a spread first");
      return;
    }
    setExporting(true);
    showToast("Rendering spreads…");
    try {
      const { wMm, hMm } = trimSizeToMm(meta.size || '12 × 12"');
      const album = await renderAlbum(spreads, photosById, {
        pageWidthMm: wMm,
        pageHeightMm: hMm,
        bleedMm: 3,
        dpi: meta.exportDpi ?? 150,
        paddingPx: 0,
      });
      const defaultName =
        (projectName || "album").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") +
        ".pdf";
      const result = await Platform.exportAlbum({
        jpegs: album.jpegs,
        spreadWidthMm: album.spreadWidthMm,
        spreadHeightMm: album.spreadHeightMm,
        bleedMm: album.bleedMm,
        defaultName,
      });
      if (result.kind === "pdf") showToast(`Exported PDF to ${result.path}`);
      else if (result.kind === "jpegs") showToast(`Downloaded ${result.files} JPEGs`);
      else if (result.kind === "error") showToast(`Export failed: ${result.message}`);
    } catch (e) {
      showToast(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(false);
    }
  };

  const runShare = async () => {
    if (sharing) return;
    if (spreads.length === 0) {
      showToast("Add a spread first");
      return;
    }
    setSharing(true);
    showToast("Rendering spreads for preview…");
    try {
      const { wMm, hMm } = trimSizeToMm(meta.size || '12 × 12"');
      const album = await renderAlbum(spreads, photosById, {
        pageWidthMm: wMm,
        pageHeightMm: hMm,
        bleedMm: 0,
        dpi: 110,
        paddingPx: 0,
        jpegQuality: 0.85,
      });
      const name = meta.title || projectName;
      const result = await createShare({
        name,
        meta: {
          title: meta.title || projectName,
          date: meta.date,
          size: meta.size,
        },
        jpegs: album.jpegs,
        onProgress: (done, total) => {
          if (done < total) showToast(`Uploading spread ${done + 1} of ${total}…`);
        },
      });
      rememberShare({
        token: result.token,
        revokeToken: result.revokeToken,
        url: result.url,
        name,
      });
      setShareModal({
        latest: { url: result.url, revokeToken: result.revokeToken, copied: false },
        recents: recentShares(),
      });
      showToast("Preview link ready");
    } catch (e) {
      showToast(`Share failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSharing(false);
    }
  };

  const onRevokeRecent = async (token: string, revokeToken: string) => {
    if (!confirm("Revoke this preview link? Anyone with the URL will see a 'not found' page.")) return;
    try {
      await revokeShare(token, revokeToken);
      markRevoked(token);
      setShareModal((prev) => (prev ? { ...prev, recents: recentShares() } : prev));
    } catch (e) {
      showToast(`Revoke failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const toggleFav = (pid: string) =>
    setPhotos((prev) => prev.map((p) => (p.id === pid ? Object.assign({}, p, { fav: !p.fav }) : p)));

  const toggleFavSpread = (id: string) =>
    setFavSpreads((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const sortedPhotos = useMemo(() => {
    if (sort === "fav") return [...photos].sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0));
    return photos;
  }, [photos, sort]);

  const activeSpread = spreads[Math.min(active, spreads.length - 1)];

  let cropEl: React.ReactNode = null;
  if (crop && activeSpread) {
    const cellObj = activeSpread.cells[crop.idx];
    const tpl = templates.find((t) => t.id === activeSpread.templateId);
    const ph = cellObj && cellObj.photoId ? photosById[cellObj.photoId] : null;
    if (ph && tpl) {
      cropEl = React.createElement(CropModal, {
        photo: ph,
        cell: cellObj,
        pos: tpl.cells[crop.idx],
        onApply: (z: number, ox: number, oy: number) => {
          mutateCells((cells) => {
            cells[crop.idx] = Object.assign({}, cells[crop.idx], { zoom: z, ox, oy });
          });
          setCrop(null);
          showToast("Crop applied");
        },
        onClose: () => setCrop(null),
      });
    }
  }

  const defaultPad = parseInt(LAYOUT.margin, 10);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "div",
      { className: "app" },
      React.createElement(TopBar, {
        view,
        setView,
        onAutofill: autofill,
        projectName,
        meta,
        onBackToProjects,
        onShare: runShare,
        sharing,
      }),
      view === "designer"
        ? React.createElement(
            "div",
            { className: "designer" },
            React.createElement(Tray, {
              photos,
              usedIds,
              query,
              setQuery,
              sel,
              toggleSel,
              onImport: importPhotos,
            }),
            React.createElement(
              "div",
              { className: "center" },
              React.createElement(
                "div",
                { className: "canvas-top" },
                React.createElement(
                  "div",
                  { className: "pageno" },
                  "Spread ",
                  React.createElement(
                    "b",
                    null,
                    active === 0 ? "Cover" : `${active * 2}–${active * 2 + 1}`,
                  ),
                  ` · ${spreads.length} ${spreads.length === 1 ? "spread" : "spreads"}`,
                ),
                React.createElement(
                  "div",
                  { className: "zoomctl" },
                  React.createElement(
                    "button",
                    {
                      className: "zoom-btn",
                      onClick: () => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2))),
                      "aria-label": "Zoom out",
                      title: "Zoom out (⌘−)",
                    },
                    "−",
                  ),
                  React.createElement(
                    "button",
                    {
                      className: "zoom-level",
                      onClick: () => setZoom(1),
                      title: "Reset zoom (⌘0)",
                    },
                    Math.round(zoom * 100) + "%",
                  ),
                  React.createElement(
                    "button",
                    {
                      className: "zoom-btn",
                      onClick: () => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2))),
                      "aria-label": "Zoom in",
                      title: "Zoom in (⌘+)",
                    },
                    "+",
                  ),
                ),
              ),
              React.createElement(
                "div",
                {
                  ref: stageRef,
                  className: "stage",
                  onClick: () => {
                    setSelected(null);
                    setSelOverlay(null);
                    setAllSel(false);
                  },
                },
                React.createElement(
                  "div",
                  {
                    className: "spread-wrap",
                    style: zoom !== 1 ? { transform: `scale(${zoom})`, transformOrigin: "center center" } : undefined,
                    onClick: (e: React.MouseEvent) => e.stopPropagation(),
                  },
                  React.createElement(SpreadView, {
                    spread: activeSpread,
                    photosById,
                    editable: true,
                    selectedIdx: selected,
                    selOverlay,
                    allSel,
                    handlers,
                  }),
                ),
              ),
              React.createElement(Filmstrip, {
                spreads,
                active,
                photosById,
                onSelect: (i: number) => {
                  setActive(i);
                  setSelected(null);
                  setSelOverlay(null);
                  setAllSel(false);
                },
                onAdd: addSpread,
                onReorder: reorder,
                onDuplicate: (i: number) => {
                  setActive(i);
                  // run on next tick so setActive has settled before duplicate reads `active`
                  setTimeout(() => handlers.onDuplicateActive?.(), 0);
                },
                onRemove: removeSpread,
              }),
            ),
            React.createElement(TemplatePanel, {
              spread: activeSpread,
              active,
              onPick: pickTemplate,
              photosById,
              selectedIdx: selected,
              selOverlay,
              allSel,
              setAllSel,
              defaultPad,
              handlers,
              pageSize: meta.size,
            }),
          )
        : null,
      view === "library"
        ? React.createElement(Library, {
            photos: sortedPhotos,
            usedIds,
            onToggleFav: toggleFav,
            sort,
            onSort: () => setSort((s) => (s === "story" ? "fav" : "story")),
            sel,
            toggleSel,
            meta,
            onImport: importPhotos,
          })
        : null,
      view === "proof"
        ? React.createElement(Proofing, {
            spreads,
            photosById,
            favSpreads,
            onToggleFavSpread: toggleFavSpread,
            onExport: runExport,
            meta,
          })
        : null,
      view === "settings"
        ? React.createElement(Settings, {
            meta,
            spreadCount: spreads.length,
            onChange: (next: ProjectMeta) => setMeta(next),
            onExport: runExport,
            exporting,
            isDesktop: Platform.isDesktop,
          })
        : null,
    ),
    sel.size > 0
      ? React.createElement(
          "div",
          { className: "selbar" },
          React.createElement(
            "span",
            { className: "ct" },
            sel.size,
            React.createElement("span", null, " selected"),
          ),
          React.createElement("button", { className: "btn ghost", onClick: clearSel }, "Clear"),
          React.createElement(
            "button",
            { className: "btn primary", onClick: addSelected },
            React.createElement(Icon, { n: "plus" }),
            "Add to album",
          ),
        )
      : null,
    toast ? React.createElement("div", { className: "toast show" }, React.createElement(Icon, { n: "check" }), toast) : null,
    cropEl,
    shareModal
      ? React.createElement(
          "div",
          { className: "modal-overlay", onClick: () => setShareModal(null) },
          React.createElement(
            "div",
            { className: "share-modal", onClick: (e: React.MouseEvent) => e.stopPropagation() },
            React.createElement(
              "div",
              { className: "share-modal-head" },
              React.createElement(
                "div",
                null,
                React.createElement(
                  "p",
                  { className: "share-eyebrow" },
                  shareModal.latest ? "Preview link ready" : "Preview links",
                ),
                React.createElement(
                  "h3",
                  null,
                  shareModal.latest ? "Send this to your reviewer" : "Your recent previews",
                ),
              ),
              React.createElement(
                "button",
                { className: "btn ghost", onClick: () => setShareModal(null) },
                React.createElement(Icon, { n: "x" }),
              ),
            ),
            shareModal.latest
              ? React.createElement(
                  React.Fragment,
                  null,
                  React.createElement("input", {
                    className: "share-url",
                    readOnly: true,
                    value: shareModal.latest.url,
                    onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select(),
                  }),
                  React.createElement(
                    "div",
                    { className: "share-modal-actions" },
                    React.createElement(
                      "button",
                      {
                        className: "btn primary",
                        onClick: async () => {
                          if (!shareModal.latest) return;
                          try {
                            await navigator.clipboard.writeText(shareModal.latest.url);
                            setShareModal((prev) =>
                              prev && prev.latest
                                ? { ...prev, latest: { ...prev.latest, copied: true } }
                                : prev,
                            );
                          } catch {
                            /* select-on-focus is the fallback */
                          }
                        },
                      },
                      shareModal.latest.copied ? "Copied" : "Copy link",
                    ),
                    React.createElement(
                      "a",
                      {
                        className: "btn",
                        href: shareModal.latest.url,
                        target: "_blank",
                        rel: "noreferrer",
                      },
                      "Open",
                    ),
                  ),
                  React.createElement(
                    "p",
                    { className: "share-modal-note" },
                    "Anyone with this URL can view the preview. Keep it private if you want to.",
                  ),
                )
              : null,
            shareModal.recents.length > 0
              ? React.createElement(
                  "div",
                  { className: "share-recent" },
                  React.createElement(
                    "p",
                    { className: "share-recent-head" },
                    shareModal.latest ? "Earlier previews" : null,
                  ),
                  React.createElement(
                    "ul",
                    null,
                    ...shareModal.recents.slice(0, 8).map((r) =>
                      React.createElement(
                        "li",
                        { key: r.token, className: r.revokedAt ? "revoked" : "" },
                        React.createElement(
                          "div",
                          { className: "share-recent-info" },
                          React.createElement("strong", null, r.name),
                          React.createElement(
                            "div",
                            { className: "share-recent-meta" },
                            r.revokedAt ? "Revoked" : new Date(r.createdAt).toLocaleString(),
                          ),
                        ),
                        React.createElement(
                          "div",
                          { className: "share-recent-actions" },
                          !r.revokedAt
                            ? React.createElement(
                                "a",
                                { href: r.url, target: "_blank", rel: "noreferrer" },
                                "Open",
                              )
                            : null,
                          !r.revokedAt
                            ? React.createElement(
                                "button",
                                {
                                  className: "danger",
                                  onClick: () => onRevokeRecent(r.token, r.revokeToken),
                                },
                                "Revoke",
                              )
                            : null,
                        ),
                      ),
                    ),
                  ),
                )
              : null,
          ),
        )
      : null,
  );
}
