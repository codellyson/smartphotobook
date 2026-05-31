
import React from "react";
import type { Photo, ProjectMeta } from "@/lib/data";
import { HeartIcon, Icon } from "./icons";

type LibraryProps = {
  photos: Photo[];
  usedIds: Set<string>;
  onToggleFav: (id: string) => void;
  onSort: () => void;
  sort: "story" | "fav";
  sel: Set<string>;
  toggleSel: (id: string) => void;
  meta: ProjectMeta;
};

export function Library({ photos, usedIds, onToggleFav, onSort, sort, sel, toggleSel, meta }: LibraryProps) {
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
    { className: "library" },
    React.createElement(
      "div",
      { className: "lib-head" },
      React.createElement(
        "div",
        null,
        React.createElement(
          "h1",
          null,
          [meta.couple, meta.title].filter(Boolean).join(" — ") || "Untitled album",
        ),
        React.createElement(
          "div",
          { className: "sub" },
          [
            meta.date,
            meta.venue,
            `${photos.length} photos`,
            `${usedIds.size} used in album`,
          ]
            .filter(Boolean)
            .join(" · "),
        ),
      ),
      React.createElement(
        "div",
        { className: "lib-tools" },
        React.createElement(
          "button",
          { className: "btn", onClick: onSort },
          React.createElement(Icon, { n: "sort" }),
          sort === "story" ? "Story order" : "Favorites first",
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "lib-grid" },
      photos.map((p) =>
        React.createElement(
          "div",
          {
            key: p.id,
            className: "lib-card" + (usedIds.has(p.id) ? " used" : "") + (sel.has(p.id) ? " sel" : ""),
            draggable: true,
            onClick: () => toggleSel(p.id),
            onDragStart: (e: React.DragEvent) => startDrag(e, p.id),
          },
          React.createElement("img", { src: p.src, alt: p.cap }),
          React.createElement("div", { className: "ov" }),
          React.createElement("div", { className: "selmark" }, React.createElement(Icon, { n: "check" })),
          React.createElement("span", { className: "usedtag" }, "In album"),
          React.createElement(
            "button",
            {
              className: "heart" + (p.fav ? " on" : ""),
              onClick: (e: React.MouseEvent) => { e.stopPropagation(); onToggleFav(p.id); },
            },
            React.createElement(HeartIcon, null),
          ),
          React.createElement(
            "div",
            { className: "meta" },
            React.createElement("div", { className: "c" }, p.cap),
          ),
        ),
      ),
    ),
  );
}
