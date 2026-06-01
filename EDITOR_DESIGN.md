# Editor design — drift from collage tool toward photobook designer

A living document. Each reference image the user shares gets logged here with
observations + how it should shape the architecture. The goal isn't to copy
any single tool — it's to articulate what makes a tool feel like a
*photobook designer* instead of a *collage editor*, then build toward that.

The current product is functional but collage-shaped: one isolated spread on
the canvas, photos in a generic tray, templates as a fixed grid. Useful for
laying out one page; doesn't feel like designing a book.

---

## Current state (2026-06-01)

- Three-piece architecture: Vite/React editor + Cloudflare Worker + Astro marketing
- Auto-layout V1 just built (uncommitted): EXIF time sort + time-gap clustering
  into chapters + hero spread per chapter. Topbar "Build book" button.
- Print-marks overlay ~95% done locally (uncommitted): toggle in canvas-top,
  dashed safe-area + shaded gutter danger zone, computed from real trim-size mm.
- Photo dimensions (`widthPx`, `heightPx`) now captured during import — foundation
  for DPI quality checks (not built yet).
- Library has a proper empty state with Import CTA.
- Filmstrip alignment + remove-spread affordance done.

Working tree is in an intentional "paused mid-build" state while we step back
to architect. Nothing committed past 2a8ab16 yet.

---

## References

### Ref 1 — SmartAlbums 2 (Pixellu) — 2026-06-01

The original product we set out to clone. User shared a full-canvas screenshot
of a wedding album in progress (30 spreads, 270 images, "Blacksmith" template).

**What stands out, in order of "feel" impact:**

1. **The main canvas shows multiple spreads at once** as a continuous horizontal
   flow. Three full-size spreads visible at editing size: N-1, N, N+1. The
   active spread isn't isolated — it's part of the book sequence in your eye.
   *This is the single biggest reason their tool feels like a photobook designer
   and ours feels like a collage editor.* The book is a physical sequence;
   their canvas treats it that way.

2. **Yellow numbered badges on every placed photo** (1, 2, 3...). Tracks the
   reading order across the whole book. Useful for re-sequencing and for
   knowing where you are.

3. **Counter anchored at the very top center**: `30 spreads. 157/270 images used.`
   Always visible. Tells you completion state at a glance.

4. **Stats sidebar**: `270 images: 212 horizontal, 58 vertical, 0...`. Image
   orientation breakdown. Useful BEFORE auto-layout so you know what mix
   you're working with.

5. **"Sort by time taken"** is an explicit, prominent filter in the photo bin
   — not a hidden auto-layout-only assumption.

6. **Bins / Highlights / All** — photos live in named filter buckets, not one
   flat tray. Lets you mark "must-include" photos vs. b-roll.

7. **Spread Grid sidebar** — all 30 spreads as small thumbs in a 3-column
   sidebar, separate from a filmstrip. A different navigation affordance
   (overview vs. flow).

8. **Photo white frames on the canvas** — subtle white border on every photo.
   Signals "printed paper" instead of "screen pixels."

9. **Max/min page count constraint** in album settings (Max: 60, Min: 20).
   Enforces print-lab page-count rules.

10. **Cloud Proofing sidebar** — proofing link, feedback state, manage button.
    (We dropped proofing-as-a-product in our scope; not relevant to copy here.)

11. **Tools**: arrow tool + hand/pan tool. Pan tool for navigating the
    horizontal book flow.

12. **The mid-strip filmstrip** + the main canvas + the spread grid is a
    *three-tiered* spread navigation. Each surface gives a different scale.

**Second-pass observations (added on re-examining the same image):**

13. **Filmstrip ≠ mini-spread previews.** Their mid-strip filmstrip shows
    *individual photos per spread*, laid out as a horizontal row of thumbs
    grouped per spread. Each spread's component images are separately
    visible. Ours renders compressed mini-spread layouts. Their model says
    "here are the photos in this spread"; ours says "here is what this
    spread looks like." Two different navigation metaphors. Theirs is
    photo-centric, ours is layout-centric.

