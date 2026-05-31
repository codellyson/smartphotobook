# Wrapping SmartPhotobook as a desktop app (Tauri v2)

The web app and the desktop app share **one codebase** (the Next.js app under
`app/` + `components/`). The desktop build wraps that same frontend in a
native window via [Tauri](https://tauri.app) and lights up filesystem + native
dialogs through a single seam: **`lib/platform.ts`**.

## The seam: `lib/platform.ts`

Nothing in the React app touches `localStorage`, file inputs, or the filesystem
directly — it all goes through the `Platform` adapter:

| Capability                | Browser                                  | Tauri desktop                                  |
|---------------------------|------------------------------------------|------------------------------------------------|
| `loadState` / `saveState` | `localStorage`                           | `album.json` in the app-data dir (`fs` plugin) |
| `importPhotos`            | hidden `<input type=file>` → IndexedDB   | native `dialog.open` → real file paths         |
| photo persistence         | `IndexedDB` blobs (see `lib/photo-store`)| paths stored in `album.json`; src via `convertFileSrc` |
| `exportAlbum`             | browser print dialog (Save as PDF)       | native `dialog.save` → Rust `export_album_pdf` (Phase 5) |
| `isDesktop`               | `false`                                  | `true` (detects `window.__TAURI__`)            |

Detection is `!!window.__TAURI__`, which Tauri exposes because the config sets
`app.withGlobalTauri: true`. Add a new native capability by adding a branch in
`lib/platform.ts` — the UI never changes.

## How the static-export wiring works

The desktop build wraps the Next.js **static export** (`out/`), not the dev
server. `next.config.ts` checks `TAURI_BUILD=1` and switches on
`output: 'export'`. `package.json` exposes two extra scripts that set the flag
for you:

- `dev:tauri` — `next dev` with the flag (used by Tauri's `beforeDevCommand`)
- `build:tauri` — `next build` with the flag, producing `out/` (used by
  `beforeBuildCommand`)

`tauri.conf.json` points `frontendDist` at `../out` and opens `/designer/` as
the entry route — the photographer lands directly in the editor on launch.
(Phase 3 will replace this with a projects home screen.)

## Run it

Prereqs: [Rust](https://rustup.rs) + the
[Tauri v2 system deps](https://v2.tauri.app/start/prerequisites/), and Node.

```bash
pnpm install
pnpm tauri:dev      # hot-reloading desktop window (uses devUrl)
pnpm tauri:build    # produces installers in src-tauri/target/release/bundle/
```

## Files in this scaffold

```
next.config.ts                       # TAURI_BUILD=1 → output: 'export'
package.json                         # dev:tauri / build:tauri / tauri:* scripts
src-tauri/
  tauri.conf.json                    # frontendDist: ../out, devUrl, withGlobalTauri
  Cargo.toml                         # rust deps: tauri, fs + dialog plugins
  build.rs
  src/main.rs                        # registers plugins; stub for PDF export command
  capabilities/default.json          # grants fs (app-data scope) + dialog to the window
```

## Before first run

- **Icons:** run `pnpm tauri icon path/to/logo.png` to generate
  `src-tauri/icons/*` referenced by `tauri.conf.json`. Without these the build
  fails. (A starter `tauri-app` template ships placeholders if you need a
  quick sanity check.)
- **Permissions:** the `fs` scope is limited to `$APPDATA/**`. Widen it (or
  add a picker scope) if you store albums elsewhere. Photo import via the
  dialog does not need an `fs` scope — Tauri returns an asset URL through
  `convertFileSrc`.
- **Versions:** these configs target Tauri **v2**. Plugin permission
  identifiers occasionally shift between minor versions — if the build
  complains, run `pnpm tauri permission ls` to see valid identifiers.

## What desktop unlocks

- Import straight from huge local photo folders — no upload step, no
  IndexedDB round-trip; the originals stay where they are on disk and the
  album just remembers their paths.
- Albums persist as real `album.json` files the photographer owns (and can
  back up / sync).
- Offline editing on calibrated monitors.
- A real press-ready PDF export path (Phase 5 will implement
  `export_album_pdf` in `main.rs`).
