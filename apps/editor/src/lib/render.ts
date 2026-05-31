import type { GridPos, Photo, Spread, TextOverlay } from "./data";
import { isTextOverlay, templates } from "./data";

const TPL_COLS = 6;
const TPL_ROWS = 6;

const OV_ASPECT: Record<string, number> = {
  L: 1000 / 700,
  P: 700 / 1000,
  S: 1,
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Imported photos use blob URLs (same-origin); convertFileSrc on desktop
    // also yields same-origin URLs. CORS isn't an issue for real user photos —
    // but flip on anonymous mode for any cross-origin asset we might add later.
    if (!src.startsWith("blob:") && !src.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function gridPxRect(pos: GridPos, contentW: number, contentH: number): { x: number; y: number; w: number; h: number } {
  const colW = contentW / TPL_COLS;
  const rowH = contentH / TPL_ROWS;
  return {
    x: (pos.c1 - 1) * colW,
    y: (pos.r1 - 1) * rowH,
    w: (pos.c2 - pos.c1) * colW,
    h: (pos.r2 - pos.r1) * rowH,
  };
}

function drawCover(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  ox: number,
  oy: number,
  zoom: number,
): void {
  const naturalW = img.naturalWidth || 1;
  const naturalH = img.naturalHeight || 1;
  const coverScale = Math.max(w / naturalW, h / naturalH) * zoom;
  const fittedW = naturalW * coverScale;
  const fittedH = naturalH * coverScale;
  const offsetX = -(fittedW - w) * (ox / 100);
  const offsetY = -(fittedH - h) * (oy / 100);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + offsetX, y + offsetY, fittedW, fittedH);
  ctx.restore();
}

function drawFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  width: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.strokeRect(x + width / 2, y + width / 2, w - width, h - width);
}