14. **Color-label dots in the photo bin filter row** (red/yellow/green/blue
    /magenta/cyan). Lightroom-style color tagging. Photographer can color
    photos for organization and filter on them. Adjacent to a star-rating
    slider with a `≥` comparator.

15. **`+ < >` cluster** in the photo bin toolbar — likely "add to current
    bin / prev bin / next bin." So bins aren't just preset filters, they're
    user-defined collections.

16. **`All Cover Types` selector** at the top of the right panel — their
    template families include cover variants (different cover styles for the
    same album). Implies a separate cover-template namespace from interior
    spreads.

17. **`30 spreads: 27 unique templates`** stat — counts template diversity.
    Useful warning signal ("you reused the same layout too often").

18. **Right panel sections are collapsible** (▼ headers). Album Info / Cloud
    Proofing / Spread Grid each collapse independently. Lets the user
    optimize sidebar real estate for the current task.

---

### Ref 2 — SmartAlbums 2 plain view, sidebar collapsed — 2026-06-01

Smaller album ("My Album", 10 spreads, 32/32 images used). Right sidebar
collapsed; gives a cleaner read of the canvas + filmstrip layer.

**Confirms from Ref 1:**

- Multi-spread main canvas with 3 spreads visible at editing size
- Top counter format `N spreads. X/Y images used.`
- Mid filmstrip shows photos grouped per spread, not mini-spread previews
- Title bar = just project name, no brand chrome

**New observations:**

A. **Spreads are visually discrete cards with real breathing room between
   them.** Significant gap, individual drop shadows on each. They don't
   merge into one continuous strip. Each spread feels like a printed sheet
   lifted off a gray desk surface.

B. **Active-state indicator is subtle, not loud.** No outline on the active
   spread in the canvas. The active spread's *photo group in the mid
   filmstrip* gets a slightly darker background — that's the entire
   indicator. The canvas stays neutral; emphasis lives at the navigation
   layer.

C. **Drop shadows + neutral gray surface do the metaphor work** — no 3D
   tilt, no perspective. Soft generous shadows under each spread, large
   gaps, gray work surface. That alone sells "physical pages on a desk."
   The earlier 3D book mockup approach was solving for the wrong cause.

D. **Photo bin filter row is consistent**: same `Sort by ... | ≥ | rating
   slider | color dots` regardless of album size.

E. **Spread sizing in the multi-spread canvas is smaller than our current
   single-spread render.** At 3 spreads visible in their viewport, each
   spread occupies ~30% of canvas width. Our current 760px render fits
   maybe 2 at a typical screen width — or we'd horizontal-scroll.

---

## Observations across refs

**Active state belongs at the navigation layer, not the canvas layer.**
Confirmed across both refs. Don't outline the active spread in the canvas;
indicate it via the filmstrip / spread grid.

**Top counter is a fixed anchor**, same format every time:
`N spreads. X/Y images used.` This is more information-dense than our
current `Spread N · M spreads` and tells the user about completion state
(images used vs total).

**The mid filmstrip = photo flow, not spread flow.** Each spread is shown
as its photos in a row, with subtle grouping. This is fundamentally
different from our current filmstrip (compressed mini-spread layouts).
Theirs answers "what's IN each spread"; ours answers "what does each
spread LOOK like." Both are useful but they chose photo-flow as the
primary navigation.

**No 3D, no perspective.** Pure 2D rendering. The book metaphor is
delivered by gap + shadow + gray surface + neutral background. We can drop
the 3D book mockup option from the build queue.

---

### Ref 3 — Pixellu SmartAlbums home + new-project flow — 2026-06-01

A 5-frame sequence: app open → tabs and filters → New Project dropdown →
Album Specifications modal → album-type dropdown.

**Observations:**

- The app home is a **project browser**, not the editor. Three sibling
  project types: **Albums / Galleries / Slideshows**. Tabs at top.
- Filter chips like "Waiting for feedback" sit alongside search/sort/folder
  icons. Filters are first-class — multiple can stack as removable chips.
- Empty state: `No projects match your filter selection` + `Clear Filters`
  button. The empty state is filter-aware.
- "+ New Project" opens a dropdown of project types, not a modal. Modal
  comes after type selection.
