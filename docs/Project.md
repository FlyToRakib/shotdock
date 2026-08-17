Yes. For **ShotDock**, I would build it as a **focused, extremely simple screenshot tool first**, but architect it so it can become a much more powerful capture workspace later.

The important part: **do not build the full-page capture around a third-party screenshot service or external API.** Use the browser's native extension APIs and local processing. Chrome's `tabs.captureVisibleTab()` is designed for capturing the visible tab, while the full-page experience can be built by coordinating page measurement, scrolling, repeated captures, and stitching. Chrome currently limits `captureVisibleTab()` to **2 calls per second**, so the capture engine needs deliberate timing rather than firing screenshots continuously. ([Chrome for Developers][1])

# ShotDock

**Tagline:**
**Capture the web. Keep it simple.**

**Product vision:**

> ShotDock is a fast, privacy-first browser screenshot extension that turns any webpage into a clean, complete image in seconds.

---

# 1. Product philosophy

Don't make ShotDock another extension with a giant popup full of 30 buttons.

The main experience should be:

**Click ShotDock → choose capture → done.**

### Primary actions

```text
┌─────────────────────────────┐
│        ShotDock              │
│                              │
│   📄 Full Page               │
│   Capture the entire page    │
│                              │
│   ─────────────────────      │
│                              │
│   🖥 Visible Area            │
│   Capture what's on screen   │
│                              │
└─────────────────────────────┘
```

Then, after capture:

```text
┌─────────────────────────────┐
│ ✓ Screenshot ready           │
│                              │
│       [ Preview ]            │
│                              │
│  PNG        JPG              │
│                              │
│ [ Copy ]  [ Download ]       │
└─────────────────────────────┘
```

That's the core.

---

# 2. MVP feature set

Your 12 features should become **four core systems**, rather than 12 disconnected features.

### Capture

* Full Page
* Visible Area
* Automatic page-size detection
* Automatic scrolling

### Processing

* Screenshot stitching
* Sticky/fixed element handling
* Very long-page handling

### Output

* PNG
* JPEG
* Copy to clipboard
* Download

### Capture control

* Pause
* Resume
* Cancel
* Progress

This makes the architecture much cleaner.

---

# 3. Recommended technical architecture

Use:

**Manifest V3 + TypeScript + native Chrome Extension APIs**

Chrome's current extension documentation supports Manifest V3, and extension APIs are asynchronous/promise-based. ([Chrome for Developers][2])

Architecture:

```text
                         ┌─────────────────┐
                         │   ShotDock UI    │
                         │ Popup / Side UI  │
                         └────────┬────────┘
                                  │
                                  ▼
                       ┌────────────────────┐
                       │   Capture Manager   │
                       │    Service Worker   │
                       └─────────┬──────────┘
                                 │
                   ┌─────────────┼─────────────┐
                   ▼             ▼             ▼
             Page Analyzer   Capture Engine   Settings
             Content Script  captureVisibleTab chrome.storage
                   │             │
                   │             ▼
                   │       Capture Frames
                   │             │
                   └─────────────┼─────────────┘
                                 ▼
                         ┌─────────────────┐
                         │ Stitching Engine │
                         │    Offscreen     │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │ Output Manager  │
                         │ PNG / JPG / Copy│
                         └─────────────────┘
```

### Why Offscreen?

Manifest V3 service workers don't have DOM access. Chrome's Offscreen API exists specifically for cases where an extension needs DOM APIs without opening a visible page. It can therefore be useful for image processing, canvas work, and clipboard operations. ([Chrome for Developers][3])

---

# 4. Project structure

I'd structure it like this:

