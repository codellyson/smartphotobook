
import React, { useMemo, useRef, useState } from "react";
import type { Cell as CellType, GridPos, Photo, ProjectMeta, Spread, Template, Frame, TextOverlay } from "@/lib/data";
import { templates, isTextOverlay } from "@/lib/data";
import { Platform } from "@/lib/platform";
import { cellPhysicalSize, effectivePPI, ppiBand } from "@/lib/cell-geometry";
import { trimSizeToMm } from "@/lib/render";
import { Icon } from "./icons";
import { OverlayDropCatcher, OverlayLayer, PAGE_COLORS, FRAME_COLORS, type OverlayHandlers } from "./overlays";

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}
export function gridPos(p: GridPos): React.CSSProperties {
  return { gridColumn: `${p.c1} / ${p.c2}`, gridRow: `${p.r1} / ${p.r2}` };
}
export function imgStyle(cell: CellType): React.CSSProperties {
  const tone: string[] = [];
  if (cell.brightness) tone.push(`brightness(${(1 + cell.brightness / 100).toFixed(3)})`);
  if (cell.contrast) tone.push(`contrast(${(1 + cell.contrast / 100).toFixed(3)})`);
  if (cell.bw) tone.push("grayscale(1)");
  const style: React.CSSProperties = {
    objectPosition: `${cell.ox}% ${cell.oy}%`,
    transform: `scale(${cell.zoom})`,
    transformOrigin: "center",
  };
  // Compose with the base --grade filter so tone adjustments stack on top.
  if (tone.length) style.filter = `var(--grade) ${tone.join(" ")}`;
  return style;
}

const DICE_PRESETS = [
  { id: "1x2", label: "Halves",   rows: 1, cols: 2 },
  { id: "1x3", label: "Triptych", rows: 1, cols: 3 },
  { id: "1x4", label: "Strips",   rows: 1, cols: 4 },
  { id: "2x2", label: "Quad",     rows: 2, cols: 2 },
  { id: "2x3", label: "Six",      rows: 2, cols: 3 },
  { id: "3x1", label: "Stacked",  rows: 3, cols: 1 },
  { id: "3x3", label: "Mosaic",   rows: 3, cols: 3 },
];

export function diceTileImgStyle(r: number, c: number, rows: number, cols: number): React.CSSProperties {
  return {
    position: "absolute",
    left: `calc(${-c} * (100% + var(--dgap)))`,
    top: `calc(${-r} * (100% + var(--dgap)))`,
    width: `calc(${cols} * 100% + ${cols - 1} * var(--dgap))`,
    height: `calc(${rows} * 100% + ${rows - 1} * var(--dgap))`,
    objectFit: "cover",
    filter: "var(--grade)",
    pointerEvents: "none",
    userSelect: "none",
  };
}

function PresetGlyph({ rows, cols }: { rows: number; cols: number }) {
  const n = rows * cols;
  const cells: number[] = [];
  for (let i = 0; i < n; i++) cells.push(i);
  return React.createElement(
    "span",
    {
      className: "pg",
      style: { gridTemplateColumns: `repeat(${cols},1fr)`, gridTemplateRows: `repeat(${rows},1fr)` },
    },
    cells.map((i) => React.createElement("i", { key: i })),
  );
}

export type DesignerHandlers = OverlayHandlers & {
  onSelect: (idx: number) => void;
  onStartDrag?: () => void;
  onDropContent: (toIdx: number, payload: { photoIds?: string[]; photoId?: string; fromCell?: number }) => void;
  onRemove: (idx: number) => void;
  onRecenter: (idx: number) => void;
  onZoom: (idx: number, z: number) => void;
  onPan: (idx: number, ox: number, oy: number) => void;
  onCrop: (idx: number) => void;
  onDice: (idx: number) => void;
  onClearDice: () => void;
  onRepattern: (rows: number, cols: number) => void;
  onDiceSwap: (pid: string) => void;
  onAddOverlay?: (pid: string, xPct: number, yPct: number) => void;
  onAddTextOverlay?: (xPct?: number, yPct?: number) => void;
  onUpdateTextOverlay: (id: string, patch: Partial<TextOverlay>) => void;
  onSetBg: (color: string) => void;
  onSetCellFrame: (idx: number, frame: Frame) => void;
  onSetAllFrames: (frame: Frame) => void;
  onSetCellTone?: (idx: number, patch: Partial<{ brightness: number; contrast: number; bw: boolean }>) => void;
  onSetPad: (px: number | null) => void;
  onSetOverlayFrame: (id: string, frame: Frame) => void;
  onDuplicateActive?: () => void;
};

type DiceGridProps = {
  dice: { photoId: string; rows: number; cols: number };
  src: string;
  editable: boolean;
  handlers: DesignerHandlers;
};

export function DiceGrid({ dice, src, editable, handlers }: DiceGridProps) {
  const { rows, cols } = dice;
  const [over, setOver] = useState(false);
  const tiles: Array<{ r: number; c: number }> = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tiles.push({ r, c });
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    const pid = e.dataTransfer.getData("sa/photo");
    if (pid && handlers.onDiceSwap) handlers.onDiceSwap(pid);
  };
  return React.createElement(
    "div",
    {
      className: "dice-layer" + (over ? " over" : ""),
      style: {
        gridTemplateColumns: `repeat(${cols},1fr)`,
        gridTemplateRows: `repeat(${rows},1fr)`,
        ["--dgap" as string]: "var(--gap)",
      } as React.CSSProperties,
      onDragOver: editable ? (e: React.DragEvent) => { e.preventDefault(); setOver(true); } : undefined,
      onDragLeave: () => setOver(false),
      onDrop: editable ? handleDrop : undefined,
    },
    tiles.map((t, i) =>
      React.createElement(
        "div",
        { key: i, className: "dtile" },
        React.createElement("img", { src, draggable: false, style: diceTileImgStyle(t.r, t.c, rows, cols) }),
      ),
    ),
    editable
      ? React.createElement(
          "div",
          { className: "dice-bar", onClick: (e: React.MouseEvent) => e.stopPropagation() },
          React.createElement("span", { className: "dice-bar-lbl" }, "Dice"),
          DICE_PRESETS.map((p) =>
            React.createElement(
              "button",
              {
                key: p.id,
                title: p.label,
                className: "dice-preset" + (p.rows === rows && p.cols === cols ? " on" : ""),
                onClick: () => handlers.onRepattern(p.rows, p.cols),
              },
              React.createElement(PresetGlyph, { rows: p.rows, cols: p.cols }),
            ),
          ),
          React.createElement("span", { className: "dice-bar-sep" }),
          React.createElement(
            "button",
            { className: "dice-undice", onClick: handlers.onClearDice },
            React.createElement(Icon, { n: "x" }),
            "Un-dice",
          ),
        )
      : null,
  );
}

