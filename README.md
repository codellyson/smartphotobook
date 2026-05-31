# SmartPhotobook

[![deploy](https://github.com/codellyson/smartphotobook/actions/workflows/deploy.yml/badge.svg)](https://github.com/codellyson/smartphotobook/actions/workflows/deploy.yml)
[![release](https://github.com/codellyson/smartphotobook/actions/workflows/release.yml/badge.svg)](https://github.com/codellyson/smartphotobook/actions/workflows/release.yml)

A local-first photobook designer. Drop photos onto real two-page spreads, crop and frame in place, then export a press-ready PDF.

## Repo layout

```
apps/
  editor/      — Vite + React SPA, wrapped as a Tauri v2 desktop app
  proofing/    — Cloudflare Worker (Hono + D1 + R2) for preview-share links
  marketing/   — Astro static landing page
```

## Live

- App — https://app.smartphotobook.kreativekorna.com
- Site — https://smartphotobook.kreativekorna.com
- API — https://api.smartphotobook.kreativekorna.com

## Develop

```sh
pnpm install
pnpm dev               # editor (Vite, :5173)
pnpm dev:proofing      # preview Worker (wrangler, :8787)
pnpm dev:marketing     # marketing (astro, :4321)
pnpm tauri:dev         # editor inside the Tauri desktop shell
```

## Release

Push a tag matching `v*` and the [release workflow](.github/workflows/release.yml) builds a macOS `.dmg` and Windows `.msi`/`.exe`, then attaches them to a draft GitHub Release. Pushes to `main` are auto-deployed by the [deploy workflow](.github/workflows/deploy.yml).
