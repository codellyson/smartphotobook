
import React, { useRef, useState } from "react";
import type { Overlay, Photo, Frame, TextOverlay } from "@/lib/data";
import { isTextOverlay } from "@/lib/data";
import { Icon } from "./icons";

export const OV_ASPECT: Record<string, number> = {
  L: 1000 / 700,
  P: 700 / 1000,
  S: 1,
};

export const PAGE_COLORS = [
  { name: "Paper", v: "#f7f3ee" },
  { name: "White", v: "#ffffff" },
  { name: "Bone",  v: "#ece3d2" },
  { name: "Blush", v: "#f1e0db" },
  { name: "Sage",  v: "#dde4d7" },
  { name: "Slate", v: "#2b2d33" },
  { name: "Ink",   v: "#16151a" },
];

export const FRAME_COLORS = ["#ffffff", "#16151a", "#c9a86a", "#b08d57", "#8a8f98", "#f3e1dc"];

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

type OverlayItemProps = {
  ov: Overlay;
  photo: Photo | null;
  selected: boolean;
  editable: boolean;
  spreadRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onMove: (id: string, xPct: number, yPct: number) => void;
  onScale: (id: string, wPct: number) => void;
  onReplace: (id: string, pid: string) => void;
  onRemove: (id: string) => void;
  onSnapChange?: (snap: { h: boolean; v: boolean }) => void;
};

const SNAP_THRESHOLD_PCT = 1.4; // distance from center at which to snap

export function OverlayItem({ ov, photo, selected, editable, spreadRef, onSelect, onMove, onScale, onReplace, onRemove, onSnapChange }: OverlayItemProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; y: number; sx: number; sy: number; w: number; h: number } | null>(null);
  const res = useRef<{ x: number; sw: number; w: number } | null>(null);
  const [over, setOver] = useState(false);

  const isText = isTextOverlay(ov);
  const text = isText ? (ov as TextOverlay) : null;
  const aspect = isText ? "auto" : String(photo ? OV_ASPECT[photo.orient] || 1 : 1);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable) return;
    const target = e.target as HTMLElement;
    if (target.closest(".ov-handle") || target.closest("button") || target.closest("textarea")) return;
    e.stopPropagation();
    onSelect(ov.id);
    const sr = spreadRef.current?.getBoundingClientRect();
    if (!sr) return;
    drag.current = { x: e.clientX, y: e.clientY, sx: ov.xPct, sy: ov.yPct, w: sr.width, h: sr.height };
    elRef.current?.setPointerCapture(e.pointerId);
  };
  const onMoveP = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      const d = drag.current;
      let x = clamp(d.sx + ((e.clientX - d.x) / d.w) * 100, 2, 98);
      let y = clamp(d.sy + ((e.clientY - d.y) / d.h) * 100, 2, 98);
      const snapH = Math.abs(x - 50) < SNAP_THRESHOLD_PCT;
      const snapV = Math.abs(y - 50) < SNAP_THRESHOLD_PCT;
      if (snapH) x = 50;
      if (snapV) y = 50;
      onSnapChange?.({ h: snapH, v: snapV });
      onMove(ov.id, x, y);
    } else if (res.current) {
      const r = res.current;
      onScale(ov.id, clamp(r.sw + ((e.clientX - r.x) / r.w) * 100, 8, 96));
    }
  };
  const onUp = () => {
    drag.current = null;
    res.current = null;
    onSnapChange?.({ h: false, v: false });
  };

  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const sr = spreadRef.current?.getBoundingClientRect();
    if (!sr) return;
    res.current = { x: e.clientX, sw: ov.wPct, w: sr.width };
    elRef.current?.setPointerCapture(e.pointerId);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    const pid = e.dataTransfer.getData("sa/photo");
    if (pid && !isText) onReplace(ov.id, pid);
  };

  const frame = !isText ? (ov as Exclude<Overlay, TextOverlay>).frame : undefined;
  const style: React.CSSProperties = {
    left: ov.xPct + "%",
    top: ov.yPct + "%",
    width: ov.wPct + "%",
    aspectRatio: aspect,
    transform: "translate(-50%,-50%)",
    border: frame && frame.w ? `${frame.w}px solid ${frame.color}` : undefined,
  };

  const body = isText
    ? React.createElement(
        "div",
        {
          className: "overlay-text-body",
          style: {
            fontFamily: text!.fontFamily,
            fontSize: text!.fontSize + "pt",
            color: text!.color,
            textAlign: text!.align,
            fontWeight: text!.weight ?? "normal",
            fontStyle: text!.italic ? "italic" : "normal",
            letterSpacing: text!.letterSpacing ?? 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          },
        },
        text!.text || (editable ? "Type your text…" : ""),
      )
    : photo
      ? React.createElement("img", { src: photo.src, alt: photo.cap, draggable: false })
      : null;

  return React.createElement(
    "div",
    {
      ref: elRef,
      className:
        "overlay" +
        (isText ? " text" : "") +
        (selected ? " on" : "") +
        (editable ? " editable" : "") +
        (over ? " over" : ""),
      style,
      onPointerDown: onDown,
      onPointerMove: onMoveP,
      onPointerUp: onUp,
      onPointerCancel: onUp,
      onClick: editable ? (e: React.MouseEvent) => { e.stopPropagation(); onSelect(ov.id); } : undefined,
      onDragOver: editable && !isText ? (e: React.DragEvent) => { e.preventDefault(); setOver(true); } : undefined,
      onDragLeave: () => setOver(false),
      onDrop: editable && !isText ? handleDrop : undefined,
    },
    body,
    editable && selected
      ? React.createElement(
          "button",
          { className: "ov-del", title: "Remove", onClick: (e: React.MouseEvent) => { e.stopPropagation(); onRemove(ov.id); } },
          React.createElement(Icon, { n: "trash" }),
        )
      : null,
    editable && selected
      ? React.createElement("div", { className: "ov-handle", title: "Drag to scale", onPointerDown: startResize })
      : null,
  );
}