type CellPosCell = CellType & { _pos: GridPos };

type CellProps = {
  cell: CellPosCell;
  idx: number;
  photo: Photo | null;
  selected: boolean;
  allSelected: boolean;
  editable: boolean;
  /** 1-based position among placed cells in this spread's reading order. */
  placedIndex?: number;
  onSelect: DesignerHandlers["onSelect"];
  onDropContent: DesignerHandlers["onDropContent"];
  onStartDrag?: DesignerHandlers["onStartDrag"];
  onRemove: DesignerHandlers["onRemove"];
  onRecenter: DesignerHandlers["onRecenter"];
  onZoom: DesignerHandlers["onZoom"];
  onPan: DesignerHandlers["onPan"];
  onCrop: DesignerHandlers["onCrop"];
  onDice: DesignerHandlers["onDice"];
  onClearDice: DesignerHandlers["onClearDice"];
};

export function Cell({ cell, idx, photo, selected, allSelected, editable, placedIndex, onSelect, onDropContent, onStartDrag, onRemove, onRecenter, onZoom, onPan, onCrop, onDice }: CellProps) {
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const pan = useRef<{ x: number; y: number; ox: number; oy: number; w: number; h: number } | null>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    const many = e.dataTransfer.getData("sa/photos");
    if (many) { onDropContent(idx, { photoIds: JSON.parse(many) }); return; }
    const pid = e.dataTransfer.getData("sa/photo");
    const cidx = e.dataTransfer.getData("sa/cell");
    if (pid) onDropContent(idx, { photoId: pid });
    else if (cidx !== "") onDropContent(idx, { fromCell: parseInt(cidx, 10) });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!selected || !photo) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    pan.current = { x: e.clientX, y: e.clientY, ox: cell.ox, oy: cell.oy, w: rect.width, h: rect.height };
    ref.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pan.current) return;
    const p = pan.current;
    const dx = ((e.clientX - p.x) / p.w) * 120;
    const dy = ((e.clientY - p.y) / p.h) * 120;
    onPan(idx, clamp(p.ox - dx, 0, 100), clamp(p.oy - dy, 0, 100));
  };
  const endPan = () => { pan.current = null; };

  if (!photo) {
    return React.createElement(
      "div",
      {
        className: "cell empty" + (over ? " over" : ""),
        style: gridPos(cell._pos),
        onDragOver: editable ? (e: React.DragEvent) => { e.preventDefault(); setOver(true); } : undefined,
        onDragLeave: () => setOver(false),
        onDrop: editable ? handleDrop : undefined,
      },
      React.createElement("div", { className: "ph" }, React.createElement(Icon, { n: "image" }), "Drop photo"),
    );
  }

  return React.createElement(
    "div",
    {
      ref,
      className:
        "cell filled" +
        (over ? " over" : "") +
        (selected ? " selected" : "") +
        (allSelected && !selected ? " allsel" : ""),
      style: gridPos(cell._pos),
      draggable: editable && !selected,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.setData("sa/cell", String(idx));
        e.dataTransfer.effectAllowed = "move";
        onStartDrag && onStartDrag();
      },
      onDragOver: editable ? (e: React.DragEvent) => { e.preventDefault(); setOver(true); } : undefined,
      onDragLeave: () => setOver(false),
      onDrop: editable ? handleDrop : undefined,
      onClick: editable ? (e: React.MouseEvent) => { e.stopPropagation(); onSelect(idx); } : undefined,
      onPointerDown,
      onPointerMove,
      onPointerUp: endPan,
      onPointerCancel: endPan,
    },
    React.createElement("img", { src: photo.src, alt: photo.cap, style: imgStyle(cell), draggable: false }),
    cell.frame && cell.frame.w
      ? React.createElement("div", {
          className: "cframe",
          style: { borderWidth: cell.frame.w, borderColor: cell.frame.color, borderStyle: "solid" },
        })
      : null,
    placedIndex
      ? React.createElement("div", { className: "cell-num", "aria-hidden": "true" }, placedIndex)
      : null,
    editable
      ? React.createElement(
          "div",
          { className: "cell-tools", key: "t" },
          React.createElement("button", { title: "Crop", onClick: (e: React.MouseEvent) => { e.stopPropagation(); onCrop(idx); } }, React.createElement(Icon, { n: "crop" })),
          React.createElement("button", { title: "Dice across spread", onClick: (e: React.MouseEvent) => { e.stopPropagation(); onDice(idx); } }, React.createElement(Icon, { n: "dice" })),
          React.createElement("button", { title: "Recenter", onClick: (e: React.MouseEvent) => { e.stopPropagation(); onRecenter(idx); } }, React.createElement(Icon, { n: "recenter" })),
          React.createElement("button", { title: "Remove", onClick: (e: React.MouseEvent) => { e.stopPropagation(); onRemove(idx); } }, React.createElement(Icon, { n: "trash" })),
        )
      : null,
    editable
      ? React.createElement(
          "div",
          { className: "cell-zoom", key: "z", onClick: (e: React.MouseEvent) => e.stopPropagation() },
          React.createElement(Icon, { n: "zoom" }),
          React.createElement("input", {
            type: "range",
            min: 1,
            max: 2.4,
            step: 0.02,
            value: cell.zoom,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => onZoom(idx, parseFloat(e.target.value)),
            onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
          }),
        )
      : null,
  );
}

