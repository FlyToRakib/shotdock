# ShotDock — Social Share Copy

Launch and evergreen copy for Facebook, LinkedIn, X/Twitter and YouTube. Everything here describes
ShotDock 1.0.0 **as built** — full page and visible area capture, PNG/JPG, copy/download/preview,
pause–resume–cancel, sticky-element handling, seam-aware stitching, part-splitting past canvas
limits, five permissions, no host permissions, no network requests. Nothing on the roadmap
(annotation, OCR, PDF, capture history) is claimed anywhere below.

- **Product:** ShotDock — Full Page Screenshot · v1.0.0 · Chrome (MV3, Chrome 116+)
- **Maker:** Degird · hello@degird.com
- **Licence:** MIT, open source
- **Price:** Free
- **Character counts** below were measured on the exact strings given.

## Links to paste

| Where | URL |
| ----- | --- |
| **Chrome Web Store** (live) | https://chromewebstore.google.com/detail/shotdock-%E2%80%94-full-page-scre/jfjemodmlmbednhkbhedipnbgniffaaa |
| Store — short form | https://chromewebstore.google.com/detail/jfjemodmlmbednhkbhedipnbgniffaaa |
| Reviews page | https://chromewebstore.google.com/detail/jfjemodmlmbednhkbhedipnbgniffaaa/reviews |
| Product page | https://degird.com/products#extensions |
| Support | https://degird.com/support |
| Privacy policy | `TODO — host publicly before launch (currently a Google Doc)` |
| More Degird tools | https://chromewebstore.google.com/search/degird |

The store URL is filled in throughout every post below. Two notes on which form to paste:

- The **canonical URL** carries a `%E2%80%94` where the em dash in the extension name is encoded. It
  works everywhere and is what the store itself hands you, but it looks like line noise when a
  platform renders the raw URL rather than a link card. Use it on Facebook and LinkedIn, where the
  URL collapses into a preview card and is never read as text.
- The **short form** — just the extension ID — redirects to the same page and is far cleaner when the
  URL stays visible as text: X, the YouTube description, and anywhere someone might read it aloud.
  Worth loading once to confirm the redirect before launch day.

> The privacy policy is still a genuine gap — `APP_LINKS.privacy` in `src/ui/links.ts` points at a
> Google Doc. Host the text from `docs/store-listing.md` §7 at a real degird.com URL before the first
> post goes out; the privacy-first angle is the whole argument here, and a Google Doc undercuts it.

> **On the character counts below:** each count measures the post text *excluding* the URL, since the
> two URL forms differ by 77 characters. X is the only platform where this matters and it is generous
> there — every link counts as exactly 23 characters regardless of its real length, so a 232-character
> post plus any URL lands at 255 and clears the 280 limit.

## The one-line positioning

**A full page screenshot tool with nothing to trust it with.**

Three angles carry every post here, in descending order of strength:

1. **Privacy is structural, not promised.** No host permissions at all — access is granted to a
   single tab, at the moment you capture it, and lapses when you navigate away. Nothing is uploaded
   because there is no server to upload to.
2. **The output is actually correct.** Sticky headers do not march down the image; frames overlap on
   purpose and align on where the page really landed; high-DPI, page zoom and mid-capture reflow all
   come out right.
3. **Long pages are handled, not refused.** Live progress, pause/resume/cancel, and output beyond
   the browser's canvas limit split into numbered parts rather than failing.

---

## 1. Facebook

Facebook truncates the post body at roughly 400 characters behind a "See more", so the hook and the
proof must land in the first two lines. Link posts pull the Open Graph image; keep the URL on its own
line at the end.

### 1.1 Launch post — primary

> Most full-page screenshot extensions send your screenshot to a server before you ever see it.
>
> ShotDock doesn't have a server.
>
> Click it, pick Full Page or Visible Area, and the whole page comes back as one clean image —
> scrolled, stitched and encoded entirely inside your browser. No account, no upload, no watermark,
> no sign-in wall on the third screenshot.
>
> It also gets the boring parts right: sticky headers stay in the first section instead of marching
> down the image, long pages show progress you can pause or cancel, and your page is put back exactly
> as you found it, scroll position included.
>
> Free, open source, and it asks for zero access to the sites you visit.
>
> 👉 https://chromewebstore.google.com/detail/shotdock-%E2%80%94-full-page-scre/jfjemodmlmbednhkbhedipnbgniffaaa

*Body: ~640 characters. Hook line: 93 characters — inside the fold.*

