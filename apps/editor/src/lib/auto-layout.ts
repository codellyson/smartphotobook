import type { Photo, Spread } from "./data";
import { cellsFor, sid } from "./data";

/**
 * Rules-based photobook builder. Sorts photos by capture time, clusters into
 * chapters by time-gap, and walks each chapter picking a template per spread
 * based on the next chunk's photo count + the mix of portrait/landscape
 * orientations.
 *
 * Chapter breaks are introduced when consecutive photos are separated by
 * more than CHAPTER_GAP_MS (default 4 hours). The first spread of each
 * chapter is a hero spread — full-bleed for the landscape hero photo, or an
 * accent layout for portrait — signaling a new section in the book.
 */

/** Time gap (ms) that triggers a chapter break in the auto-layout walk. */
const CHAPTER_GAP_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Sizes of templates available, keyed by id, used to map chunk → template. */
const TEMPLATE_CELL_COUNT: Record<string, number> = {
  full: 1,
  accent: 1,
  duo: 2,
  hero2: 3,
  trip: 3,
  hero3: 4,
  quad: 4,
  pano3: 4,
  six: 6,
};

/** Pick a template that fits exactly `count` photos, biased by orientations. */
function pickTemplate(count: number, photos: Photo[]): string {
  const landscapes = photos.filter((p) => p.orient === "L").length;
  const portraits = photos.filter((p) => p.orient === "P").length;
  if (count === 1) {
    return photos[0].orient === "L" ? "full" : "accent";
  }
  if (count === 2) return "duo";
  if (count === 3) {
    // hero2 = 1 large + 2 small (good for 1 hero shot); trip = 3 equal columns
    return landscapes >= 1 && portraits >= 1 ? "hero2" : "trip";
  }
  if (count === 4) {
    // pano3 = 1 wide top + 3 below; hero3 = 1 large left + 3 stacked right; quad = 4 equal
    if (landscapes >= 2) return "pano3";
    if (landscapes >= 1) return "hero3";
    return "quad";
  }
  return "six";
}

/** Decide how many photos go on the next spread. Cycle through varied sizes
 *  so the book isn't a monotonous run of the same template. */
function nextChunkSize(remaining: number, iter: number): number {
  if (remaining <= 1) return 1;
  if (remaining <= 6) return remaining;
  const cycle = [2, 3, 4, 2, 6, 3, 4];
  return Math.min(remaining, cycle[iter % cycle.length]);
}

/** Split photos into chronological chapters at gaps > CHAPTER_GAP_MS.
 *  Photos without `takenAt` form their own trailing chapter (kept stable). */
function clusterByTime(photos: Photo[]): Photo[][] {
  const dated = photos.filter((p) => p.takenAt !== undefined);
  const undated = photos.filter((p) => p.takenAt === undefined);
  const sorted = [...dated].sort((a, b) => (a.takenAt! - b.takenAt!));
  if (sorted.length === 0) return undated.length ? [undated] : [];
  const chapters: Photo[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].takenAt! - sorted[i - 1].takenAt!;
    if (gap > CHAPTER_GAP_MS) chapters.push([sorted[i]]);
    else chapters[chapters.length - 1].push(sorted[i]);
  }
  if (undated.length) chapters.push(undated);
  return chapters;
}

/** Pick the hero template for a chapter-opening spread, given the lead photo. */
function heroTemplate(photo: Photo): string {
  return photo.orient === "L" ? "full" : "accent";
}

/** Build the spreads for one chapter, starting with a hero spread of its
 *  first photo (unless the chapter has only 1 photo total, in which case the
 *  hero IS the chapter). */
function buildChapter(photos: Photo[]): Spread[] {
  if (photos.length === 0) return [];
  const spreads: Spread[] = [];
  // Hero spread for the chapter opener.
  const hero = photos[0];
  const heroTpl = heroTemplate(hero);
  const heroSlots = cellsFor(heroTpl);
  spreads.push({
    id: sid(),
    templateId: heroTpl,
    cells: heroSlots.map((cell, idx) => ({ ...cell, photoId: idx === 0 ? hero.id : null })),
  });
  // Remaining photos walked normally with varied chunks.
  let i = 1;
  let iter = 0;
  while (i < photos.length) {
    const size = nextChunkSize(photos.length - i, iter);
    const chunk = photos.slice(i, i + size);
    const tplId = pickTemplate(size, chunk);
    if (TEMPLATE_CELL_COUNT[tplId] !== size) {
      console.warn(`auto-layout: template ${tplId} expects ${TEMPLATE_CELL_COUNT[tplId]} cells but chunk has ${size}`);
    }
    const slots = cellsFor(tplId);
    spreads.push({
      id: sid(),
      templateId: tplId,
      cells: slots.map((cell, idx) => ({ ...cell, photoId: chunk[idx]?.id ?? null })),
    });
    i += size;
    iter++;
  }
  return spreads;
}

/**
 * Build a fresh spreads array from a list of photos.
 *
 * Photos with EXIF DateTimeOriginal are clustered into chapters at gaps >
 * 4 hours; each chapter opens with a hero spread (full-bleed for landscape
 * hero, accent for portrait). Photos without capture metadata form a
 * trailing chapter walked in their original order.
 *
 * If the input is empty, returns a single empty Duo spread so the editor
 * always has something to land on.
 */
export function buildBookFromPhotos(photos: Photo[]): Spread[] {
  if (photos.length === 0) {
    return [{ id: sid(), templateId: "duo", cells: cellsFor("duo") }];
  }
  const chapters = clusterByTime(photos);
  const spreads: Spread[] = [];
  for (const chapter of chapters) {
    spreads.push(...buildChapter(chapter));
  }
  return spreads;
}