```text
shotdock/
│
├── src/
│   │
│   ├── background/
│   │   ├── service-worker.ts
│   │   ├── capture-manager.ts
│   │   ├── capture-session.ts
│   │   └── message-router.ts
│   │
│   ├── content/
│   │   ├── page-analyzer.ts
│   │   ├── scroll-controller.ts
│   │   ├── fixed-element-detector.ts
│   │   ├── page-state.ts
│   │   └── content.ts
│   │
│   ├── capture/
│   │   ├── visible-capture.ts
│   │   ├── full-page-capture.ts
│   │   ├── capture-planner.ts
│   │   ├── frame-manager.ts
│   │   └── capture-timing.ts
│   │
│   ├── stitching/
│   │   ├── stitcher.ts
│   │   ├── overlap-detector.ts
│   │   ├── crop-calculator.ts
│   │   └── canvas-renderer.ts
│   │
│   ├── output/
│   │   ├── png.ts
│   │   ├── jpeg.ts
│   │   ├── clipboard.ts
│   │   └── download.ts
│   │
│   ├── popup/
│   │   ├── Popup.tsx
│   │   ├── CaptureButton.tsx
│   │   ├── Progress.tsx
│   │   ├── Preview.tsx
│   │   └── FormatSelector.tsx
│   │
│   ├── options/
│   │   └── Settings.tsx
│   │
│   ├── offscreen/
│   │   ├── offscreen.html
│   │   ├── offscreen.ts
│   │   └── image-worker.ts
│   │
│   ├── shared/
│   │   ├── types.ts
│   │   ├── constants.ts
│   │   ├── messages.ts
│   │   └── errors.ts
│   │
│   └── utils/
│       ├── image.ts
│       ├── dimensions.ts
│       ├── debounce.ts
│       └── logger.ts
│
├── public/
│   ├── icons/
│   └── manifest.json
│
├── tests/
│   ├── capture/
│   ├── stitching/
│   └── page-analysis/
│
├── package.json
├── tsconfig.json
└── README.md
```

---

# 5. Full-page capture engine

This is the **heart of ShotDock**.

The process should be:

```text
User clicks Full Page
        ↓
Analyze page
        ↓
Calculate dimensions
        ↓
Save current scroll position
        ↓
Detect problematic fixed elements
        ↓
Prepare page
        ↓
Capture viewport
        ↓
Scroll
        ↓
Wait for rendering
        ↓
Capture viewport
        ↓
Repeat
        ↓
Restore page
        ↓
Stitch frames
        ↓
Generate final image
        ↓
Show result
```

---

# 6. Automatic page-size detection

The content script should calculate:

```text
document.documentElement.scrollWidth
document.documentElement.scrollHeight

document.body.scrollWidth
document.body.scrollHeight

window.innerWidth
window.innerHeight

window.devicePixelRatio
```

Don't trust only one DOM property.

Use a robust maximum:

```text
pageWidth =
max(
  document.documentElement.scrollWidth,
  document.body.scrollWidth,
  document.documentElement.clientWidth
)

pageHeight =
max(
  document.documentElement.scrollHeight,
  document.body.scrollHeight,
  document.documentElement.clientHeight
)
```

Then return:

```text
{
  pageWidth,
  pageHeight,
  viewportWidth,
  viewportHeight,
  devicePixelRatio,
  currentScrollX,
  currentScrollY
}
```

---

# 7. Automatic scrolling

Don't simply do:

```text
scrollTo(0, 1000)
scrollTo(0, 2000)
scrollTo(0, 3000)
```

Modern websites can have:

* lazy-loaded images
* infinite scrolling
* animations
* sticky navigation
* dynamically changing heights
* virtualized content

So ShotDock should use a **Capture Planner**.

Example:

```text
Page height: 12,000px
Viewport:    900px

Capture positions:

0
850
1700
2550
3400
4250
...
11100
```

The overlap gives the stitching engine enough information to remove seams.

---

# 8. Sticky/fixed header handling

This is one of the features that can make ShotDock feel **much better than a basic screenshot extension**.

Before capture:

```text
Detect:
position: fixed
position: sticky
```

Then classify elements:

```text
Header
Navigation
Floating button
Cookie banner
Chat widget
Ads
Other fixed UI
```

Don't blindly hide everything.

Instead:

### Capture mode

Temporarily modify known fixed elements:

```text
visibility: hidden
```

or preserve their original state and restore it after capture.

Store:

```text
element
originalStyle
originalClass
originalAttribute
```

Then:

```text
capture
   ↓
restore EVERYTHING
```

If something goes wrong, use a `finally`-style cleanup path.

**Never leave the website modified.**

---

# 9. Dynamic content stabilization

Before each capture:

```text
scroll
 ↓
wait ~render stabilization period
 ↓
capture
```

But don't use an unnecessarily huge fixed delay.

Instead detect stability:

```text
image loading
layout height
scroll position
document height
```

If the page is still changing:

```text
wait
```

Otherwise:

```text
capture
```

This makes ShotDock faster on simple pages and safer on complex pages.

---

# 10. Screenshot stitching

This should be a dedicated module.

Input:

```text
Frame 1
Frame 2
Frame 3
Frame 4
...
```

Output:

```text
┌─────────────┐
│   Frame 1   │
├─────────────┤
│   Frame 2   │
├─────────────┤
│   Frame 3   │
├─────────────┤
│   Frame 4   │
└─────────────┘
```

But don't simply concatenate them.

Use:

### Overlap-aware stitching

```text
Frame 1
████████████
████████████
████████████
████████████
      ↓ overlap
Frame 2
████████████
████████████
████████████
```

Calculate the actual output crop for each frame.

For difficult pages, add:

**seam detection**

Compare adjacent image regions and find the best matching boundary.

That gives ShotDock a more reliable result when the actual scroll movement isn't exactly what was expected.

---

# 11. Very long pages

This needs special attention.

A webpage could theoretically be extremely tall.

Don't keep every full-resolution image in memory forever.

Use a pipeline:

```text
Capture frame
      ↓
Process frame
      ↓
Store temporary data
      ↓
Release unnecessary bitmap
      ↓
Next frame
```

For very large screenshots:

```text
Capture
   ↓
Chunk
   ↓
Stitch chunks
   ↓
Final output
```

You should also establish a **maximum safe output dimension** and gracefully handle browser/canvas limitations.

Instead of crashing:

> This page is too large to render as one image. ShotDock can capture it in optimized sections.

That's a much better UX.

---

# 12. PNG vs JPEG

Keep it extremely simple.

```text
PNG
Lossless
Best for websites/UI/text
Larger file

JPG
Smaller
Best for photos
Adjustable quality
```

UI:

```text
Format

○ PNG
● JPG

Quality
────────●────
      85%
```

For PNG, don't show a quality slider.

---

# 13. Clipboard

User clicks:

**Copy**

ShotDock should place the final screenshot directly into the clipboard.

Because MV3 service workers don't have normal DOM access, an offscreen document is a suitable architecture for clipboard-related DOM work. Chrome explicitly supports a `CLIPBOARD` offscreen reason. ([Chrome for Developers][3])

Result:

> ✓ Screenshot copied

No unnecessary dialog.

---

# 14. Download

Default:

```text
ShotDock/
```

Filename:

```text
example.com-full-page-2026-08-17.png
```

Better:

```text
{hostname}-{capture-type}-{timestamp}.{format}
```

Examples:

```text
google.com-full-page-2026-08-17.png

github.com-visible-2026-08-17.jpg
```

Use the browser's native downloads API rather than uploading anything.

---

# 15. Pause / Resume

When capturing:

```text
Capturing page...

██████████████░░░░░░ 68%

Section 17 of 25

[ Pause ] [ Cancel ]
```

When paused:

```text
Capture paused

Section 17 of 25

[ Resume ] [ Cancel ]
```

The capture session needs a state machine:

```text
IDLE
 ↓
ANALYZING
 ↓
PREPARING
 ↓
CAPTURING
 ↓
PAUSED
 ↓
CAPTURING
 ↓
STITCHING
 ↓
READY
```

Error:

```text
ERROR
```

Cancel:

```text
CANCELLED
```

This makes the system much easier to maintain.

---

# 16. Progress system

Don't fake progress.

Calculate:

```text
completedFrames / expectedFrames
```

For example:

```text
Capturing...

72%

18 / 25 sections
```

During stitching:

```text
Capturing complete ✓

Preparing screenshot...
```

Then:

```text
Rendering final image...
```

Finally:

```text
✓ Ready
```

---

# 17. Modern 2026 UI

I would **not** make the popup look like an old Chrome extension.

Use a modern compact interface:

```text
┌─────────────────────────────┐
│  ◉ ShotDock             ⚙   │
│                             │
│  Capture                    │
│                             │
│  ┌───────────────────────┐  │
│  │       Full Page       │  │
│  │  Capture entire page  │  │
│  └───────────────────────┘  │
│                             │
│  ┌────────────┐ ┌─────────┐ │
│  │  Visible   │ │  Area   │ │
│  └────────────┘ └─────────┘ │
│                             │
│  Recent                     │
│  ─────────────────────────  │
│  No captures yet            │
│                             │
└─────────────────────────────┘
```

Avoid:

* excessive gradients
* 20 settings on the first screen
* unnecessary animations
* giant logos
* complicated menus

**Speed is the product.**

---

# 18. One-click capture

The best feature could actually be something very simple:

### Toolbar click

Click ShotDock icon:

```text
Full Page
```

If the user has configured that as their default:

**capture immediately.**

This is much better for power users.

Settings:

```text
Default action

● Full Page
○ Visible Area
○ Ask every time
```

---

# 19. Keyboard shortcuts

Add:

```text
Alt + Shift + S
```

for:

**Full Page**

And:

```text
Alt + Shift + V
```

for:

**Visible Area**

Allow customization through Chrome's extension shortcut system where appropriate.

This turns ShotDock into a genuinely fast daily tool.

---

# 20. Capture result screen

After capture:

```text
┌────────────────────────────────────┐
│ ShotDock                         × │
│                                    │
│  example.com                       │
│  Full page · 1440 × 12840         │
│                                    │
│  ┌──────────────────────────────┐  │
│  │                              │  │
│  │       Screenshot preview     │  │
│  │                              │  │
│  └──────────────────────────────┘  │
│                                    │
│  PNG ▼                             │
│                                    │
│  [ Copy ]        [ Download ]      │
│                                    │
│  [ Capture Again ]                 │
└────────────────────────────────────┘
```

Don't automatically open a new tab unless the user wants an editor.

---

# 21. Privacy should be a major selling point

This can be one of ShotDock's strongest differentiators.

### Positioning:

**Your screenshots never leave your browser.**

No:

* screenshot server
* cloud upload
* analytics on page contents
* external image processing
* account required

Everything happens locally.

The extension should request the **minimum permissions possible**. Chrome's `activeTab` permission can provide temporary access after a user action without the warning associated with broad host permissions, so evaluate whether it can cover your intended capture flow rather than automatically requesting `<all_urls>`. ([Chrome for Developers][1])

This is particularly valuable because screenshots can contain:

* dashboards
* customer information
* private documents
* internal applications
* financial information

Privacy should therefore be a **product feature**, not just a technical detail.

---

# 22. Permissions strategy

Start with the smallest practical permission set.

Potential architecture:

```text
activeTab
scripting
downloads
offscreen
storage
```

Depending on the exact implementation, you may need additional permissions/host access.

Don't blindly add:

```text
<all_urls>
```

unless the architecture genuinely requires it.

Chrome specifically notes that `activeTab` can grant temporary access to the current tab after a user invocation. ([Chrome for Developers][1])

---

# 23. Settings

Keep settings minimal.

### Capture

```text
Default capture
[ Full Page ▼ ]

Default format
[ PNG ▼ ]

JPEG quality
[ 85 ]

Capture delay
[ Auto ▼ ]

Sticky elements
[ ✓ Handle automatically ]

Restore scroll position
[ ✓ ]
```

### Output

```text
After capture

[✓] Show preview
[✓] Download automatically
[ ] Copy automatically
```

### Appearance

```text
Theme

○ System
○ Light
○ Dark
```

---

# 24. Error handling

This is critical.

Possible problems:

### Restricted page