type CropModalProps = {
  photo: Photo;
  cell: CellType;
  pos: GridPos;
  onApply: (z: number, ox: number, oy: number) => void;
  onClose: () => void;
};

export function CropModal({ photo, cell, pos, onApply, onClose }: CropModalProps) {
  const [z, setZ] = useState(cell.zoom);
  const [ox, setOx] = useState(cell.ox);
  const [oy, setOy] = useState(cell.oy);
  const box = useRef<HTMLDivElement | null>(null);
  const pan = useRef<{ x: number; y: number; ox: number; oy: number; w: number; h: number } | null>(null);

  const W = (pos.c2 - pos.c1) / 6;
  const H = (pos.r2 - pos.r1) / 6;
  const ratio = (W / H) * 1.81;
  let fw = 600;
  let fh = fw / ratio;
  if (fh > 430) { fh = 430; fw = fh * ratio; }
  if (fw > 640) { fw = 640; fh = fw / ratio; }

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    pan.current = { x: e.clientX, y: e.clientY, ox, oy, w: r.width, h: r.height };
    box.current?.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pan.current) return;
    const p = pan.current;
    const dx = ((e.clientX - p.x) / p.w) * 120;
    const dy = ((e.clientY - p.y) / p.h) * 120;
    setOx(clamp(p.ox - dx, 0, 100));
    setOy(clamp(p.oy - dy, 0, 100));
  };
  const up = () => { pan.current = null; };

  return React.createElement(
    "div",
    { className: "modal-overlay", onClick: onClose },
    React.createElement(
      "div",
      { className: "crop-panel", onClick: (e: React.MouseEvent) => e.stopPropagation() },
      React.createElement(
        "div",
        { className: "crop-head" },
        React.createElement(
          "div",
          null,
          React.createElement("div", { className: "ch-t" }, "Crop & reposition"),
          React.createElement("div", { className: "ch-s" }, photo.cap, " · frame ", `${(W * 6).toFixed(0)}×${(H * 6).toFixed(0)}`),
        ),
        React.createElement("button", { className: "btn ghost", onClick: onClose }, React.createElement(Icon, { n: "x" })),
      ),
      React.createElement(
        "div",
        { className: "crop-body" },
        React.createElement(
          "div",
          {
            ref: box,
            className: "crop-stage",
            style: { width: fw, height: fh },
            onPointerDown: down,
            onPointerMove: move,
            onPointerUp: up,
            onPointerCancel: up,
          },
          React.createElement("img", {
            src: photo.src,
            draggable: false,
            style: { objectPosition: `${ox}% ${oy}%`, transform: `scale(${z})` },
          }),
          React.createElement("div", { className: "crop-grid" }),
        ),
      ),
      React.createElement(
        "div",
        { className: "crop-foot" },
        React.createElement(
          "div",
          { className: "crop-zoom" },
          React.createElement(Icon, { n: "zoom" }),
          React.createElement("input", {
            type: "range",
            min: 1,
            max: 2.6,
            step: 0.02,
            value: z,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setZ(parseFloat(e.target.value)),
          }),
        ),
        React.createElement("div", { style: { flex: 1 } }),
        React.createElement("button", { className: "btn", onClick: () => { setZ(1); setOx(50); setOy(50); } }, "Reset"),
        React.createElement(
          "button",
          { className: "btn primary", onClick: () => onApply(z, ox, oy) },
          React.createElement(Icon, { n: "check" }),
          "Apply crop",
        ),
      ),
    ),
  );
}

type SpreadViewProps = {
  spread: Spread;
  photosById: Record<string, Photo>;
  editable: boolean;
  selectedIdx: number | null;
  selOverlay: string | null;
  allSel?: boolean;
  handlers: DesignerHandlers;
  className?: string;
  style?: React.CSSProperties;
  /** Cover spreads render as a single page (no gutter line). */
  isCover?: boolean;
};

export function SpreadView({ spread, photosById, editable, selectedIdx, selOverlay, allSel, handlers, className, style, isCover }: SpreadViewProps) {
  const spreadRef = useRef<HTMLDivElement | null>(null);
  const tpl = templates.find((t) => t.id === spread.templateId) as Template;
  const cells = spread.cells.map((c, i) => Object.assign({}, c, { _pos: tpl.cells[i] }));
  // 1-based ordering of placed cells for the placement badge.
  const placedOrder: Record<number, number> = {};
  {
    let n = 0;
    spread.cells.forEach((c, i) => {
      if (c.photoId) {
        n++;
        placedOrder[i] = n;
      }
    });
  }
  let dice = spread.dice && photosById[spread.dice.photoId] ? spread.dice : null;
  if (!dice && spread.dicePhotoId && photosById[spread.dicePhotoId]) {
    dice = { photoId: spread.dicePhotoId, rows: 1, cols: 3 };
  }
  const spreadStyle: React.CSSProperties = Object.assign(
    {},
    style,
    spread.pageColor ? { background: spread.pageColor } : null,
    spread.padding != null ? { ["--margin" as string]: spread.padding + "px" } : null,
  );
  return React.createElement(
    "div",
    { className: "spread " + (isCover ? "cover " : "") + (className || ""), style: spreadStyle, ref: spreadRef },
    React.createElement("div", { className: "page-half" }),
    React.createElement("div", { className: "page-half" }),
    isCover ? null : React.createElement("div", { className: "gutter" }),
    editable && handlers.onAddOverlay
      ? React.createElement(OverlayDropCatcher, { spreadRef, onAdd: handlers.onAddOverlay })
      : null,
    dice
      ? React.createElement(DiceGrid, { dice, src: photosById[dice.photoId].src, editable, handlers })
      : React.createElement(
          "div",
          { className: "grid" },
          cells.map((cell, i) =>
            React.createElement(Cell, {
              key: i,
              cell,
              idx: i,
              photo: cell.photoId ? photosById[cell.photoId] : null,
              selected: editable && selectedIdx === i,
              editable,
              allSelected: !!(editable && allSel && cell.photoId),
              placedIndex: placedOrder[i],
              onSelect: handlers.onSelect,
              onDropContent: handlers.onDropContent,
              onStartDrag: handlers.onStartDrag,
              onRemove: handlers.onRemove,
              onRecenter: handlers.onRecenter,
              onZoom: handlers.onZoom,
              onPan: handlers.onPan,
              onCrop: handlers.onCrop,
              onDice: handlers.onDice,
              onClearDice: handlers.onClearDice,
            }),
          ),
        ),
    React.createElement(OverlayLayer, {
      overlays: spread.overlays,
      photosById,
      editable,
      selId: selOverlay,
      spreadRef,
      handlers,
    }),
  );
}