### 1.2 Short variant — for groups and reshares

> Full page screenshot, one click, never leaves your browser. No account, no upload, no watermark.
> ShotDock is free and open source. 👉 https://chromewebstore.google.com/detail/shotdock-%E2%80%94-full-page-scre/jfjemodmlmbednhkbhedipnbgniffaaa

*~140 characters.*

### 1.3 Problem-first variant

> You screenshot an internal dashboard. The extension uploads it to render it. Now your dashboard is
> on someone else's server.
>
> That's the whole reason ShotDock exists. Capture, stitching and encoding all run inside your
> browser — there is no ShotDock backend for your screenshot to travel to.
>
> Full page or visible area, PNG or JPG, copy or download. Free and open source.
>
> 👉 https://chromewebstore.google.com/detail/shotdock-%E2%80%94-full-page-scre/jfjemodmlmbednhkbhedipnbgniffaaa

*~385 characters.*

### 1.4 Feature spotlight — sticky headers

> Why naive full-page screenshots look broken: the fixed header re-renders into every scroll frame,
> so it marches down the finished image like a staircase.
>
> ShotDock keeps it in the first section — where it genuinely belongs — and hides it for the rest,
> using visibility so nothing reflows underneath.
>
> Small detail. It's the difference between a screenshot you can send and one you have to apologise
> for. 👉 https://chromewebstore.google.com/detail/shotdock-%E2%80%94-full-page-scre/jfjemodmlmbednhkbhedipnbgniffaaa

*~430 characters.*

### 1.5 Suggested image captions

- "One click. The whole page. Nothing uploaded."
- "Alt+Shift+S. That's the entire workflow."
- "Zero host permissions. Nothing to trust it with."

---

## 2. LinkedIn

LinkedIn cuts at about 210 characters on desktop and 140 on mobile before "…see more", so the first
two short lines do all the work. Posts with no outbound link in the body reach further — put the
store URL in the first comment and say so. Hashtags belong at the end, three to five, no more.

### 2.1 Launch post — maker's story (primary)

> I shipped a screenshot extension that cannot send your screenshot anywhere.
>
> Not "we promise we don't". Cannot — there is no backend to send it to.
>
> ShotDock captures a full web page as one image: it scrolls the page, captures each section, and
> stitches them together. All of it happens inside your browser. The capture, the stitching, the
> PNG/JPG encoding — none of it touches a network.
>
> Three things I cared about more than shipping fast:
>
> → No host permissions. ShotDock never asks to "read your data on all websites". Chrome grants it
> one tab, at the moment you click capture, and revokes it when you navigate away.
>
> → Seams are a geometry problem, not a luck problem. Sections overlap deliberately, and the
> stitcher aligns on where the page actually landed rather than where it was told to go — because
> browsers clamp scrolls and lazy content shifts layout mid-capture.
>
> → The page is always restored. Scroll position, sticky headers, styles. Everything touched is
> reverted, and if the extension is suspended mid-capture the page restores itself on a timer.
>
> Free, open source (MIT), Chrome 116+.
>
> Link in the first comment. If you archive layouts, file visual bugs, or attach evidence to
> tickets, I'd genuinely like to know what breaks.
>
> #ChromeExtension #PrivacyByDesign #WebDevelopment #OpenSource

*Body: ~1,290 characters — comfortably inside LinkedIn's 3,000-character limit. Hook: 75 characters.*

### 2.2 Short professional variant

> Full page screenshots, without the upload step.
>
> ShotDock captures, stitches and encodes entirely inside your browser — no screenshot server, no
> account, no watermark, and no host permissions. Useful if you screenshot dashboards, admin panels
> or anything under NDA and would rather it not round-trip through a third party.
>
> Free and open source. Link in comments.
>
> #ChromeExtension #Privacy #DevTools

*~365 characters.*

### 2.3 Audience-specific variants

**For QA and support teams**

> Attaching a screenshot to a ticket shouldn't mean uploading your staging environment to a stranger.
>
> ShotDock captures the full page locally — scrolling, stitching and encoding all inside the browser
> — then copies to clipboard or saves to a ShotDock folder. Long pages show progress you can pause or
> cancel, and the page is restored exactly as you found it.
>
> Free, open source, no account. Link in comments.

*~410 characters.*

**For designers**

> Archiving a layout is not the same as taking a screenshot.
>
> ShotDock handles what breaks naive full-page capture: fixed headers repeating in every section,
> seams from rounding on high-DPI screens, lazy content shifting layout mid-scroll, and pages so long
> they exceed the browser's canvas limit (those split into numbered parts instead of failing).
>
> PNG for lossless UI, JPG when size matters, switchable after the capture. Free and open source.