type OverlayDropCatcherProps = {
  spreadRef: React.RefObject<HTMLDivElement | null>;
  onAdd: (pid: string, xPct: number, yPct: number) => void;
};

export function OverlayDropCatcher({ spreadRef, onAdd }: OverlayDropCatcherProps) {
  const [over, setOver] = useState(false);
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    const pid = e.dataTransfer.getData("sa/photo");
    if (!pid) return;
    const sr = spreadRef.current?.getBoundingClientRect();
    if (!sr) return;
    onAdd(pid, clamp(((e.clientX - sr.left) / sr.width) * 100, 6, 94), clamp(((e.clientY - sr.top) / sr.height) * 100, 6, 94));
  };
  return React.createElement(
    "div",
    {
      className: "overlay-drop" + (over ? " over" : ""),
      onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(true); },
      onDragLeave: () => setOver(false),
      onDrop,
    },
    over ? React.createElement("span", { className: "overlay-drop-hint" }, React.createElement(Icon, { n: "layers" }), "Drop here to float") : null,
  );
}

export type OverlayHandlers = {
  onSelectOverlay: (id: string) => void;
  onMoveOverlay: (id: string, xPct: number, yPct: number) => void;
  onScaleOverlay: (id: string, wPct: number) => void;
  onReplaceOverlay: (id: string, pid: string) => void;
  onRemoveOverlay: (id: string) => void;
};

type OverlayLayerProps = {
  overlays: Overlay[] | undefined;
  photosById: Record<string, Photo>;
  editable: boolean;
  selId: string | null;
  spreadRef: React.RefObject<HTMLDivElement | null>;
  handlers: OverlayHandlers;
};

export function OverlayLayer({ overlays, photosById, editable, selId, spreadRef, handlers }: OverlayLayerProps) {
  const [snap, setSnap] = useState<{ h: boolean; v: boolean }>({ h: false, v: false });
  if (!overlays || !overlays.length) return null;
  return React.createElement(
    "div",
    { className: "overlay-layer" },
    snap.h
      ? React.createElement("div", { className: "snap-guide v", "aria-hidden": "true" })
      : null,
    snap.v
      ? React.createElement("div", { className: "snap-guide h", "aria-hidden": "true" })
      : null,
    overlays.map((ov) => {
      let p: Photo | null = null;
      if (!isTextOverlay(ov)) {
        p = photosById[ov.photoId] ?? null;
        if (!p) return null;
      }
      return React.createElement(OverlayItem, {
        key: ov.id,
        ov,
        photo: p,
        editable,
        selected: editable && selId === ov.id,
        spreadRef,
        onSelect: handlers.onSelectOverlay,
        onMove: handlers.onMoveOverlay,
        onScale: handlers.onScaleOverlay,
        onReplace: handlers.onReplaceOverlay,
        onRemove: handlers.onRemoveOverlay,
        onSnapChange: setSnap,
      });
    }),
  );
}

// Re-export Frame so designer can import from one place if it wants.
export type { Frame };
