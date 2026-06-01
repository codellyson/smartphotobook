export type Orient = "L" | "P" | "S";

/**
 * Canonical record of where a photo's bytes live. This is what gets persisted.
 * `src` (an HTTP/blob URL) is reconstructed from `source` at render time —
 * which mechanism depends on the platform (IndexedDB blob URL vs. Tauri's
 * `convertFileSrc`).
 */
export type PhotoSource =
  | { kind: "blob" } // stored in IndexedDB under the photo's own id (web)
  | { kind: "path"; absolute: string } // filesystem path (desktop)
  | { kind: "url"; href: string }; // external/static URL (seed data, legacy)

export type Photo = {
  id: string;
  cap: string;
  orient: Orient;
  /** Canonical source; persisted. */
  source: PhotoSource;
  /** Runtime URL the renderer reads. Reconstructed from `source` on hydration. */
  src: string;
  fav?: boolean;
  imported?: boolean;
  /** EXIF DateTimeOriginal as a unix-ms timestamp, if available. Used by
   *  auto-layout to sort chronologically. */
  takenAt?: number;
  /** Natural image dimensions in pixels. Captured during import via the
   *  probe helper; used for DPI/quality calculations. May be missing on
   *  photos persisted before this field was tracked. */
  widthPx?: number;
  heightPx?: number;
};

/** Infer a PhotoSource for a legacy photo persisted before this type existed. */
export function inferPhotoSource(p: {
  src?: string;
  path?: string | null;
  source?: PhotoSource;
}): PhotoSource {
  if (p.source) return p.source;
  if (p.path) return { kind: "path", absolute: p.path };
  if (p.src) return { kind: "url", href: p.src };
  return { kind: "url", href: "" };
}

export type GridPos = { c1: number; c2: number; r1: number; r2: number };

export type Template = {
  id: string;
  name: string;
  cells: GridPos[];
};

export type Frame = { w: number; color: string };

export type Cell = {
  photoId: string | null;
  zoom: number;
  ox: number;
  oy: number;
  frame?: Frame;
  /** Per-frame tone adjustments. Brightness and contrast are integer
   *  percentages (-50 to +50). bw: render the photo desaturated. */
  brightness?: number;
  contrast?: number;
  bw?: boolean;
};

export type ImageOverlay = {
  id: string;
  /** Omitted on legacy overlays; default behavior is "image". */
  kind?: "image";
  photoId: string;
  xPct: number;
  yPct: number;
  wPct: number;
  frame?: Frame;
};

export type TextOverlay = {
  id: string;
  kind: "text";
  text: string;
  xPct: number;
  yPct: number;
  /** Text-box width as % of spread; height grows with content. */
  wPct: number;
  fontFamily: string;
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  weight?: "normal" | "bold";
  italic?: boolean;
  letterSpacing?: number;
};

export type Overlay = ImageOverlay | TextOverlay;

export function isTextOverlay(ov: Overlay): ov is TextOverlay {
  return (ov as TextOverlay).kind === "text";
}

export type DiceConfig = { photoId: string; rows: number; cols: number };

export type Spread = {
  id: string;
  templateId: string;
  cells: Cell[];
  overlays?: Overlay[];
  dice?: DiceConfig;
  dicePhotoId?: string;
  pageColor?: string;
  padding?: number | null;
};

export type ProjectMeta = {
  title: string;
  date: string;
  venue: string;
  size: string;
  pages: number;
  /** Export DPI for press output. Default 150 for fast preview, 300 for press-ready. */
  exportDpi?: number;
};

// Legacy alias — keep until all imports migrate.
export type Project = ProjectMeta;

export const photos: Photo[] = [];

export const templates: Template[] = [
  { id: "full",   name: "Full Bleed",   cells: [{ c1:1,c2:7,r1:1,r2:7 }] },
  { id: "duo",    name: "Duo",          cells: [{ c1:1,c2:4,r1:1,r2:7 },{ c1:4,c2:7,r1:1,r2:7 }] },
  { id: "hero2",  name: "Hero + Two",   cells: [{ c1:1,c2:4,r1:1,r2:7 },{ c1:4,c2:7,r1:1,r2:4 },{ c1:4,c2:7,r1:4,r2:7 }] },
  { id: "hero3",  name: "Hero + Three", cells: [{ c1:1,c2:4,r1:1,r2:7 },{ c1:4,c2:7,r1:1,r2:3 },{ c1:4,c2:7,r1:3,r2:5 },{ c1:4,c2:7,r1:5,r2:7 }] },
  { id: "quad",   name: "Quad",         cells: [{ c1:1,c2:4,r1:1,r2:4 },{ c1:4,c2:7,r1:1,r2:4 },{ c1:1,c2:4,r1:4,r2:7 },{ c1:4,c2:7,r1:4,r2:7 }] },
  { id: "six",    name: "Grid of Six",  cells: [{ c1:1,c2:3,r1:1,r2:4 },{ c1:3,c2:5,r1:1,r2:4 },{ c1:5,c2:7,r1:1,r2:4 },{ c1:1,c2:3,r1:4,r2:7 },{ c1:3,c2:5,r1:4,r2:7 },{ c1:5,c2:7,r1:4,r2:7 }] },
  { id: "pano3",  name: "Pano + Trio",  cells: [{ c1:1,c2:7,r1:1,r2:4 },{ c1:1,c2:3,r1:4,r2:7 },{ c1:3,c2:5,r1:4,r2:7 },{ c1:5,c2:7,r1:4,r2:7 }] },
  { id: "trip",   name: "Triptych",     cells: [{ c1:1,c2:3,r1:1,r2:7 },{ c1:3,c2:5,r1:1,r2:7 },{ c1:5,c2:7,r1:1,r2:7 }] },
  { id: "accent", name: "Accent Print", cells: [{ c1:2,c2:6,r1:2,r2:6 }] },
];

export function cellsFor(tid: string): Cell[] {
  const t = templates.find((x) => x.id === tid);
  if (!t) return [];
  return t.cells.map(() => ({ photoId: null, zoom: 1, ox: 50, oy: 50 }));
}

let _sid = 0;
export const sid = (): string => "s" + ++_sid;

export const initialSpreads: Spread[] = [
  { id: sid(), templateId: "duo", cells: cellsFor("duo") },
];

export const defaultMeta: ProjectMeta = {
  title: "",
  date: "",
  venue: "",
  size: '12 × 12"',
  pages: 40,
  exportDpi: 150,
};

/** @deprecated import { defaultMeta } instead; threaded as a prop from App. */
export const project: ProjectMeta = defaultMeta;