*~430 characters.*

### 2.4 First comment (paste immediately after posting)

> Chrome Web Store: https://chromewebstore.google.com/detail/shotdock-%E2%80%94-full-page-scre/jfjemodmlmbednhkbhedipnbgniffaaa
> Source and technical notes: [repo link]
> Built by Degird — questions to hello@degird.com

---

## 3. X / Twitter

280 characters per post on a free account. Each post below is a standalone tweet **and** works as a
thread; counts are given per post. Lead with the claim, not the product name — the name lands in the
last post with the link.

### 3.1 Launch thread

**1/5** *(230 characters)*

> Every "full page screenshot" extension I tried uploaded my screenshot to someone's server first.
>
> So I built ShotDock. Capture, stitch, encode — all inside your browser. No server, no account, no
> watermark.
>
> Free and open source 👇

**2/5** *(201 characters)*

> Why most full-page screenshots look broken: the sticky header re-renders into every frame and
> marches down the image.
>
> ShotDock keeps it in the first frame, where it belongs, and hides it for the rest.

**3/5** *(223 characters)*

> ShotDock asks for zero host permissions.
>
> No "read your data on all websites". Access is granted to one tab, at the moment you capture it,
> and lapses when you navigate away.
>
> A screenshot tool with nothing to trust it with.

**4/5** *(232 characters)*

> Alt+Shift+S → whole page.
> Alt+Shift+V → what's on screen.
>
> PNG or JPG, copy or download, pause mid-capture on a long one. Pages past Chrome's canvas limit
> split into parts instead of failing.
>
> ShotDock, free on the Chrome Web Store.

**5/5** *(~120 characters + link)*

> Free, MIT licensed, Chrome 116+. No account, ever.
>
> https://chromewebstore.google.com/detail/shotdock-%E2%80%94-full-page-scre/jfjemodmlmbednhkbhedipnbgniffaaa
>
> Tell me what page breaks it — I want the bug.

### 3.2 Standalone posts

**Privacy angle** *(~180 characters)*

> "We don't store your screenshots" is a promise.
>
> "There is no server to store them on" is an architecture.
>
> ShotDock is the second one. Free full page screenshots, Chrome. https://chromewebstore.google.com/detail/shotdock-%E2%80%94-full-page-scre/jfjemodmlmbednhkbhedipnbgniffaaa

**Craft angle** *(~268 characters)*

> Nerdy detail I'm proud of in ShotDock: every stitched frame is drawn starting exactly where the
> previous one stopped, and its source crop is derived from that destination — never the reverse.
>
> Rounding therefore can't open a seam. There's a test that enforces it.

**Utility angle** *(~163 characters)*

> Screenshotting a 40,000px page shouldn't need an account.
>
> ShotDock: full page → one image, entirely in your browser. Pause, resume, cancel. Free. https://chromewebstore.google.com/detail/shotdock-%E2%80%94-full-page-scre/jfjemodmlmbednhkbhedipnbgniffaaa

**Reply-bait / engagement** *(~147 characters)*

> Genuine question: why does a screenshot tool need a login?
>
> Built ShotDock without one. Full page capture, all local, free and open source. https://chromewebstore.google.com/detail/shotdock-%E2%80%94-full-page-scre/jfjemodmlmbednhkbhedipnbgniffaaa

### 3.3 Bio / pinned-post line

> ShotDock — full page screenshots that never leave your browser. Free, open source, no account.

*94 characters.*

---

## 4. YouTube

A demo video is optional for the Chrome Web Store but is a first-class Product Hunt asset, so the
titles and description below are written to serve both. Keep the video 45–90 seconds and
silent-friendly; most autoplay views are muted.

### 4.1 Titles

| Option | Title | Chars |
| ------ | ----- | ----- |
| A (brand-first) | ShotDock — Full Page Screenshots That Never Leave Your Browser | 62 |
| B (search-first) | Full Page Screenshot in Chrome — No Upload, No Account (ShotDock) | 65 |
| C (problem-first) | Stop Uploading Your Screenshots — Full Page Capture, 100% Local | 63 |

*YouTube allows 100 characters; roughly 60 survive before truncation in search and suggested feeds.
All three fit.*

### 4.2 Description

The first 120–150 characters appear above the fold and in search results — the block below is written
so the fold falls after the second line.

