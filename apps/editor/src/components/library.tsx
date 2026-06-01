
import React from "react";
import type { Photo, ProjectMeta } from "@/lib/data";
import { Platform } from "@/lib/platform";
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
  onImport?: () => void;
};

export function Library({ photos, usedIds, onToggleFav, onSort, sort, sel, toggleSel, meta, onImport }: LibraryProps) {
  const startDrag = (e: React.DragEvent, id: string) => {
    if (sel.has(id) && sel.size > 1) {
      e.dataTransfer.setData("sa/photos", JSON.stringify([...sel]));
      e.dataTransfer.effectAllowed = "copy";
    } else {
      e.dataTransfer.setData("sa/photo", id);
      e.dataTransfer.effectAllowed = "copy";
    }
  };
  const isEmpty = photos.length === 0;
  const importLabel = Platform.isDesktop ? "Import from library" : "Import photos";
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
          meta.title || "Untitled album",
        ),
        React.createElement(
          "div",
          { className: "sub" },
          [
            meta.date,
            meta.venue,
            isEmpty ? null : `${photos.length} photos`,
            isEmpty ? null : `${usedIds.size} used in album`,
          ]
            .filter(Boolean)
            .join(" · "),
        ),
      ),
      React.createElement(
        "div",
        { className: "lib-tools" },
        onImport
          ? React.createElement(
              "button",
              { className: "btn", onClick: onImport, title: importLabel },
              React.createElement(Icon, { n: "plus" }),
              importLabel,
            )
          : null,
        !isEmpty
          ? React.createElement(
              "button",
              { className: "btn", onClick: onSort },
              React.createElement(Icon, { n: "sort" }),
              sort === "story" ? "Story order" : "Favorites first",
            )
          : null,
      ),
    ),
    isEmpty
      ? React.createElement(
          "div",
          { className: "lib-empty" },
          React.createElement(
            "div",
            { className: "lib-empty-mark" },
            React.createElement(Icon, { n: "image" }),
          ),
          React.createElement("h2", null, "No photos yet"),
          React.createElement(
            "p",
            null,
            "Import photos to build your library. They'll show up here, ready to drag into spreads.",
          ),
          onImport
            ? React.createElement(
                "button",
                { className: "btn primary", onClick: onImport },
                React.createElement(Icon, { n: "plus" }),
                importLabel,
              )
            : null,
        )
      : React.createElement(
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