- The New Project modal forces a **structural decision up front** — you
  pick an album SKU before anything else:
  - **Album Company** (e.g. QT Albums U.S.) — the print lab
  - **Album Format & Size** — three icons (square / landscape / portrait) +
    a size dropdown ("12x12")
  - **Album Type** — a *book line* sold by that lab: AriaBook, Matte
    ArtBook, CottonRag Artbook, Heirloom Book…
- Two tabs in the modal: **Album Company Preset** (defaults) and **Custom**
  (presumably arbitrary trim sizes for non-lab output).

**Architectural implication for us:**

We have a flat "Album with title / size / pages" model. Pixellu treats the
book as a *product SKU from a real print company*. That SKU determines
page limits, available cover materials, papers, embossing options. Even
if we don't integrate with a real lab today, modeling our album around
"product preset (with limits) → optional overrides" would push us closer
to photobook-designer feel and away from collage-tool feel. The
constraints are part of what makes it feel real.

---

### Ref 4 — Editor empty state + first spreads — 2026-06-01

Three frames: 0 spreads → 1 spread (2 photos placed) → 2 spreads (3 photos
placed). Project: AriaBook 12×12, 82 photos imported.

**Observations:**

- **Empty editor = giant drop zone, not blank canvas.** Central dashed
  rectangle with placeholder icon and text `Drop images here to create a
  new spread.` Same dashed pattern as our empty Library card, but here
  it's the editing surface itself.
- **Second drop zone at the bottom**, in the photo bin area, with
  `Drop images here to import them into the project`. Two distinct drop
  targets:
  - Drop on the canvas → import AND place into a new spread
  - Drop on the bin → just import, don't place
- Bottom toolbar of the bin (always visible, not just empty state):
  `[image-grid] [grid-shuffle] Import Images | ❤ Import Favorites | Auto Build | All images ▾ | Bins: All [+] | Filter ... | [search] [slider]`
- **"Auto Build" is a primary button at the bottom toolbar** — not buried
  in topbar like ours. The implication: auto-layout is a frequent action,
  designed to be hit often.
- **"Import Favorites"** distinct from "Import Images" — suggests two
  import categories (general photos vs hand-picked highlights).
- **A small chevron handle at the center bottom** of the canvas area lets
  you expand/collapse the photo bin. The bin is resizable.
- Counter format: `N spread(s) (M pages), X/Y images used` — note the
  "pages" parenthetical (cover counts as 1 page in many SKUs; interior
  spreads count as 2). Image utilization ratio always shown.
- The **Spread Grid sidebar updates live** — 1 mini-thumb when 1 spread, 2
  when 2, etc.
- A small **"Go to Cover"** button floats at the left edge of the canvas
  when the active spread isn't the cover — fast way back.

---

### Ref 5 — Photo selection + Image Information panel — 2026-06-01

Two frames: multi-photo selection in the bin (right panel shows
`2 images selected`), and a placed photo selected on the spread (right
panel shows full image inspector).

**Observations:**

- The right panel is **context-switching**: it shows album-level info when
  nothing is selected, "N images selected" when a multi-selection is
  active, and a full image inspector when a single placed photo is
  selected.
- Selected photos in the bin get a **yellow outline + filename caption**
  (e.g. `2019_06_21_14_44_14.jpg`). The selection state is mirrored on
  whichever surface the photo lives in (bin and/or spread).
- The image inspector has four collapsible sections:
  - **Design**: Scale, Angle, Opacity, Border (in points, not px) — these
    are *frame placement* controls
  - **Tone Adjustments**: Brightness slider, Contrast slider, Black & White
    toggle (with original/converted preview). Light-touch per-photo
    enhancement
  - **Image Information** — the killer panel:
    - `Frame W × H: 23.68 × 11.68 in` — the printed size of the frame the
      photo lives in
    - **`Effective PPI: 251`** — the photo's pixel density at that printed
      size. *This is the single most important print-quality metric.*
    - Color Profile, Pixel Dimensions, Shutter Speed, Aperture, ISO, Focal
      Length, Date/Time Original — full EXIF
    - `Used 1 Time` — how many times this photo appears in the album
  - (Plus a small selection preview thumbnail at the top of the panel.)

