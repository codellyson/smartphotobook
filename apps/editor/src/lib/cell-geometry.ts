import type { GridPos } from "./data";

/**
 * Map a cell's grid position to its real printed size on the spread.
 *
 * The template grid is 6 columns × 6 rows across the whole spread (two
 * pages). Column index 4 is the gutter line. Cells reference c1..c2 / r1..r2
 * with values 1..7 (1-indexed grid lines).
 *
 * Doesn't account for the page-margin inset (--margin CSS variable) — that
 * shrinks the grid uniformly from each spread edge. PPI numbers reported
 * here are slightly optimistic vs. the real printed cell, but close enough
 * to flag "this photo is too low-res for this frame."
 */

const MM_PER_INCH = 25.4;
const COLS = 6;
const ROWS = 6;

export type CellPhysicalSize = {
  wMm: number;
  hMm: number;
  wInches: number;
  hInches: number;
};

export function cellPhysicalSize(
  cellPos: GridPos,
  trim: { wMm: number; hMm: number },
): CellPhysicalSize {
  const spreadWMm = trim.wMm * 2;
  const wMm = spreadWMm * ((cellPos.c2 - cellPos.c1) / COLS);
  const hMm = trim.hMm * ((cellPos.r2 - cellPos.r1) / ROWS);
  return {
    wMm,
    hMm,
    wInches: wMm / MM_PER_INCH,
    hInches: hMm / MM_PER_INCH,
  };
}

/**
 * Effective PPI of a cover-fit photo placed in a cell of given printed
 * inches. Cover-fit scales the photo so the cell is fully covered (cropping
 * the other dimension); the resulting PPI is uniform in both directions and
 * equal to the smaller of (photoW/cellW, photoH/cellH).
 *
 * Returns floor for display; downstream UI may color-code:
 *   >= 250 PPI : green (print-ready)
 *   150-249    : amber (passable, not ideal)
 *   < 150      : red (visibly soft at print)
 */
export function effectivePPI(
  photoWidthPx: number,
  photoHeightPx: number,
  cellWInches: number,
  cellHInches: number,
): number {
  if (cellWInches <= 0 || cellHInches <= 0) return 0;
  return Math.floor(Math.min(photoWidthPx / cellWInches, photoHeightPx / cellHInches));
}

export type PPIBand = "good" | "ok" | "poor";

export function ppiBand(ppi: number): PPIBand {
  if (ppi >= 250) return "good";
  if (ppi >= 150) return "ok";
  return "poor";
}