> ShotDock captures a full page screenshot in Chrome without uploading it anywhere. Everything
> happens inside your browser.
>
> Get ShotDock (free): https://chromewebstore.google.com/detail/shotdock-%E2%80%94-full-page-scre/jfjemodmlmbednhkbhedipnbgniffaaa
>
> ⏱ Chapters
> 00:00 The problem with full-page screenshots
> 00:12 Capturing a full page
> 00:32 Sticky headers, handled
> 00:45 PNG or JPG, copy or download
> 00:58 Why it needs no host permissions
>
> 🧩 What ShotDock does
> • Full page capture — scrolls the page and joins every section into one image
> • Visible area capture — one click for what's on screen
> • Sticky headers, floating nav and cookie banners kept in the first section, hidden afterwards
> • Seam-aware stitching that aligns on where the page actually landed
> • PNG or JPG with adjustable quality, switchable after the capture
> • Copy to clipboard, download to a ShotDock folder, or open full size in a tab
> • Keyboard shortcuts: Alt+Shift+S full page, Alt+Shift+V visible area (rebindable)
> • Live progress with pause, resume and cancel on long pages
> • Pages beyond the browser's canvas limit split into numbered parts instead of failing
>
> 🔒 Why it's private by construction
> ShotDock requests no host permissions. Chrome grants access to a single tab at the moment you
> capture it, and that access lapses when you navigate away. The capture, stitching and encoding all
> run locally inside the extension. There is no ShotDock server, no account and no analytics.
>
> 🔗 Links
> Chrome Web Store: https://chromewebstore.google.com/detail/shotdock-%E2%80%94-full-page-scre/jfjemodmlmbednhkbhedipnbgniffaaa
> Product page: https://degird.com/products#extensions
> Support: https://degird.com/support
> Privacy policy: [privacy policy URL — see docs/store-listing.md §7]
> More Degird tools: https://chromewebstore.google.com/search/degird
>
> Free and open source under the MIT licence. Chrome 116+.
> Built by Degird — hello@degird.com
>
> #screenshot #chromeextension #privacy #webdesign #productivity

*Well inside YouTube's 5,000-character description limit.*

### 4.3 Tags

`full page screenshot`, `chrome screenshot extension`, `scrolling screenshot`, `screenshot without
upload`, `private screenshot tool`, `capture webpage`, `chrome extension`, `screenshot long page`,
`webpage screenshot`, `shotdock`, `degird`, `manifest v3 extension`

*YouTube caps tags at 500 characters total; the list above is ~230.*

### 4.4 Shorts / vertical cut

**Title (under 60):** `Full page screenshot. Zero uploads. 15 seconds.` — 46 characters

**On-screen text beats, one per shot:**

1. "Full page screenshot in Chrome"
2. "Watch the sticky header…" → show it *not* repeating
3. "40,000 pixels. One image."
4. "Nothing was uploaded."
5. "ShotDock — free, open source"

**Description:** `Full page screenshots that stay on your device. Free and open source. Link in
comments. #screenshot #chromeextension #privacy`

### 4.5 Thumbnail direction

Brand palette is fixed — graphite ground `#111827`, surface `#1f2937`, lime accent `#aeed22` on dark
only, never lime text on white (1.4:1, unreadable). Suggested composition: the long stitched
screenshot running vertically off-frame on the right, four words of lime text on graphite on the left
("THE WHOLE PAGE" / "NOTHING UPLOADED"), toolbar icon bottom-left. No faces, no red arrows — the
audience for a privacy tool reads those as bait.

---

## 5. Cross-platform rules

**Say, everywhere:** free · open source (MIT) · no account · no upload · no watermark · no host
permissions · full page and visible area · PNG/JPG · Chrome 116+.

**Never say:** "best", "#1", "unlimited", any speed figure ("in 2 seconds"), any user or download
count, "works on every site" (chrome:// and Web Store pages are off limits to every extension), or
anything from the roadmap — annotation, blur, crop, OCR, PDF export, capture history and AI features
are **not** in 1.0.0.

**Tone:** plain, specific, slightly technical. The differentiators are structural facts, and they
persuade precisely because they are checkable. Let them be the argument — no exclamation marks, no
"game-changer", no emoji-per-line lists outside YouTube.

**Posting order on launch day:** Product Hunt goes live first (12:01 AM PT), then the X thread, then
LinkedIn, then Facebook. The YouTube video should be public and tested the day *before*, so the PH
gallery embed and the LinkedIn post can both point at a live URL.