```text
ShotDock can't capture this page.

Chrome restricts extensions from accessing this type of page.

Try another webpage.
```

### Page changed during capture

```text
The page changed while ShotDock was capturing it.

[ Try Again ]
```

### Huge page

```text
This page is extremely large.

ShotDock couldn't safely render the complete image.

[ Capture in Sections ]
```

### Capture timeout

```text
Capture took too long.

[ Retry ]
```

Never expose:

```text
Error: undefined
```

or raw stack traces to users.

---

# 25. Important edge cases

Your test suite should include:

### Websites

* Wikipedia
* GitHub
* YouTube
* Amazon
* Reddit
* news websites
* documentation websites
* dashboards
* WordPress
* Shopify
* React applications
* Next.js applications

### Page types

* very short page
* 2× viewport page
* 10× viewport page
* 100× viewport page
* image-heavy page
* lazy-loading page
* infinite-scroll page
* sticky header
* sticky sidebar
* fixed cookie banner
* floating chat widget
* animated page
* dark mode
* mobile responsive layout

---

# 26. Critical browser limitations

You should design ShotDock around the browser's actual constraints instead of promising impossible behavior.

`captureVisibleTab()` captures the **visible area**. Full-page capture therefore requires the capture engine to coordinate scrolling and multiple captures unless you use another browser-specific mechanism. Chrome also documents that `captureVisibleTab()` is expensive and currently caps calls at two per second. ([Chrome for Developers][1])

Also, some browser-internal/restricted pages cannot be handled like ordinary webpages. Your UX needs to recognize this and explain it clearly.

---

# 27. AI features — but don't make AI gimmicky

Since you said **2026 modern features**, I would make AI an **optional second layer**, not part of the core capture engine.

The core product should work perfectly with:

> **No AI. No account. No server.**

Then add:

### Smart Screenshot

After capture:

```text
✨ Smart Actions

Summarize screenshot
Extract text
Explain UI
Identify important sections
Generate alt text
```

But these should be optional.

For example:

**Generate alt text**

> "A dashboard showing monthly revenue, user growth, and recent transactions."

Or:

**Extract text**

```text
Copy all visible text
```

This can become a future premium feature.

---

# 28. Future ShotDock AI

Eventually:

### AI Screenshot Understanding

```text
Screenshot
    ↓
Vision model
    ↓
Understand UI
    ↓
Actions
```

Possible commands:

> "Summarize this page."

> "Extract all prices."

> "Find the email address."

> "Explain this dashboard."

> "Turn this screenshot into a design specification."

> "Create accessibility alt text."

But **don't put any of this into v1**.

Build the screenshot infrastructure correctly first.

---

# 29. The standout feature I'd add

Instead of trying to compete with every screenshot extension, make one feature extremely good:

## **Smart Full Page**

User presses:

**Full Page**

ShotDock automatically:

1. Detects page dimensions
2. Detects sticky elements
3. Detects lazy content
4. Calculates capture positions
5. Scrolls
6. Captures
7. Removes duplicate fixed elements
8. Detects overlaps
9. Stitches
10. Restores the webpage
11. Shows the result

User shouldn't need to understand any of this.

That's the magic.

---

# 30. "Capture Intelligence"

I'd actually give this subsystem a name internally:

### ShotDock Capture Intelligence

```text
┌─────────────────────────┐
│ Capture Intelligence    │
├─────────────────────────┤
│ Page Analyzer           │
│ Scroll Planner          │
│ Layout Stabilizer       │
│ Fixed Element Handler   │
│ Frame Manager           │
│ Seam Detector           │
│ Stitching Engine        │
│ Recovery Manager        │
└─────────────────────────┘
```

This becomes your technical advantage.

---

# 31. Architecture for future expansion

Don't make the capture engine directly tied to the popup.

Use:

```text
Capture Engine
       │
       ├── Popup
       ├── Side Panel
       ├── Keyboard Shortcut
       └── Context Menu
```

Then later:

```text
Capture Engine
       │
       ├── Screenshot
       ├── PDF
       ├── Recording
       ├── Annotation
       └── AI
```

