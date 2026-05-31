
import React, { useCallback, useRef, useState } from "react";

const P = (d: string, extra?: Record<string, unknown>) =>
  React.createElement(
    "path",
    Object.assign(
      { d, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" },
      extra || {},
    ),
  );

export const ICONS: Record<string, string[]> = {
  designer: ["M3 5h18v14H3z", "M12 5v14"],
  library:  ["M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"],
  proof:    ["M3 4h18v12H3zM8 20h8M12 16v4"],
  wand:     ["M15 4V2M15 10V8M19 6h2M11 6h-1M18 9l1.5 1.5M11.5 1.5L13 3", "M3 21l11-11 2 2L5 23z"],
  share:    ["M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7", "M16 6l-4-4-4 4M12 2v13"],
  plus:     ["M12 5v14M5 12h14"],
  search:   ["M11 11m-7 0a7 7 0 1014 0a7 7 0 10-14 0M20 20l-3.5-3.5"],
  check:    ["M5 12l5 5L20 6"],
  trash:    ["M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"],
  recenter: ["M12 8v8M8 12h8", "M4 9V5a1 1 0 011-1h4M20 9V5a1 1 0 00-1-1h-4M4 15v4a1 1 0 001 1h4M20 15v4a1 1 0 01-1 1h-4"],
  zoom:     ["M11 11m-6 0a6 6 0 1012 0a6 6 0 10-12 0M20 20l-3-3M11 8v6M8 11h6"],
  chevL:    ["M15 18l-6-6 6-6"],
  chevR:    ["M9 18l6-6-6-6"],
  heart:    ["M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20z"],
  x:        ["M6 6l12 12M18 6L6 18"],
  image:    ["M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6", "M8.5 9.5m-1.5 0a1.5 1.5 0 103 0a1.5 1.5 0 10-3 0"],
  sliders:  ["M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4", "M14 6m-2 0a2 2 0 104 0a2 2 0 10-4 0M6 12m-2 0a2 2 0 104 0a2 2 0 10-4 0M12 18m-2 0a2 2 0 104 0a2 2 0 10-4 0"],
  download: ["M12 3v12M7 11l5 5 5-5M5 21h14"],
  sort:     ["M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l3 3M17 20l-3-3"],
  crop:     ["M7 3v13a2 2 0 002 2h13", "M3 7h13a2 2 0 012 2v13"],
  dice:     ["M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"],
  layers:   ["M12 3l9 5-9 5-9-5 9-5z", "M3 14l9 5 9-5"],
  frame:    ["M3 3h18v18H3zM7 7h10v10H7z"],
  expand:   ["M9 3H5a2 2 0 00-2 2v4M15 3h4a2 2 0 012 2v4M21 15v4a2 2 0 01-2 2h-4M3 15v4a2 2 0 002 2h4"],
  paint:    ["M19 3H5a2 2 0 00-2 2v6h18V5a2 2 0 00-2-2zM3 11v3a2 2 0 002 2h5v3a2 2 0 002 2 2 2 0 002-2v-5H3z"],
};

export function Icon({ n, style }: { n: string; style?: React.CSSProperties }) {
  const ds = ICONS[n] || [];
  return React.createElement(
    "svg",
    { viewBox: "0 0 24 24", style },
    ds.map((d, i) => P(d, { key: i })),
  );
}

export function HeartIcon() {
  return React.createElement("svg", { viewBox: "0 0 24 24" }, P(ICONS.heart[0]));
}

export function useToast(): [string | null, (m: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(null), 2200);
  }, []);
  return [msg, show];
}
