# ShotDock

**Capture the web. Keep it simple.**

A privacy-first Manifest V3 screenshot extension. Click ShotDock, choose Full Page or Visible
Area, and get a clean, complete image in seconds. Everything — capture, stitching, encoding —
happens inside your browser. No screenshot server, no upload, no account.

---

## Quick start

```bash
npm install
npm run build      # builds into dist/
```

Then load it: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the
`dist/` folder.

| Command             | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| `npm run dev`       | Both builds in watch mode; reload the extension to pick up changes |
| `npm run build`     | Production build into `dist/`                             |
| `npm test`          | Unit tests for the planning, stitching and naming logic   |
| `npm run test:e2e`  | Drives a real capture in headless Chrome (needs `npm run build` first) |
| `npm run typecheck` | `tsc --noEmit` across `src/` and `tests/`                 |
| `npm run check`     | Typecheck, test, and build — the pre-commit sweep         |
| `npm run package`   | `check`, then the Web Store zip — the whole release step  |

Default shortcuts: **Alt+Shift+S** full page, **Alt+Shift+V** visible area (rebindable at
`chrome://extensions/shortcuts`).

---

## How a full-page capture works

```
Analyze page → plan scroll stops → prepare page
     → [ scroll → wait for stability → capture viewport → stream frame to renderer ] × N
     → restore page → stitch → encode → show result
```

Five decisions do most of the work:

**Measure, never assume.** Page size is the maximum of six DOM properties, because no single one
is reliable — `body.scrollHeight` misses absolutely positioned overflow, `documentElement`
under-reports when the body scrolls. The device pixel scale is read from the first captured frame
rather than from `devicePixelRatio`, so page zoom, high-DPI screens and OS scaling all come out
right without special cases.

**Trust where the page actually landed.** After each scroll the content script reports its real
position, post-settling. Browsers clamp scrolls, lazy content shifts layout, and scroll-snap
lands where it likes. The stitcher aligns on measured positions, never requested ones.

**Frames overlap on purpose.** Stops step by viewport minus 64px. That slack is what lets the
stitcher absorb rounding, and what gives seam detection something to match on.

**One geometric invariant kills seams.** Every frame is drawn starting exactly where the previous
one stopped, and its source offset is *derived* from that destination — never the reverse. Rounding
therefore cannot open a gap or double-draw a row. This is enforced by tests.

**Restoring the page is not best-effort.** Everything ShotDock touches is recorded and reverted in
a `finally`. If the service worker is evicted mid-capture and the restore message never arrives,
the content script restores itself on a watchdog timer. The site is never left modified.

**A capture belongs to one page.** `captureVisibleTab` reads whichever tab is in front of the
window, not the tab the capture started on — so if that tab navigates, closes, or is switched away
from, ShotDock stops and says why rather than splicing a second page into someone's screenshot.
The pacing helps here too: the two-per-second capture quota is claimed *before* the scroll round
trip, so the wait for the quota and the wait for the page to settle run as one rather than in
series.

### Sticky elements

Fixed and sticky elements are why naive full-page screenshots look broken — the header re-renders
into every frame and marches down the image. ShotDock keeps them for the first frame, where they
genuinely belong, and hides them (via `visibility`, so nothing reflows) for the rest.

### Very long pages

Frames stream to the renderer one at a time and are released immediately, so a 100×-viewport page
never holds more than one decoded bitmap. Output beyond canvas limits is split into parts and
downloaded as `-part-1`, `-part-2`… rather than failing. Past 400 frames the plan stops and the
result says so instead of capturing forever.

### Pause, resume, cancel

The session is a state machine with exactly one suspension point:

```
idle → analyzing → preparing → capturing ⇄ paused → stitching → ready
                                   ↓
                         cancelled / error
```

`checkpoint()` is where pause blocks and cancellation throws, so "stop cleanly at any point" is a
property of the design rather than flag checks sprinkled through the loop. A paused capture keeps
the worker alive with a periodic call — MV3 evicts an idle worker after ~30s, which would
otherwise kill the session silently.

---

## Architecture

```
  Popup / Options / Shortcuts          (React surfaces — intents in, state out)
              │
       Capture Manager                 (service worker: one session at a time)
        ┌─────┼─────────────┐
        ▼     ▼             ▼
  Page Bridge  Capture Engine  Settings
  (content)   (captureVisibleTab)  (chrome.storage)
        │           │
        │           ▼
        │      Frame Manager  ───────► Offscreen document
        │                              (stitching + encoding, canvas)
        ▼
  Page Analyzer / Scroll Controller / Fixed Elements / Page State
```