That gives ShotDock room to grow.

---

# 32. Roadmap

## Phase 1 — Foundation

* Manifest V3
* TypeScript
* Build system
* Service worker
* messaging architecture
* popup
* permissions
* settings

## Phase 2 — Basic capture

* Visible Area
* PNG
* JPG
* Download
* Clipboard

## Phase 3 — Full Page

* page analyzer
* dimension detection
* scroll controller
* capture planner
* frame management
* stitching

## Phase 4 — Reliability

* fixed elements
* sticky elements
* lazy loading
* dynamic pages
* long pages
* cancellation
* pause/resume
* recovery
* error handling

## Phase 5 — Modern UX

* polished popup
* progress system
* preview
* keyboard shortcuts
* capture history
* default actions
* dark/light/system theme

## Phase 6 — Quality

Test across:

* Chrome
* Chromium-based browsers
* high-DPI displays
* different zoom levels
* different viewport sizes
* long pages
* complex websites

## Phase 7 — Future

* annotation
* blur/redaction
* PDF
* share
* AI
* screenshot history
* cloud sync — **optional**

---

# 33. Version roadmap

### ShotDock 1.0

**The Screenshot Tool**

* Full Page
* Visible Area
* PNG/JPG
* Copy
* Download
* Progress
* Pause
* Cancel
* Smart scrolling
* Smart stitching
* Fixed-element handling

### ShotDock 1.5

**The Screenshot Workspace**

* History
* Preview
* Rename
* Delete
* Annotation
* Crop
* Blur
* Highlight

### ShotDock 2.0

**The Web Capture Workspace**

* PDF
* Advanced editor
* Screenshot collections
* Share
* Better export
* keyboard workflows

### ShotDock AI

**Understand what you captured**

* OCR
* summarize
* extract
* describe
* analyze
* generate alt text
* AI-assisted annotation

---

# 34. The most important UX principle

Don't make the user think:

> "How do I capture this website?"

Make it:

> **Click → Wait → Done.**

The technical complexity should be completely hidden.

---

# 35. Final product definition

### **ShotDock**

**Category:** Browser productivity / screenshot

**Primary promise:**

> **Capture any webpage from top to bottom in one click.**

**Core differentiators:**

* ⚡ One-click capture
* 🧠 Smart full-page detection
* 🧩 Clean stitching
* 🧲 Sticky-element intelligence
* 📐 Automatic sizing
* ⏸️ Pause/resume
* 🖼️ PNG/JPG
* 📋 Instant clipboard
* 💾 Instant download
* 🔒 Local/private processing
* 🌐 Handles very long pages
* ✨ AI-ready architecture

### The product hierarchy should be:

**Capture first → Perfect the screenshot → Export instantly → Edit later → AI eventually.**

That keeps **ShotDock simple for normal users while making the underlying technology sophisticated enough to stand out in 2026.**

For the implementation, I'd also keep the image-processing pipeline isolated from the service worker. Chrome's Offscreen Documents are specifically intended to provide DOM-capable hidden documents for MV3 use cases where service workers can't provide DOM functionality, and Chrome's storage APIs are available across extension components for settings/state. ([Chrome for Developers][3])

[Chrome Extensions API documentation](https://developer.chrome.com/docs/extensions/reference/api/?utm_source=chatgpt.com)
[Chrome tabs API — captureVisibleTab](https://developer.chrome.com/docs/extensions/reference/api/tabs?utm_source=chatgpt.com)
[Chrome Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen?utm_source=chatgpt.com)

[1]: https://developer.chrome.com/docs/extensions/reference/api/tabs?hl=en&utm_source=chatgpt.com "chrome.tabs  |  API  |  Chrome for Developers"
[2]: https://developer.chrome.com/docs/extensions/reference/manifest?hl=en&utm_source=chatgpt.com "Manifest file format  |  Chrome for Developers"
[3]: https://developer.chrome.com/docs/extensions/reference/api/offscreen?utm_source=chatgpt.com "chrome.offscreen  |  API  |  Chrome for Developers"