**Architectural implications:**

- Calculating Effective PPI requires: photo width in px, cell width in
  printed inches. We just added `widthPx`/`heightPx` to Photo. We also
  need to compute cell width-in-inches from template + album size. Doable.
- "Used N Times" requires scanning all cells across all spreads for each
  photo's id. Memoized derivation.
- Tone adjustments per photo means extending the Cell type with optional
  per-frame adjustments (`brightness`, `contrast`, `bw`). Render via CSS
  `filter:` on the `<img>`.

---

### Ref 6 — Export / Order flow — 2026-06-01

Four frames: export modal (Order Album tab) → upload progress → web
checkout (P*XELLU branded) order summary → billing/shipping continued.

**Observations:**

- The Export dialog has **four output paths as tabs**:
  - **For Printing** — generate press-ready files (PDF/X) for download
  - **Cloud Proofing** — push to their proofing service
  - **Order Album** (selected here) — order directly from the print lab
  - **Manual Proofing** — generate proofing files you send to the client
    yourself
- Order Album shows a **3-step progress strip** with icons:
  `Design album ──▸ Select options ──▸ Place order`
- Upload state replaces the steps with a progress indicator + Cancel.
- After upload completes, the user is taken to a **web checkout** on
  pxellu.com:
  - "Order Details" header. Quantity stepper, Subtotal, Cancel /
    **Checkout** (the primary CTA flips from yellow to dark).
  - Two-column layout: album preview placeholder on left, **Album Summary**
    on right with all the locked-in specs (company, type, subtype, size,
    page count) AND the customization choices made (cover type, material,
    paper, embossing, etc.).
  - Terms & Conditions checkbox required before Checkout enables.
  - Below: Billing Address (with "Billing is same as shipping" checkbox),
    Shipping Method.

**Architectural implication:**

