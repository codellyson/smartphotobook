# SmartPhotobook — implementation phases

SmartPhotobook is **local-first**. Photographers edit on their machine; the cloud
is opt-in and exists only to mint client-proofing links. Phases 1–6 ship a
sellable desktop product on their own. Phase 7 unlocks proofing.

Each phase has a single "done" criterion you can demo end-to-end.

---

## Phase 1 — Durable local photo storage

**Problem.** Imported photos use `URL.createObjectURL(blob)` and die on reload.
The photo metadata persists in `localStorage` but its `src` points at a dead
blob URL, so the tray fills with broken images.

**Work.**

- Add `lib/photo-store.ts`: thin IndexedDB wrapper exposing `putBlob(id, blob, meta)`,
  `getBlob(id)`, `getAllBlobs()`, `deleteBlob(id)`.
- Update `Platform.importPhotos`: persist each file's `Blob` to IndexedDB
  under the new photo id alongside its meta (name, last-modified).
- Don't write `src` URLs into `localStorage` — they're per-session.
- On app mount, read IndexedDB → recreate `URL.createObjectURL` for every
  photo → patch `photos[].src` before first render.

**Done when.** Import a photo, hard-reload, photo is still in the tray and renders.

---

## Phase 2 — Tauri desktop wrapper, actually working

**Problem.** The Tauri scaffold under `src-tauri/` exists but `lib/platform.ts`
was stripped of its Tauri branches in the Next.js migration, and
`tauri.conf.json` still points `frontendDist` at the project root rather than
Next.js's static-export output.

**Work.**

- Re-add `window.__TAURI__` detection in `lib/platform.ts`. Fork at runtime:
  - `loadState`/`saveState` → `fs.readTextFile`/`writeTextFile` on `album.json`
    in `BaseDirectory.AppData`.
  - `importPhotos` → `dialog.open` + `convertFileSrc` for real file paths
    (no IndexedDB blob copy on desktop — originals stay on disk).
  - `exportAlbum` → `dialog.save` → invoke Rust command (Phase 5 fills it in).
- Add `output: 'export'` to `next.config.ts` (gated behind an env flag so
  `next dev` still works on web).
- Point `src-tauri/tauri.conf.json` `frontendDist` at `out/`.
- Generate icons (`pnpm tauri icon <logo>`).

**Done when.** `pnpm tauri:dev` opens a native window, the designer works, and
`album.json` is written into `AppData/` on save.

---

## Phase 3 — Multi-project index + home screen

**Problem.** The app assumes exactly one album. A working photographer has
dozens of weddings.

**Work.**

- Promote the single `album.json` to a `projects/<id>/album.json` layout on
  desktop, and a per-project key in IndexedDB on web.
- Add `lib/projects.ts`: list/create/duplicate/delete project; each entry
  carries `{ id, name, lastEditedAt, coverThumbnail }`.
- New route `/` (replacing the marketing landing for the desktop build): grid
  of project cards. Web build keeps `/` as marketing, with `/projects` as the
  authenticated equivalent (eventually).
- Project switcher in the topbar.

**Done when.** Create three projects, switch between them, each preserves its
own spreads and photos independently.

---

## Phase 4 — Project metadata edit UI + undo/redo

**Problem.** `couple`, `title`, `date`, `venue`, `size`, `pages` are write-only
via `lib/data.ts`. No way to edit album info from the UI. And there's no undo
stack — a misclick is permanent.

**Work.**

- Settings panel: edit metadata fields with inline validation. `pages` must be
  ≥ spreads × 2 (or guide the user to add/remove spreads to match).
- History stack: every mutation in `components/app.tsx` flows through a
  reducer that records a snapshot. Drag operations group into a single entry
  via a `withTransaction` helper.
- `cmd/ctrl-Z` and `cmd/ctrl-shift-Z` shortcuts.
- Persist the *last 50 snapshots* with the album so undo survives a reload.

