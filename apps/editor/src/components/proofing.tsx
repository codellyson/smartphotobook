
import React, { useEffect, useState } from "react";
import type { Photo, ProjectMeta, Spread } from "@/lib/data";
import { HeartIcon, Icon } from "./icons";
import { SpreadView, type DesignerHandlers } from "./designer";

type ProofingProps = {
  spreads: Spread[];
  photosById: Record<string, Photo>;
  favSpreads: Set<string>;
  onToggleFavSpread: (id: string) => void;
  onExport: () => void;
  meta: ProjectMeta;
};

const noHandlers: DesignerHandlers = {
  onSelect: () => {},
  onDropContent: () => {},
  onRemove: () => {},
  onRecenter: () => {},
  onZoom: () => {},
  onPan: () => {},
  onStartDrag: () => {},
  onCrop: () => {},
  onDice: () => {},
  onClearDice: () => {},
  onRepattern: () => {},
  onDiceSwap: () => {},
  onSetBg: () => {},
  onSetCellFrame: () => {},
  onSetAllFrames: () => {},
  onSetPad: () => {},
  onSelectOverlay: () => {},
  onMoveOverlay: () => {},
  onScaleOverlay: () => {},
  onReplaceOverlay: () => {},
  onRemoveOverlay: () => {},
  onSetOverlayFrame: () => {},
  onUpdateTextOverlay: () => {},
};

export function Proofing({ spreads, photosById, favSpreads, onToggleFavSpread, onExport, meta }: ProofingProps) {
  const [i, setI] = useState(0);
  const clamped = Math.min(i, spreads.length - 1);
  const sp = spreads[clamped];

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((v) => Math.min(v + 1, spreads.length - 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(v - 1, 0));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [spreads.length]);

  const faved = favSpreads.has(sp.id);

  return React.createElement(
    "div",
    { className: "proof" },
    React.createElement(
      "div",
      { className: "proof-top" },
      React.createElement(
        "div",
        { className: "who" },
        meta.title || "Untitled album",
        React.createElement(
          "span",
          null,
          [meta.date, "Preview"].filter(Boolean).join(" · "),
        ),
      ),
      React.createElement(
        "div",
        { style: { display: "flex", gap: 10 } },
        React.createElement(
          "button",
          { className: "btn", onClick: onExport },
          React.createElement(Icon, { n: "download" }),
          "Download proof",
        ),
        React.createElement(
          "button",
          { className: "btn primary" },
          React.createElement(Icon, { n: "share" }),
          "Approve album",
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "proof-stage" },
      React.createElement(
        "button",
        { className: "proof-nav prev", disabled: clamped === 0, onClick: () => setI(clamped - 1) },
        React.createElement(Icon, { n: "chevL" }),
      ),
      React.createElement(
        "div",
        { className: "proof-spread-wrap" },
        React.createElement(SpreadView, {
          spread: sp,
          photosById,
          editable: false,
          selectedIdx: -1,
          selOverlay: null,
          handlers: noHandlers,
          className: "proof-spread",
        }),
      ),
      React.createElement(
        "button",
        {
          className: "proof-nav next",
          disabled: clamped === spreads.length - 1,
          onClick: () => setI(clamped + 1),
        },
        React.createElement(Icon, { n: "chevR" }),
      ),
    ),
    React.createElement(
      "div",
      { className: "proof-bottom" },
      React.createElement(
        "div",
        { className: "proof-dots" },
        spreads.map((s, k) =>
          React.createElement("div", {
            key: s.id,
            className: "d" + (k === clamped ? " on" : ""),
            onClick: () => setI(k),
          }),
        ),
      ),
      React.createElement(
        "button",
        {
          className: "btn" + (faved ? " primary" : ""),
          onClick: () => onToggleFavSpread(sp.id),
          style: faved ? {} : { color: "#e8607a", borderColor: "rgba(232,96,122,0.4)" },
        },
        React.createElement(HeartIcon, null),
        faved ? "Loved this spread" : "Love this spread",
      ),
    ),
  );
}