type TrayProps = {
  photos: Photo[];
  usedIds: Set<string>;
  query: string;
  setQuery: (q: string) => void;
  sel: Set<string>;
  toggleSel: (id: string) => void;
  onImport?: () => void;
};

export function Tray({ photos, usedIds, query, setQuery, sel, toggleSel, onImport }: TrayProps) {
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? photos.filter((p) => p.cap.toLowerCase().includes(q)) : photos;
  }, [photos, query]);
  const startDrag = (e: React.DragEvent, id: string) => {
    if (sel.has(id) && sel.size > 1) {
      e.dataTransfer.setData("sa/photos", JSON.stringify([...sel]));
      e.dataTransfer.effectAllowed = "copy";
    } else {
      e.dataTransfer.setData("sa/photo", id);
      e.dataTransfer.effectAllowed = "copy";
    }
  };
  return React.createElement(
    "div",
    { className: "pane-left" },
    React.createElement(
      "div",
      { className: "pane-head" },
      React.createElement("span", { className: "title" }, "Photos"),
      React.createElement("span", { className: "count" }, `${usedIds.size}/${photos.length} placed`),
    ),
    onImport
      ? React.createElement(
          "button",
          {
            className: "import-btn",
            onClick: onImport,
            title: Platform.isDesktop ? "Import from your library" : "Import photos from this device",
          },
          React.createElement(Icon, { n: "plus" }),
          Platform.isDesktop ? "Import from library" : "Import photos",
        )
      : null,
    React.createElement(
      "div",
      { className: "search" },
      React.createElement(Icon, { n: "search" }),
      React.createElement("input", {
        placeholder: "Search photos…",
        value: query,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value),
      }),
    ),
    React.createElement(
      "div",
      { className: "tray" },
      React.createElement(
        "div",
        { className: "tray-grid" },
        list.map((p) =>
          React.createElement(
            "div",
            {
              key: p.id,
              className: "thumb" + (usedIds.has(p.id) ? " used" : "") + (sel.has(p.id) ? " sel" : ""),
              draggable: true,
              onClick: () => toggleSel(p.id),
              onDragStart: (e: React.DragEvent) => startDrag(e, p.id),
            },
            React.createElement("img", { src: p.src, alt: p.cap }),
            React.createElement("div", { className: "selmark" }, React.createElement(Icon, { n: "check" })),
            React.createElement("div", { className: "usedbadge" }, React.createElement(Icon, { n: "check" })),
            React.createElement("div", { className: "cap" }, p.cap),
          ),
        ),
      ),
    ),
  );
}

type FilmstripProps = {
  spreads: Spread[];
  active: number;
  photosById: Record<string, Photo>;
  onSelect: (i: number) => void;
  onAdd: () => void;
  onReorder: (from: number, dropIdx: number) => void;
  onDuplicate?: (i: number) => void;
  onRemove?: (i: number) => void;
};

export function Filmstrip({ spreads, active, photosById, onSelect, onAdd, onReorder, onDuplicate, onRemove }: FilmstripProps) {
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const dragIdx = useRef<number | null>(null);
  return React.createElement(
    "div",
    { className: "filmstrip" },
    spreads.map((sp, i) => {
      let dice = sp.dice && photosById[sp.dice.photoId] ? sp.dice : null;
      if (!dice && sp.dicePhotoId && photosById[sp.dicePhotoId]) {
        dice = { photoId: sp.dicePhotoId, rows: 1, cols: 3 };
      }
      let cls = "fs-spread" + (i === active ? " on" : "");
      if (dropIdx === i) cls += " drop-before";
      if (dropIdx === i + 1) cls += " drop-after";
      return React.createElement(
        "div",
        {
          key: sp.id,
          className: cls,
          onClick: () => onSelect(i),
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            dragIdx.current = i;
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("sa/strip", String(i));
          },
          onDragOver: (e: React.DragEvent) => {
            if (dragIdx.current === null) return;
            e.preventDefault();
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const after = e.clientX > r.left + r.width / 2;
            setDropIdx(after ? i + 1 : i);
          },
          onDragLeave: () => setDropIdx(null),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            if (dragIdx.current !== null && dropIdx !== null) onReorder(dragIdx.current, dropIdx);
            dragIdx.current = null;
            setDropIdx(null);
          },
          onDragEnd: () => { dragIdx.current = null; setDropIdx(null); },
        },
        React.createElement(
          "div",
          { className: "mini", style: sp.pageColor ? { background: sp.pageColor } : undefined },
          React.createElement(
            "div",
            { className: "fs-photos" },
            dice
              ? React.createElement(
                  "div",
                  { key: "dice", className: "fs-ph dice" },
                  React.createElement("img", { src: photosById[dice.photoId].src, alt: "" }),
                )
              : sp.cells.map((c, ci) => {
                  const photo = c.photoId ? photosById[c.photoId] : null;
                  return React.createElement(
                    "div",
                    { key: ci, className: "fs-ph" + (photo ? "" : " empty") },
                    photo
                      ? React.createElement("img", { src: photo.src, alt: "" })
                      : null,
                  );
                }),
          ),
        ),
        React.createElement(
          "div",
          { className: "lbl" },
          React.createElement("span", null, i === 0 ? "Cover" : `${i * 2}–${i * 2 + 1}`),
          onDuplicate
            ? React.createElement(
                "button",
                {
                  className: "fs-dup",
                  title: "Duplicate spread (⌘D)",
                  onClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    onDuplicate(i);
                  },
                },
                React.createElement(Icon, { n: "plus" }),
              )
            : null,
          onRemove && spreads.length > 1
            ? React.createElement(
                "button",
                {
                  className: "fs-rm",
                  title: "Remove spread",
                  onClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    onRemove(i);
                  },
                },
                React.createElement(Icon, { n: "trash" }),
              )
            : null,
        ),
      );
    }),
    React.createElement(
      "div",
      { className: "fs-add-wrap" },
      React.createElement(
        "button",
        { className: "fs-add", onClick: onAdd, title: "Add spread" },
        React.createElement(Icon, { n: "plus" }),
      ),
      React.createElement("div", { className: "fs-add-lbl-spacer" }),
    ),
  );
}