The UI never touches the capture engine — it sends intents to the manager and renders whatever
session state comes back. That's what lets the same engine serve the popup, keyboard shortcuts,
and whatever surface comes next (side panel, context menu) without changes.

```
src/
├── background/     service worker, capture manager, session state machine, message router
├── capture/        planner, timing/rate limiting, page bridge, frame streaming, capture modes
├── content/        page analyzer, scroll controller, fixed-element handling, page state
├── stitching/      crop calculator, seam detection, canvas renderer, stitcher
├── output/         format metadata, download naming, clipboard
├── popup/          React popup (home, progress, result, error)
├── preview/        full-size preview tab (copy, download, zoom)
├── options/        settings page
├── offscreen/      the DOM-capable renderer host
├── shared/         types, message contract, constants, errors, settings
├── ui/             design tokens, global header/footer, links, logo, the background API client
└── utils/          image, dimensions, time, logging
```

**Why an offscreen document?** MV3 service workers have no DOM and therefore no canvas. Stitching
and encoding need one, so they live in a hidden document created on demand and torn down after.

**Why does the preview tab copy the bytes?** It reads the renderer's blob URL — same extension
origin, so nothing has to travel as a base64 string — and immediately re-blobs it locally. The tab
then keeps showing the screenshot it was opened for even after the next capture has replaced it in
the renderer. One preview tab is reused across captures rather than a new one each time.

**Why is the content script not in the manifest?** It's injected on demand with
`chrome.scripting.executeScript`, which means ShotDock needs no host permissions at all. Access to
a tab is granted by `activeTab` at the moment you capture it, and lapses when you navigate away.

That has one consequence worth knowing: without host permissions Chrome also strips `url` from
every tab ShotDock hasn't been invoked on. So an *unreadable* URL means "unknown", never
"restricted" — reading it the other way turns ordinary pages into "ShotDock can't capture this
page". A page that truly is off limits announces itself when the content script won't inject,
which is the only signal that can be trusted.

### Brand

ShotDock is a Degird extension and shares one visual system with the rest of the family — TabFold is
the reference implementation, and `src/ui/tokens.css` is the source of truth here.

| Token              | Value     | Where it goes                                        |
| ------------------ | --------- | ---------------------------------------------------- |
| `--sd-bg`          | `#111827` | The ground every surface sits on                     |
| `--sd-surface`     | `#1f2937` | Cards, capture rows, the preview meta bar            |
| `--sd-control`     | `#374151` | Buttons and inputs at rest                           |
| `--sd-border`      | `#374151` | Rules and edges                                      |
| `--sd-accent`      | `#aeed22` | Links, focus, active nav, primary fills, hover states |
| `--sd-accent-text` | `#111827` | The only text colour the lime ever takes             |

**There is no light theme, and this is load-bearing.** The lime is very light (L\* ≈ 87): white on
it is **1.4:1** and lime on white is **1.4:1**, so it can only be a filled shape carrying dark text,
and it only reads as an accent against a dark ground. Every neutral above is chosen on that
assumption. `--sd-accent-ink` still exists for thin marks (progress fill, focus ring) but on the
graphite ground the lime is already 10.6:1, so it resolves to the lime itself.

The interaction signature is the family's: controls are neutral at rest and turn lime with graphite
text on hover. `.sd-btn--primary` is the one place the lime sits filled at rest, reserved for the
single action a surface exists to perform.

The header, footer and their link registry are shared across all three surfaces —
`src/ui/Header.tsx`, `src/ui/Footer.tsx` and `src/ui/links.ts`, the last mirroring TabFold's
`links.js` so a Degird-wide URL change is a one-line edit. The footer copyright is `© ShotDock`,
deliberately year-less.

The two places that cannot read a CSS variable — the toolbar badge, drawn by the browser from the
service worker, and the inline logo — take the pair from `BRAND_LIME`/`BRAND_INK` in
`src/shared/constants.ts` instead.

The mark itself lives twice, on purpose: `public/icons/icon{16,32,48,128}.png` for the browser
toolbar, and `src/ui/Logo.tsx` for the popup header and preview tab. They are hand-authored assets,
not build output — nothing regenerates them, so editing one means editing the other. Against the
graphite ground the logo's backing square melts into the page and the lime camera stands alone.

---

## Permissions