Out of scope for us as a feature (we're not a SaaS, no print-lab deal),
but the export modal's **multi-output structure** is relevant. Right now
we have `Export PDF` (desktop) or `Download JPEGs` (web). A tabbed export
with "For Printing" (high-DPI PDF) + "For Web" (smaller JPEGs) +
"Per-spread PNG" would feel more deliberate, even without lab integration.

---

### Ref 7 — Cover material + embossing config — 2026-06-01

Five frames: leather color picker → cover material section overview →
photo paper / presentation box dropdown → stamping type dropdown →
embossing options grid with line inputs.

**Observations:**

- The cover-configuration UI is **its own scrollable surface** beside the
  cover preview, not a modal. Side-by-side: live cover render on the left
  (`HELENA & ADAM / 07.12.2024` shown on the leather), config sections on
  the right.
- **Real material previews:** the leather-color picker shows a 4×3 grid of
  *actual texture swatches* (White, Off White, Blush, Jade, Sky Blue,
  Gray, Blue, Plum, Caramel, Stone, Hazelnut, Brown). Each tile is an
  actual leather photo, not a flat color square. The selected one
  (`Stone`) has a checkmark.
- **Stamping type dropdown:** No thanks / Standard Embossing / Premium
  Embossing / QT Embossing Stamp.
- **Embossing-style options** are a grid of *typographic previews*. Each
  tile shows what `HELENA & ADAM / 07.12.2024` will actually look like in
  that embossing style. Real type, real layout. The user can see exactly
  what they'll get.
- Embossing Line 1 / Line 2 inputs with **character counters** (`14/40`,
  `0/40`).
- Cover-related sections in the panel: Album Info, Cover Material,
  Stamping (with options 1–12), Embossing Lines, Embossing Color, Paper
  Options, Flat Rate Album Copies, Presentation Box, Special Instructions.
- The Continue button at the top right is **disabled until required fields
  are filled** (Embossing Line 1 is starred as required).

**Architectural implications:**

- Cover design is **a different editing surface** with its own affordances
  (material swatches, type previews) — confirms the "cover as distinct
  page" intuition I noted earlier.
- Real type previews for personalization is a quality signal. Even our
  modest version should render whatever text the user will see on the
  cover in the actual chosen font, at actual size.

---

## Observations across refs

**Active state belongs at the navigation layer, not the canvas layer.**
Confirmed across both refs. Don't outline the active spread in the canvas;
indicate it via the filmstrip / spread grid.

**Top counter is a fixed anchor**, same format every time:
`N spreads (M pages), X/Y images used`. This format from Refs 4–5 is more
precise than the Ref 1/2 wording — it accounts for pages-per-spread (cover
= 1 page, interior = 2) and reports image utilization.

**The mid filmstrip = photo flow, not spread flow.** Each spread is shown
as its photos in a row, with subtle grouping. This is fundamentally
different from our current filmstrip (compressed mini-spread layouts).
Theirs answers "what's IN each spread"; ours answers "what does each
spread LOOK like." Both are useful but they chose photo-flow as the
primary navigation.

**No 3D, no perspective.** Pure 2D rendering. Confirmed across all refs.

**The book is a product SKU, not an abstract object.** Across every
surface — new-project flow, image info panel, order flow — the model
threads "this is a printed object with specific physical constraints"
into every interaction. Page count limits enforce a real lab's
requirements. Effective PPI surfaces print quality. Cover material is
visualized as a real material. The whole product is anchored to a
*physical artifact*, not "some photos arranged on rectangles."

**Empty states are drop zones.** The empty editor and the empty bin are
both dashed-border drop targets with explicit copy. Each accepts a
different drop behavior (canvas → import + place; bin → just import). The
empty state IS the interaction.

**Right panel is context-switching, not static.** It re-renders entirely
based on what's selected: nothing → album info; multi-selection → "N
images selected"; single placed photo → full image inspector. Reduces
clutter; surfaces exactly what's relevant.

**Per-photo print-awareness via Effective PPI.** The single most
photobook-designer-y feature we don't have. Drop a 600px photo into a 12"
frame and the inspector tells you it'll print at 50 PPI — too low. A
designer sees this immediately and replaces the photo before exporting.

---

## Architectural shifts implied (provisional)

Updated after Refs 3–7. Reordered by impact + foundationality.

1. **Album SKU model.** Introduce an `AlbumPreset` concept: a named book
   line with constraints (page range, available sizes, default cover
   options, default paper). New-project flow forces preset selection up
   front (with a "Custom" tab for arbitrary trim sizes). Surfaces real
   physical constraints — `Max pages: 110, Min pages: 20` is what makes
   the book feel like a real product.

2. **Main canvas → horizontal book flow.** Render all spreads in sequence,
   discrete cards with breathing room and drop shadows. Active state at
   the navigation layer, not the canvas. Scroll horizontally; click
   neighbor to focus.

3. **Right sidebar = context-switching, three modes:**
   - **Album view** (default, nothing selected) — Album Info (size, page
     limits), Album Preferences (color profile, units), Spread Grid
     (live-updating mini-thumbs of every spread)
   - **Multi-selection view** — "N images selected" header, bulk actions
   - **Single-photo view** — full Image Inspector: Design controls
     (scale/angle/opacity/border), Tone Adjustments (brightness/contrast/
     B&W), Image Information (Frame W×H, **Effective PPI**, EXIF, Used N
     Times)

4. **Per-photo Image Information + Effective PPI.** Compute PPI per
   placed photo: `photo.widthPx / cellWidthInInches`. Surface in the
   inspector. The single most "this is for print" interaction the editor
   could have. Requires we already capture photo dimensions (done) and
   compute cell physical size from template grid + album trim.

5. **Per-photo Tone Adjustments.** Brightness + Contrast sliders + B&W
   toggle on each placed cell. Render via CSS `filter:` on the `<img>`.
   Extends the Cell type with optional adjustments object.

6. **Empty states as drop zones.** When 0 spreads, the canvas IS a giant
   dashed drop target with "Drop images to create a new spread." Two drop
   behaviors: canvas drop = import + place; bin drop = just import.

7. **Counter format**: `N spread(s) (M pages), X/Y images used`. Anchored
   in topbar/canvas-top. Always visible.

8. **Mid-filmstrip = photo flow per spread.** Each spread's photos as a
   horizontal sub-row, grouped with subtle gap between groups. Active
   spread's group highlighted via background tone. (Currently we render
   mini-spread previews — different model.)