function Swatch({ color, on, ring, onClick, title }: { color: string; on?: boolean; ring?: boolean; onClick: () => void; title: string }) {
  return React.createElement("button", {
    className: "swatch" + (on ? " on" : ""),
    title,
    onClick,
    style: { background: color, boxShadow: ring ? "inset 0 0 0 1px rgba(0,0,0,0.18)" : undefined },
  });
}

function FrameControls({ frame, onChange }: { frame?: Frame; onChange: (f: Frame) => void }) {
  const w = (frame && frame.w) || 0;
  const color = (frame && frame.color) || "#ffffff";
  return React.createElement(
    "div",
    { className: "frame-ctl" },
    React.createElement(
      "div",
      { className: "fc-row" },
      React.createElement("span", { className: "fc-lbl" }, "Width"),
      React.createElement("input", {
        type: "range",
        min: 0,
        max: 14,
        step: 1,
        value: w,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ w: parseInt(e.target.value, 10), color }),
      }),
      React.createElement("span", { className: "fc-val" }, w ? w + "px" : "None"),
    ),
    React.createElement(
      "div",
      { className: "fc-row" },
      React.createElement("span", { className: "fc-lbl" }, "Color"),
      React.createElement(
        "div",
        { className: "swatch-row" },
        FRAME_COLORS.map((c) =>
          React.createElement(Swatch, {
            key: c,
            color: c,
            ring: true,
            on: color === c && w > 0,
            title: c,
            onClick: () => onChange({ w: w || 4, color: c }),
          }),
        ),
      ),
    ),
  );
}

function infoRow(k: string, v: string) {
  return React.createElement("div", { className: "info-row" }, React.createElement("span", null, k), React.createElement("span", null, v));
}

type TemplatePanelProps = {
  spread: Spread;
  spreads: Spread[];
  active: number;
  onPick: (tid: string) => void;
  onSelectSpread: (i: number) => void;
  photos: Photo[];
  photosById: Record<string, Photo>;
  selectedIdx: number | null;
  selOverlay: string | null;
  allSel: boolean;
  setAllSel: (v: boolean) => void;
  defaultPad: number;
  handlers: DesignerHandlers;
  pageSize: string;
  meta: ProjectMeta;
};

/** Album-level info: trim, pages, orientation breakdown. */
function AlbumInfoSection({
  pageSize,
  spreadCount,
  metaPages,
  photos,
}: {
  pageSize: string;
  spreadCount: number;
  metaPages: number;
  photos: Photo[];
}) {
  const counts = useMemo(() => {
    let l = 0;
    let p = 0;
    let s = 0;
    for (const ph of photos) {
      if (ph.orient === "L") l++;
      else if (ph.orient === "P") p++;
      else s++;
    }
    return { l, p, s };
  }, [photos]);
  const usedPages = spreadCount * 2;
  const orientText =
    photos.length === 0
      ? "—"
      : [
          `${counts.l} landscape`,
          `${counts.p} portrait`,
          counts.s ? `${counts.s} square` : null,
        ]
          .filter(Boolean)
          .join(" · ");
  return React.createElement(
    "div",
    { className: "album-info" },
    React.createElement(
      "div",
      { className: "info-row" },
      React.createElement("span", null, "Trim size"),
      React.createElement("span", null, pageSize || "—"),
    ),
    React.createElement(
      "div",
      { className: "info-row" },
      React.createElement("span", null, "Pages"),
      React.createElement("span", null, `${usedPages} of ${metaPages || "—"}`),
    ),
    React.createElement(
      "div",
      { className: "info-row" },
      React.createElement("span", null, "Photos imported"),
      React.createElement("span", null, photos.length),
    ),
    React.createElement(
      "div",
      { className: "info-row" },
      React.createElement("span", null, "Orientations"),
      React.createElement("span", { className: "ai-orient" }, orientText),
    ),
  );
}

/** Live mini-thumb grid of every spread; click to focus. */
function SpreadGridSection({
  spreads,
  active,
  photosById,
  onSelect,
}: {
  spreads: Spread[];
  active: number;
  photosById: Record<string, Photo>;
  onSelect: (i: number) => void;
}) {
  return React.createElement(
    "div",
    { className: "spread-grid" },
    spreads.map((sp, i) => {
      const tpl = templates.find((t) => t.id === sp.templateId);
      const cls = "sg-item" + (i === active ? " on" : "");
      return React.createElement(
        "button",
        { key: sp.id, className: cls, onClick: () => onSelect(i), title: i === 0 ? "Cover" : `Spread ${i * 2}–${i * 2 + 1}` },
        React.createElement(
          "div",
          { className: "sg-mini", style: sp.pageColor ? { background: sp.pageColor } : undefined },
          React.createElement(
            "div",
            { className: "sg-mini-grid" },
            sp.cells.map((c, ci) => {
              const photo = c.photoId ? photosById[c.photoId] : null;
              const tplCell = tpl?.cells[ci];
              return React.createElement(
                "div",
                { key: ci, className: "c", style: tplCell ? gridPos(tplCell) : undefined },
                photo ? React.createElement("img", { src: photo.src, alt: "" }) : null,
              );
            }),
          ),
        ),
        React.createElement(
          "div",
          { className: "sg-label" },
          i === 0 ? "Cover" : `${i * 2}–${i * 2 + 1}`,
        ),
      );
    }),
  );
}