| Permission  | Why                                                                  |
| ----------- | -------------------------------------------------------------------- |
| `activeTab` | Temporary access to the tab you just acted on — instead of `<all_urls>` |
| `scripting` | Inject the measuring/scrolling script into that tab                  |
| `downloads` | Save the finished image                                              |
| `offscreen` | Host the canvas renderer                                             |
| `storage`   | Settings, and session state that survives a worker restart           |

No host permissions. Nothing is uploaded anywhere.

---

## Testing

`npm test` covers the parts where a bug is silent rather than loud — the geometry:

- **capture-planner** — overlap, clamping to real scroll limits, wide-page grids, scrollbar
  trimming, bottomless-page truncation, degenerate viewports
- **crop-calculator** — the no-gap/no-overlap invariant at 1×, 2× and fractional scales, grid
  tiling, last-frame cropping, and pages that shift mid-capture
- **overlap-detector** — recovering known pixel shifts, and refusing to "correct" on noise
- **page-analyzer** — the DOM-property maximum, scrollbar exclusion, restricted-URL classification
- **naming/dimensions** — filenames, and part splitting that covers every row exactly once
- **capture-timing** — that the capture quota holds when several waits are in flight at once, and
  survives a wall clock that moves backwards mid-capture
- **settings** — that nothing out of synced storage reaches the pipeline unvalidated, whatever
  type, range or long-retired schema it arrives in

`npm run test:e2e` runs the whole thing for real: it installs the built extension in headless
Chrome, serves a 4856px page with a sticky header, captures it through the same messages the popup
sends, and asserts on the output dimensions, the re-encode/clipboard/download paths, that the
preview tab opens and renders the real image at full size, that a capture started while the preview
is in front goes back to the source page — and, the one that matters most, that the page is left
with its scroll position, its sticky header and its stylesheets exactly as they were. Add
`-- --save-image out.png` to keep the stitched result.

Two things the harness has to work around, neither touching shipped code: Chrome 137+ ignores
`--load-extension` (so it installs over the CDP Extensions domain), and `activeTab` can only be
granted by a real toolbar click (so it runs against a copy of `dist/` with host permissions added).

Pages worth exercising by hand: Wikipedia (long, image-heavy), GitHub (sticky header), a
lazy-loading news site, a dashboard with a fixed sidebar, an infinite-scroll feed, and anything
with a cookie banner.

---

## Packaging

One command builds and packs the Chrome Web Store upload:

```bash
npm run package     # typecheck → tests → build → shotdock-<version>.zip
```

**The version always comes from `public/manifest.json`** — the only place a release number is
written. Bump it there and the zip renames itself; nothing else, `package.json` included, gets a
say. If `dist/` was built from a different version the script refuses to pack rather than produce
an archive whose filename disagrees with the manifest inside it.

Two details the format demands, both handled by `scripts/package.mjs`:

**`manifest.json` must be at the root of the archive.** Zipping the `dist/` *folder* buries it one
level down, which the store rejects — so the script packs dist's *contents*.

**The zip is byte-reproducible.** Entries carry a fixed 1980-01-01 timestamp, so the same `dist/`
always hashes the same. The printed sha256 is what makes "is the build I uploaded the build I
tested?" a question with an answer. Source maps and OS files are left out.

It writes the archive itself rather than depending on a zip library — the format is a few headers
wide, and the rest of the toolchain has no build dependencies either. `node scripts/package.mjs`
packs whatever is already in `dist/` if you need to skip the checks.

### Submitting

Listing copy, permission justifications and the privacy policy all live in
[docs/store-listing.md](docs/store-listing.md), written to match this manifest. Upload the zip at
the [Developer Dashboard](https://chrome.google.com/webstore/devconsole); the title, summary and
icon come from the manifest, everything else is pasted from that document. The Privacy practices
tab is the part that stalls reviews: it wants the single-purpose statement, a justification for
each of the five permissions, and *no* to remote code — which is honest here, since everything is
bundled and the CSP is `script-src 'self'`.

Two things the repo does not produce: **screenshots** (at least one 1280×800 or 640×400 PNG is
mandatory) and a **hosted privacy policy URL** — `APP_LINKS.privacy` in `src/ui/links.ts` still
points at a Google Doc.

---

## Roadmap

1.0 is the screenshot tool: full page, visible area, PNG/JPG, copy, download, progress, pause,
cancel, smart scrolling, smart stitching, sticky-element handling.

Next, in order: capture history and preview management → annotation, crop, blur → PDF and
collections → optional AI understanding (OCR, summarise, alt text) as a layer on top. The capture
engine is deliberately decoupled from every surface so none of that requires reworking it.

## License

MIT — see [LICENSE](LICENSE).