/** Wrap `text` into lines that fit within `maxWidth`. */
function wrapTextLines(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    if (!paragraph) {
      out.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const next = line ? line + " " + word : word;
      if (ctx.measureText(next).width <= maxWidth) {
        line = next;
      } else {
        if (line) out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function drawTextOverlay(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  ov: TextOverlay,
  widthPx: number,
  heightPx: number,
  bleedPx: number,
  borderScale: number,
): void {
  // Convert font size from on-screen points to canvas pixels.
  // The screen renders at ~96 DPI; borderScale maps that to canvas DPI.
  const fontPx = ov.fontSize * borderScale * (96 / 72);
  const family = ov.fontFamily.replace(/"/g, "'");
  const weight = ov.weight === "bold" ? "700" : "400";
  const style = ov.italic ? "italic" : "normal";
  ctx.font = `${style} ${weight} ${fontPx}px ${family}`;
  ctx.fillStyle = ov.color;
  ctx.textBaseline = "top";
  ctx.textAlign = ov.align;

  const boxW = (ov.wPct / 100) * widthPx;
  const lines = wrapTextLines(ctx, ov.text, boxW);
  const lineHeight = fontPx * 1.2;
  const totalH = Math.max(lineHeight, lines.length * lineHeight);
  const centerX = bleedPx + (ov.xPct / 100) * widthPx;
  const centerY = bleedPx + (ov.yPct / 100) * heightPx;
  const top = centerY - totalH / 2;
  const anchorX = ov.align === "left" ? centerX - boxW / 2 : ov.align === "right" ? centerX + boxW / 2 : centerX;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], anchorX, top + i * lineHeight, boxW);
  }
}

export type RenderSpreadOpts = {
  /** trim width in px */
  widthPx: number;
  /** trim height in px */
  heightPx: number;
  /** page inset in px (matches `--margin` on screen) */
  paddingPx: number;
  /** extra bleed extending all sides in px */
  bleedPx: number;
  /** frame and overlay border scale factor (1 = on-screen 1px → 1 canvas px). Defaults to dpi/96. */
  borderScale?: number;
  jpegQuality?: number;
};

export async function renderSpreadToJpeg(
  spread: Spread,
  photosById: Record<string, Photo>,
  opts: RenderSpreadOpts,
): Promise<Uint8Array> {
  const { widthPx, heightPx, paddingPx, bleedPx, borderScale = 1, jpegQuality = 0.92 } = opts;
  const totalW = widthPx + bleedPx * 2;
  const totalH = heightPx + bleedPx * 2;

  // Prefer OffscreenCanvas where available (web workers in the future); fall
  // back to a detached <canvas> otherwise.
  const canvas: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(totalW, totalH)
      : Object.assign(document.createElement("canvas"), { width: totalW, height: totalH });
  const ctx = (canvas as HTMLCanvasElement).getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Page color extends through bleed.
  ctx.fillStyle = spread.pageColor || "#f7f3ee";
  ctx.fillRect(0, 0, totalW, totalH);

  const contentX = bleedPx + paddingPx;
  const contentY = bleedPx + paddingPx;
  const contentW = widthPx - paddingPx * 2;
  const contentH = heightPx - paddingPx * 2;

  const tpl = templates.find((t) => t.id === spread.templateId);
  if (tpl) {
    // dice (one photo split into rows×cols) — render the photo across the full content area
    // (the screen renderer adds gutter lines; we approximate as a single fill for press output).
    const dice = spread.dice ?? (spread.dicePhotoId ? { photoId: spread.dicePhotoId, rows: 1, cols: 3 } : null);
    if (dice && photosById[dice.photoId]) {
      const photo = photosById[dice.photoId];
      try {
        const img = await loadImage(photo.src);
        drawCover(ctx, img, contentX, contentY, contentW, contentH, 50, 50, 1);
      } catch {
        /* image failed — leave blank */
      }
    } else {
      // cells
      for (let i = 0; i < spread.cells.length; i++) {
        const cell = spread.cells[i];
        if (!cell.photoId) continue;
        const photo = photosById[cell.photoId];
        if (!photo) continue;
        const pos = tpl.cells[i];
        if (!pos) continue;
        const r = gridPxRect(pos, contentW, contentH);
        const cx = contentX + r.x;
        const cy = contentY + r.y;
        try {
          const img = await loadImage(photo.src);
          drawCover(ctx, img, cx, cy, r.w, r.h, cx === 0 ? cell.ox : cell.ox, cell.oy, cell.zoom);
          if (cell.frame && cell.frame.w) {
            drawFrame(ctx, cx, cy, r.w, r.h, cell.frame.w * borderScale, cell.frame.color);
          }
        } catch {
          /* image failed — leave cell blank */
        }
      }
    }
  }

  // overlays sit above cells
  for (const ov of spread.overlays || []) {
    if (isTextOverlay(ov)) {
      drawTextOverlay(ctx, ov, widthPx, heightPx, bleedPx, borderScale);
      continue;
    }
    const photo = photosById[ov.photoId];
    if (!photo) continue;
    const ovW = (ov.wPct / 100) * widthPx;
    const aspect = OV_ASPECT[photo.orient] || 1;
    const ovH = ovW / aspect;
    const centerX = bleedPx + (ov.xPct / 100) * widthPx;
    const centerY = bleedPx + (ov.yPct / 100) * heightPx;
    const x = centerX - ovW / 2;
    const y = centerY - ovH / 2;
    try {
      const img = await loadImage(photo.src);
      drawCover(ctx, img, x, y, ovW, ovH, 50, 50, 1);
      if (ov.frame && ov.frame.w) {
        drawFrame(ctx, x, y, ovW, ovH, ov.frame.w * borderScale, ov.frame.color);
      }
    } catch {
      /* image failed — skip overlay */
    }
  }

  const blob: Blob =
    canvas instanceof OffscreenCanvas
      ? await canvas.convertToBlob({ type: "image/jpeg", quality: jpegQuality })
      : await new Promise<Blob>((resolve, reject) =>
          (canvas as HTMLCanvasElement).toBlob(
            (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
            "image/jpeg",
            jpegQuality,
          ),
        );
  return new Uint8Array(await blob.arrayBuffer());
}

export type RenderAlbumOpts = {
  pageWidthMm: number;
  pageHeightMm: number;
  bleedMm: number;
  dpi: number;
  paddingPx: number;
  jpegQuality?: number;
  onProgress?: (done: number, total: number) => void;
};

export type RenderedAlbum = {
  jpegs: Uint8Array[];
  /** width of a *spread* in mm (two pages side by side) */
  spreadWidthMm: number;
  spreadHeightMm: number;
  bleedMm: number;
};

const MM_PER_INCH = 25.4;

/** Render every spread to a JPEG, ready to drop into a PDF. */
export async function renderAlbum(
  spreads: Spread[],
  photosById: Record<string, Photo>,
  opts: RenderAlbumOpts,
): Promise<RenderedAlbum> {
  const inchesPerMm = 1 / MM_PER_INCH;
  // Each spread shows two facing pages — total page (trim) width = 2 × page width.
  const spreadWidthMm = opts.pageWidthMm * 2;
  const spreadHeightMm = opts.pageHeightMm;

  const widthPx = Math.round(spreadWidthMm * inchesPerMm * opts.dpi);
  const heightPx = Math.round(spreadHeightMm * inchesPerMm * opts.dpi);
  const bleedPx = Math.round(opts.bleedMm * inchesPerMm * opts.dpi);

  const jpegs: Uint8Array[] = [];
  for (let i = 0; i < spreads.length; i++) {
    opts.onProgress?.(i, spreads.length);
    const jpeg = await renderSpreadToJpeg(spreads[i], photosById, {
      widthPx,
      heightPx,
      paddingPx: opts.paddingPx,
      bleedPx,
      borderScale: opts.dpi / 96,
      jpegQuality: opts.jpegQuality ?? 0.92,
    });
    jpegs.push(jpeg);
  }
  opts.onProgress?.(spreads.length, spreads.length);

  return { jpegs, spreadWidthMm, spreadHeightMm, bleedMm: opts.bleedMm };
}

/** Parse `"12 × 12\""` → `{ wInches: 12, hInches: 12 }`. */
export function parseTrimSize(label: string): { wInches: number; hInches: number } {
  const m = label.match(/(\d+(?:\.\d+)?)\s*[×x*]\s*(\d+(?:\.\d+)?)/);
  if (!m) return { wInches: 12, hInches: 12 };
  return { wInches: parseFloat(m[1]), hInches: parseFloat(m[2]) };
}

export function trimSizeToMm(label: string): { wMm: number; hMm: number } {
  const { wInches, hInches } = parseTrimSize(label);
  return { wMm: wInches * MM_PER_INCH, hMm: hInches * MM_PER_INCH };
}