/** Per-photo tone adjustments: brightness + contrast sliders + B&W toggle. */
function ToneAdjustments({
  cell,
  onChange,
}: {
  cell: CellType;
  onChange: (patch: Partial<{ brightness: number; contrast: number; bw: boolean }>) => void;
}) {
  const brightness = cell.brightness ?? 0;
  const contrast = cell.contrast ?? 0;
  const bw = !!cell.bw;
  const dirty = brightness !== 0 || contrast !== 0 || bw;
  const fmt = (v: number) => (v > 0 ? `+${v}` : `${v}`);
  return React.createElement(
    "div",
    { className: "ctx-card tone-adjust" },
    React.createElement(
      "div",
      { className: "fc-row" },
      React.createElement("span", { className: "fc-lbl" }, "Brightness"),
      React.createElement("input", {
        type: "range",
        min: -50,
        max: 50,
        step: 1,
        value: brightness,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onChange({ brightness: parseInt(e.target.value, 10) }),
      }),
      React.createElement("span", { className: "fc-val" }, fmt(brightness)),
    ),
    React.createElement(
      "div",
      { className: "fc-row" },
      React.createElement("span", { className: "fc-lbl" }, "Contrast"),
      React.createElement("input", {
        type: "range",
        min: -50,
        max: 50,
        step: 1,
        value: contrast,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onChange({ contrast: parseInt(e.target.value, 10) }),
      }),
      React.createElement("span", { className: "fc-val" }, fmt(contrast)),
    ),
    React.createElement(
      "div",
      { className: "fc-row" },
      React.createElement("span", { className: "fc-lbl" }, "Black & White"),
      React.createElement(
        "button",
        {
          className: "seg-btn" + (bw ? " on" : ""),
          onClick: () => onChange({ bw: !bw }),
        },
        bw ? "On" : "Off",
      ),
    ),
    dirty
      ? React.createElement(
          "button",
          {
            className: "btn ghost wide",
            onClick: () => onChange({ brightness: 0, contrast: 0, bw: false }),
          },
          React.createElement(Icon, { n: "recenter" }),
          "Reset adjustments",
        )
      : null,
  );
}

