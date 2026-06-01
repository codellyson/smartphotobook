import type { Orient, Photo, PhotoSource } from "../data";

export function baseName(p: string): string {
  const s = String(p).split(/[\\/]/).pop() || "Photo";
  return s.replace(/\.[^.]+$/, "");
}

export function orientOf(w: number, h: number): Orient {
  const r = w / h;
  return r > 1.15 ? "L" : r < 0.87 ? "P" : "S";
}

let _seq = 0;
export function mkPhoto(args: {
  cap: string;
  w: number;
  h: number;
  src: string;
  source: PhotoSource;
}): Photo {
  return {
    id: "u" + Date.now().toString(36) + _seq++,
    cap: args.cap || "Photo",
    orient: orientOf(args.w, args.h),
    source: args.source,
    src: args.src,
    imported: true,
    widthPx: args.w,
    heightPx: args.h,
  };
}

/** Probe an image's natural dimensions, then build a Photo. */
export function probe(src: string, cap: string, source: PhotoSource): Promise<Photo> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve(mkPhoto({ cap, w: img.naturalWidth || 1, h: img.naturalHeight || 1, src, source }));
    img.onerror = () => resolve(mkPhoto({ cap, w: 1, h: 1, src, source }));
    img.src = src;
  });
}

/** Chunked base64 encoder safe for big Uint8Arrays (avoids fromCharCode arg ceiling). */
export function toBase64(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as unknown as number[]);
  }
  return btoa(s);
}