**Done when.** Edit metadata persists across reload; cmd-Z reverts the last
edit; a drag-from-tray-to-cell counts as one undo, not 60 pan events.

---

## Phase 5 — Real PDF export (desktop Rust path)

**Problem.** `window.print` is the only export today. Print labs reject it.

**Work.**

- JS side: render each spread to a JPEG (Canvas API or html2canvas
  equivalent) at the configured DPI plus bleed.
- Pass `{ spread_jpegs: Vec<Vec<u8>>, page_size_mm, bleed_mm }` to the Rust
  command `export_album_pdf`.
- Rust side (`src-tauri/src/main.rs`): use `printpdf` to assemble the PDF,
  embed JPEGs at the correct size, draw bleed marks, embed an ICC profile.
- Web fallback: client-side `pdf-lib` produces a "preview PDF" (not press-ready).

**Done when.** Export a 7-spread album, open the resulting PDF in Preview,
bleed marks present, pages at the correct trim size.

---

## Phase 6 — Designer feature catch-up

**Problem.** The current designer is enough to demo but not enough to ship.

**Work** (in order of how often each gap would bite a real user):

1. Text overlays — cover titles, dedications, page numbers. Treat as a new
   overlay variant alongside floating images.
2. Canvas zoom — fit-to-window is brutal on a 13" laptop. Cmd-scroll to zoom,
   cmd-0 to fit.
3. Alignment guides + snap on overlay drag.
4. Multi-select on cells (cmd-click) for batch crop/frame apply.
5. Cut/copy/paste cell. Duplicate spread.
6. A11y: drag-and-drop keyboard fallback, aria-labels on every icon button,
   focus-visible outlines.

**Done when.** A photographer can build a polished cover and finish a 20-spread
album using only the editor — no Photoshop side trip.

---

## Phase 7 — Cloud proofing (opt-in)

**Problem.** "Share with clients" is a stub. This is the moment the cloud
turns on.

**Server data model** (deliberately small):

- `users` — `id`, `email`, `created_at`. Magic-link auth, no passwords.
- `proofing_links` — `id`, `user_id`, `token`, `album_snapshot` (JSON),
  `created_at`, `expires_at`, `revoked`.
- `proofing_reactions` — `link_id`, `client_name`, `spread_id`, `loved`,
  `created_at`.
- `proofing_comments` — `link_id`, `client_name`, `spread_id`, `body`,
  `created_at`. (Optional in v1.)

**Work.**

- Server: tiny Next.js API routes + SQLite (Postgres later); magic-link email
  via Resend or Postmark.
- Spread flattening client-side (reuse Phase 5's JPEG renderer).
- "Share with clients" → POST snapshot + JPEGs → returns
  `https://yourdomain/p/<token>` URL.
- Public client view at `/p/[token]`: prompts for name, shows spreads with
  prev/next, love/comment per spread, no account needed.
- Photographer dashboard at `/proofing` (auth required): list active links,
  see reactions, revoke, regenerate.

**Done when.** Photographer hits Share in the desktop app, opens the returned
URL in an incognito window as "Sarah the client", leaves loves on three
spreads, photographer sees those loves in the dashboard.

---

## Dependencies between phases

```
1 ──┬─→ 3 ──→ 4 ──┬─→ 6
    │              │
    └─→ 2 ─────────┴─→ 5 ──→ 7
```

- Phase 2 (Tauri) can run in parallel with Phase 1 (IndexedDB) but reads from
  it for the web-side share-flow later.
- Phase 5 (PDF) depends on Phase 2 because the Rust export lives in
  `src-tauri/`.
- Phase 7 (proofing) needs Phase 5's JPEG renderer, but otherwise nothing.

## Not in scope (yet)

- Stripe / paywall — until proofing is a value driver, no gate.
- i18n — English-only is fine for v1.
- Mobile native — proofing client view is mobile-web responsive; no app.
- Print-lab fulfillment integration — Phase 8+, after a paying user asks.