/** Image Information panel: Frame size, Effective PPI, EXIF, usage count. */
function ImageInformationSection({
  cellPos,
  photo,
  meta,
  useCount,
}: {
  cellPos: GridPos;
  photo: Photo;
  meta: ProjectMeta;
  useCount: number;
}) {
  const trim = trimSizeToMm(meta.size);
  const size = cellPhysicalSize(cellPos, trim);
  const havePx = !!(photo.widthPx && photo.heightPx);
  const ppi = havePx
    ? effectivePPI(photo.widthPx!, photo.heightPx!, size.wInches, size.hInches)
    : 0;
  const band = ppiBand(ppi);
  const captured = photo.takenAt
    ? new Date(photo.takenAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;
  return React.createElement(
    "div",
    { className: "ctx-card image-info" },
    React.createElement(
      "div",
      { className: "info-row" },
      React.createElement("span", null, "Frame W × H"),
      React.createElement(
        "span",
        null,
        `${size.wInches.toFixed(2)} × ${size.hInches.toFixed(2)} in`,
      ),
    ),
    havePx
      ? React.createElement(
          "div",
          { className: "info-row" },
          React.createElement("span", null, "Effective PPI"),
          React.createElement("span", { className: `ppi-badge ${band}` }, ppi),
        )
      : null,
    havePx
      ? React.createElement(
          "div",
          { className: "info-row" },
          React.createElement("span", null, "Pixel dimensions"),
          React.createElement("span", null, `${photo.widthPx} × ${photo.heightPx} px`),
        )
      : null,
    captured
      ? React.createElement(
          "div",
          { className: "info-row" },
          React.createElement("span", null, "Captured"),
          React.createElement("span", null, captured),
        )
      : null,
    React.createElement(
      "div",
      { className: "info-row" },
      React.createElement("span", null, "Used"),
      React.createElement(
        "span",
        null,
        `${useCount} time${useCount === 1 ? "" : "s"} in album`,
      ),
    ),
  );
}

export function TemplatePanel({ spread, spreads, active, onPick, onSelectSpread, photos, photosById, selectedIdx, selOverlay, allSel, setAllSel, defaultPad, handlers, pageSize, meta }: TemplatePanelProps) {
  const placed = spread.cells.filter((c) => c.photoId).length;
  const pageColor = spread.pageColor || "#f7f3ee";
  const padVal = spread.padding != null ? spread.padding : defaultPad;
  const filledCells = spread.cells.filter((c) => c.photoId);
  const allFrame = (() => {
    if (!filledCells.length) return { w: 0, color: "#ffffff" };
    const f0 = filledCells[0].frame || { w: 0, color: "#ffffff" };
    const same = filledCells.every((c) => {
      const f = c.frame || { w: 0, color: "#ffffff" };
      return f.w === f0.w && f.color === f0.color;
    });
    return same ? { w: f0.w || 0, color: f0.color || "#ffffff" } : { w: 0, color: "#ffffff" };
  })();
  const ov = selOverlay != null && spread.overlays ? spread.overlays.find((o) => o.id === selOverlay) : null;
  const cellSel =
    !ov && selectedIdx != null && spread.cells[selectedIdx] && spread.cells[selectedIdx].photoId
      ? spread.cells[selectedIdx]
      : null;

  // Count how many cells (across all spreads) reference each photo id — for
  // the "Used N times" line in the image inspector.
  const useCountFor = useMemo(() => {
    const m = new Map<string, number>();
    for (const sp of spreads) {
      for (const c of sp.cells) {
        if (c.photoId) m.set(c.photoId, (m.get(c.photoId) ?? 0) + 1);
      }
    }
    return m;
  }, [spreads]);

  const sections: React.ReactNode[] = [
    React.createElement(AlbumInfoSection, {
      key: "ai",
      pageSize,
      spreadCount: spreads.length,
      metaPages: meta.pages,
      photos,
    }),
    React.createElement(
      "div",
      { className: "section-label", key: "tpl-l" },
      React.createElement(Icon, { n: "layers" }),
      "Templates",
    ),
    React.createElement(
      "div",
      { className: "tpl-grid", key: "tpl" },
      templates.map((t) =>
        React.createElement(
          "div",
          { key: t.id, className: "tpl-cell" },
          React.createElement(
            "button",
            {
              className: "tpl" + (t.id === spread.templateId ? " on" : ""),
              onClick: () => onPick(t.id),
              title: t.name,
            },
            React.createElement(
              "div",
              { className: "mg" },
              t.cells.map((c, i) => React.createElement("span", { key: i, style: gridPos(c) })),
            ),
          ),
          React.createElement("div", { className: "nm" }, t.name),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "section-label", key: "pc-l" },
      React.createElement(Icon, { n: "paint" }),
      "Page color",
    ),
    React.createElement(
      "div",
      { className: "swatch-row wide", key: "pc" },
      PAGE_COLORS.map((c) =>
        React.createElement(Swatch, {
          key: c.v,
          color: c.v,
          ring: true,
          on: pageColor.toLowerCase() === c.v.toLowerCase(),
          title: c.name,
          onClick: () => handlers.onSetBg(c.v),
        }),
      ),
    ),
    React.createElement(
      "div",
      { className: "section-label", key: "pad-l" },
      React.createElement(Icon, { n: "expand" }),
      "Page padding",
    ),
    React.createElement(
      "div",
      { className: "ctx-card", key: "pad" },
      React.createElement(
        "div",
        { className: "fc-row" },
        React.createElement("span", { className: "fc-lbl" }, "Inset"),
        React.createElement("input", {
          type: "range",
          min: 0,
          max: 64,
          step: 1,
          value: padVal,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => handlers.onSetPad(parseInt(e.target.value, 10)),
        }),
        React.createElement("span", { className: "fc-val" }, padVal + "px"),
      ),
      spread.padding != null && spread.padding !== defaultPad
        ? React.createElement(
            "button",
            { className: "btn ghost wide", onClick: () => handlers.onSetPad(null) },
            React.createElement(Icon, { n: "recenter" }),
            "Reset to template",
          )
        : null,
    ),
    handlers.onAddTextOverlay
      ? React.createElement(
          "button",
          {
            className: "btn wide",
            key: "add-text",
            onClick: () => handlers.onAddTextOverlay?.(),
          },
          React.createElement(Icon, { n: "plus" }),
          "Add text",
        )
      : null,
    React.createElement(
      "div",
      { className: "section-label", key: "bd-l" },
      React.createElement(Icon, { n: "frame" }),
      "Borders",
    ),
    React.createElement(
      "button",
      {
        className: "btn wide" + (allSel ? " primary" : ""),
        key: "bd-btn",
        onClick: () => setAllSel(!allSel),
        disabled: !filledCells.length,
      },
      React.createElement(Icon, { n: allSel ? "check" : "frame" }),
      allSel ? `All images selected (${filledCells.length})` : "Select all images",
    ),
    allSel
      ? React.createElement(
          "div",
          { className: "ctx-card", key: "bd-card", style: { marginTop: 8 } },
          React.createElement(FrameControls, { frame: allFrame, onChange: (f: Frame) => handlers.onSetAllFrames(f) }),
          allFrame.w
            ? React.createElement(
                "button",
                {
                  className: "btn ghost wide",
                  onClick: () => handlers.onSetAllFrames({ w: 0, color: allFrame.color }),
                },
                React.createElement(Icon, { n: "x" }),
                "Clear all borders",
              )
            : null,
        )
      : null,
  ];

  if (ov && isTextOverlay(ov)) {
    const t = ov as TextOverlay;
    const updateText = (patch: Partial<TextOverlay>) => handlers.onUpdateTextOverlay(t.id, patch);
    sections.push(
      React.createElement(
        "div",
        { className: "section-label accent", key: "tx-l" },
        React.createElement(Icon, { n: "sliders" }),
        "Text",
      ),
      React.createElement(
        "div",
        { className: "ctx-card", key: "tx" },
        React.createElement("textarea", {
          className: "text-edit",
          value: t.text,
          rows: 3,
          placeholder: "Type your text…",
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => updateText({ text: e.target.value }),
        }),
        React.createElement(
          "div",
          { className: "fc-row" },
          React.createElement("span", { className: "fc-lbl" }, "Family"),
          React.createElement(
            "select",
            {
              className: "fc-select",
              value: t.fontFamily,
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) => updateText({ fontFamily: e.target.value }),
            },
            React.createElement("option", { value: '"Cormorant Garamond", "Times New Roman", serif' }, "Display serif"),
            React.createElement("option", { value: 'Georgia, "Times New Roman", serif' }, "Serif"),
            React.createElement("option", { value: 'ui-sans-serif, system-ui, sans-serif' }, "Sans-serif"),
            React.createElement("option", { value: '"Courier New", monospace' }, "Monospace"),
          ),
        ),
        React.createElement(
          "div",
          { className: "fc-row" },
          React.createElement("span", { className: "fc-lbl" }, "Size"),
          React.createElement("input", {
            type: "range",
            min: 8,
            max: 96,
            step: 1,
            value: t.fontSize,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => updateText({ fontSize: parseInt(e.target.value, 10) }),
          }),
          React.createElement("span", { className: "fc-val" }, t.fontSize + "pt"),
        ),
        React.createElement(
          "div",
          { className: "fc-row" },
          React.createElement("span", { className: "fc-lbl" }, "Color"),
          React.createElement(
            "div",
            { className: "swatch-row" },
            ["#ffffff", "#16151a", "#c9a86a", "#3a3a3a", "#8a8f98", "#5e7a8a"].map((c) =>
              React.createElement(Swatch, {
                key: c,
                color: c,
                ring: true,
                on: t.color.toLowerCase() === c,
                title: c,
                onClick: () => updateText({ color: c }),
              }),
            ),
          ),
        ),
        React.createElement(
          "div",
          { className: "fc-row" },
          React.createElement("span", { className: "fc-lbl" }, "Align"),
          React.createElement(
            "div",
            { className: "seg" },
            (["left", "center", "right"] as const).map((a) =>
              React.createElement(
                "button",
                {
                  key: a,
                  className: "seg-btn" + (t.align === a ? " on" : ""),
                  onClick: () => updateText({ align: a }),
                },
                a,
              ),
            ),
          ),
        ),
        React.createElement(
          "div",
          { className: "fc-row" },
          React.createElement("span", { className: "fc-lbl" }, "Style"),
          React.createElement(
            "button",
            {
              className: "seg-btn" + (t.weight === "bold" ? " on" : ""),
              onClick: () => updateText({ weight: t.weight === "bold" ? "normal" : "bold" }),
            },
            "Bold",
          ),
          React.createElement(
            "button",
            {
              className: "seg-btn" + (t.italic ? " on" : ""),
              onClick: () => updateText({ italic: !t.italic }),
            },
            "Italic",
          ),
        ),
        React.createElement(
          "div",
          { className: "fc-row" },
          React.createElement("span", { className: "fc-lbl" }, "Width"),
          React.createElement("input", {
            type: "range",
            min: 10,
            max: 96,
            step: 1,
            value: Math.round(t.wPct),
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              handlers.onScaleOverlay(t.id, parseInt(e.target.value, 10)),
          }),
          React.createElement("span", { className: "fc-val" }, Math.round(t.wPct) + "%"),
        ),
        React.createElement(
          "button",
          { className: "btn ghost wide", onClick: () => handlers.onRemoveOverlay(t.id) },
          React.createElement(Icon, { n: "trash" }),
          "Remove text",
        ),
      ),
    );
  } else if (ov) {
    const p = photosById[ov.photoId];
    sections.push(
      React.createElement(
        "div",
        { className: "section-label accent", key: "ov-l" },
        React.createElement(Icon, { n: "layers" }),
        "Floating image",
      ),
      React.createElement(
        "div",
        { className: "ctx-card", key: "ov" },
        React.createElement("div", { className: "ctx-name" }, p ? p.cap : "Image"),
        React.createElement(
          "div",
          { className: "fc-row" },
          React.createElement("span", { className: "fc-lbl" }, React.createElement(Icon, { n: "expand" }), "Size"),
          React.createElement("input", {
            type: "range",
            min: 8,
            max: 96,
            step: 1,
            value: Math.round(ov.wPct),
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => handlers.onScaleOverlay(ov.id, parseInt(e.target.value, 10)),
          }),
          React.createElement("span", { className: "fc-val" }, Math.round(ov.wPct) + "%"),
        ),
        React.createElement(FrameControls, { frame: ov.frame, onChange: (f: Frame) => handlers.onSetOverlayFrame(ov.id, f) }),
        React.createElement(
          "button",
          { className: "btn ghost wide", onClick: () => handlers.onRemoveOverlay(ov.id) },
          React.createElement(Icon, { n: "trash" }),
          "Remove floating image",
        ),
      ),
    );
  } else if (cellSel) {
    const tpl = templates.find((t) => t.id === spread.templateId) as Template;
    const cellPos = tpl.cells[selectedIdx as number];
    const photo = cellSel.photoId ? photosById[cellSel.photoId] : null;
    sections.push(
      React.createElement(
        "div",
        { className: "section-label accent", key: "fr-l" },
        React.createElement(Icon, { n: "frame" }),
        "Frame",
      ),
      React.createElement(
        "div",
        { className: "ctx-card", key: "fr" },
        React.createElement(FrameControls, {
          frame: cellSel.frame,
          onChange: (f: Frame) => handlers.onSetCellFrame(selectedIdx as number, f),
        }),
      ),
      handlers.onSetCellTone
        ? React.createElement(
            "div",
            { className: "section-label", key: "tn-l" },
            React.createElement(Icon, { n: "sliders" }),
            "Tone Adjustments",
          )
        : null,
      handlers.onSetCellTone
        ? React.createElement(ToneAdjustments, {
            key: "tn",
            cell: cellSel,
            onChange: (patch: Partial<{ brightness: number; contrast: number; bw: boolean }>) =>
              handlers.onSetCellTone!(selectedIdx as number, patch),
          })
        : null,
      photo && cellPos
        ? React.createElement(
            "div",
            { className: "section-label", key: "ii-l" },
            React.createElement(Icon, { n: "image" }),
            "Image Information",
          )
        : null,
      photo && cellPos
        ? React.createElement(ImageInformationSection, {
            key: "ii",
            cellPos,
            photo,
            meta,
            useCount: useCountFor.get(photo.id) ?? 1,
          })
        : null,
    );
  } else if (!allSel) {
    sections.push(
      React.createElement(
        "div",
        { className: "panel-hint", key: "hint" },
        React.createElement(Icon, { n: "layers" }),
        "Drag a photo onto the page edge to float it. Select a frame to add a colored border.",
      ),
    );
  }

  sections.push(
    React.createElement("div", { style: { height: 14 }, key: "sp" }),
    React.createElement(
      "div",
      { className: "section-label", key: "i-l" },
      "Spread " + (active === 0 ? "· Cover" : "· " + active * 2 + "–" + (active * 2 + 1)),
    ),
    React.createElement(
      "div",
      { className: "spread-info", key: "i" },
      infoRow("Template", (templates.find((t) => t.id === spread.templateId) as Template).name),
      infoRow("Photos placed", `${placed} of ${spread.cells.length}`),
      infoRow("Floating images", String((spread.overlays || []).length)),
      infoRow("Page size", pageSize || "—"),
    ),
    React.createElement(
      "div",
      { className: "section-label", key: "sg-l" },
      React.createElement(Icon, { n: "library" }),
      `Spread Grid (${spreads.length})`,
    ),
    React.createElement(SpreadGridSection, {
      key: "sg",
      spreads,
      active,
      photosById,
      onSelect: onSelectSpread,
    }),
  );

  return React.createElement(
    "div",
    { className: "pane-right" },
    React.createElement(
      "div",
      { className: "pane-head" },
      React.createElement("span", { className: "title" }, "Design"),
    ),
    React.createElement("div", { className: "scroll" }, sections),
  );
}