9. **Numbered placement badges** on placed cells (yellow circles in the
   top-left of each cell with index 1, 2, 3…). Reading-order tracking.

10. **Per-photo "Used N Times" derivation.** Scan all cells across all
    spreads; cache. Display in image inspector. Avoid accidental
    duplication in the book.

11. **Auto Build as a primary bottom-toolbar button** in the bin row, not
    only buried in the topbar. Implies the user reaches for it often.

12. **Tabbed export dialog**: replace single Export button with a modal
    that has "For Printing" (PDF/X high-DPI) + "Per-spread JPEGs" + (when
    relevant) "Manual Proofing" tabs. Each path has its own option set.

13. **Cover designer as a distinct surface.** Cover spread renders as a
    single page (no gutter line). Cover-only configuration panel with
    material swatches and embossing previews. We won't ship the embossing
    visual previews on day one, but the *structural* split (cover ≠
    interior spread) we should.

14. **Project home page filters + project types.** Probably skip project
    type tabs (Galleries/Slideshows are out of our scope per memory). But
    the filterable project list with chips ("Waiting for feedback",
    "Recently edited", etc.) is a real polish layer for the Projects page.

15. **Photo bin filters.** Bins (named photo collections), color-label
    tagging, star-rating filter, sort by time taken. We have none of
    these. A "Bins: All / Unused / Favorites" minimum subset matches the
    most common photographer flow.

---

## Not yet decided / waiting on more refs

- Whether to keep the bottom filmstrip if we have multi-spread canvas + spread
  grid sidebar. Probably yes (filmstrip = flow, sidebar grid = overview), but
  worth confirming once we see another reference.
- Cover-as-distinct-page treatment.
- DPI/quality warning surfacing.
- Photo enhancement (per-frame exposure/saturation) — included in any
  serious "photobook designer" feature set? Or skip?
- How "Bins" map to our data model (we currently have `imported: true` flag
  and a `fav` flag — could be extended).

---

## Build queue

Ordered roughly by foundationality (data-model and structural shifts
first, surface polish last). Items in brackets are deferred / out of
scope unless decided otherwise.

**Already built locally, awaiting commit:**
- Auto-layout V1 (EXIF + chapter clustering + hero spread per chapter)
- Print-marks overlay (dashed safe area + shaded gutter danger zone)
- Photo dimensions captured on import (`widthPx`, `heightPx`)

**Tier 1 — foundational data model + page-anchored UI**

1. Counter format anchored top center: `N spreads (M pages), X/Y images used`
2. Album SKU / preset model (presets table + max/min page limits)
3. Spread Grid sidebar (live-updating mini-thumbs)
4. Right panel context-switching (album / multi-select / single-photo)
5. Image Information panel (Frame W×H + Effective PPI + EXIF + Used N Times)

**Tier 2 — main canvas shift**

6. Multi-spread horizontal canvas (discrete cards with breathing room,
   active state via filmstrip not canvas outline)
7. Mid-filmstrip rebuilt as photo-flow per spread (replace mini-spread
   layouts)
8. Numbered placement badges on cells
9. Cover as distinct surface (single-page render, no gutter line)
10. Empty-state drop zones (canvas + bin)

**Tier 3 — per-photo and per-bin features**

11. Per-photo Tone Adjustments (brightness/contrast/B&W via CSS filter)
12. Bin filtering (Bins: All / Unused / Favorites)
13. Sort-by-time-taken explicit filter in bin
14. Auto Build as primary bottom-toolbar button
15. Import Favorites distinct from Import Images

**Tier 4 — export + cover polish**

16. Tabbed Export modal (For Printing / JPEGs / Manual Proofing)
17. Cover material + embossing configurator (cover-only side surface)
18. Photo "color label" tagging + filter

**Deferred / out of scope unless decided otherwise**

- [Galleries / Slideshows project types]
- [Cloud Proofing / Order Album integrations — we're not a SaaS]
- [3D book mockup — refs disprove the need]
- [Spine + back cover designer]
- [Real lab integrations / order flow on a hosted checkout]
