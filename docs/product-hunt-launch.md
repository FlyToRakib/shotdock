# ShotDock — Product Hunt Launch Kit

Everything the Product Hunt submission form asks for, filled in and ready to paste. Written against
ShotDock 1.0.0 exactly as built: full page and visible area capture, PNG/JPG, copy/download/preview,
pause–resume–cancel, sticky-element handling, seam-aware stitching, part-splitting past canvas
limits, five permissions, no host permissions, no network requests, MIT licence, Chrome 116+.

**Nothing on the roadmap is claimed anywhere in this document** — annotation, crop, blur, PDF export,
collections, capture history and AI/OCR are not in 1.0.0 and must not appear in any field.

> **On character limits:** Product Hunt tunes its form from time to time and the live counter is the
> authority. Every value below is written comfortably *under* the stated limit so a small change to
> the cap can't break a field. Where a limit is the one that actually bites (tagline, description),
> the exact count of the supplied string is given.

---

## 0. Pre-flight checklist — do not launch with any of these unticked

| # | Item | Status | Notes |
| - | ---- | ------ | ----- |
| 1 | Extension **live on the Chrome Web Store** | ☑ | Live at [`…/jfjemodmlmbednhkbhedipnbgniffaaa`](https://chromewebstore.google.com/detail/shotdock-%E2%80%94-full-page-scre/jfjemodmlmbednhkbhedipnbgniffaaa). Full URL in §4. |
| 2 | **Privacy policy on a public URL** | ☐ | `APP_LINKS.privacy` in `src/ui/links.ts` still points at a Google Doc. Host the text from `docs/store-listing.md` §7 at a real degird.com URL and update the constant. **Blocker.** |
| 3 | **Thumbnail** 240×240 | ☐ | See §7.1. |
| 4 | **Gallery images** — at least 3, ideally 5–6, 1270×760 | ☐ | See §7.2. The repo ships no screenshots; these must be produced. **Blocker.** |
| 5 | **Demo video or GIF** | ☐ | Optional but the single highest-leverage asset. See §7.3 and `docs/social-share-copy.md` §4. |
| 6 | **Maker account** ≥ 1 week old, with a filled-out profile | ☐ | New accounts get their launches down-ranked or held for review. |
| 7 | **`reviewUs` link** updated to the real Web Store reviews URL | ☐ | `src/ui/links.ts` still points at the Degird products page. Now knowable: `https://chromewebstore.google.com/detail/jfjemodmlmbednhkbhedipnbgniffaaa/reviews`. Ships in the next build. |
| 8 | **Support inbox monitored** on launch day | ☐ | hello@degird.com and degird.com/support. |
| 9 | Launch **scheduled for 12:01 AM PT** | ☐ | The day's ranking window starts then; launching mid-day forfeits hours of exposure. |
| 10 | Day-of social posts drafted | ☐ | `docs/social-share-copy.md`. |
| 11 | Maker's first comment drafted (§5) | ☐ | Post it within a minute of going live. |
| 12 | FAQ answers pre-written (§8) | ☐ | Reply speed is a ranking input; do not compose from scratch under load. |

---

## 1. Product name

**Field limit: 40 characters.**

```
ShotDock
```

**8 characters.**

Just the brand name. The Chrome Web Store title carries the descriptive suffix ("— Full Page
Screenshot") because store search needs it; Product Hunt does not — PH has a dedicated tagline field
directly beneath the name, and duplicating the keyword in both reads as SEO-stuffing to a human
audience. Keep the name clean and let the tagline work.

---

## 2. Tagline

**Field limit: 60 characters.** This is the most important string in the entire launch — it is what
appears in the feed, in the newsletter, and in every share card.

**Primary:**

```
Full page screenshots that never leave your browser
```

**51 characters.**

Names the category ("full page screenshots") and the one differentiator ("never leave your browser")
in a single readable clause, with no jargon and no throat-clearing.

**Alternates, all under the limit:**

| Tagline | Chars | When to prefer it |
| ------- | ----: | ----------------- |
| Private full page screenshots, right in your browser | 52 | If the audience skews privacy-first |
| Full page screenshots with no server and no account | 51 | If competitors' signup walls are the sharper contrast |
| Screenshot any full page. Nothing gets uploaded. | 48 | Punchiest; two sentences read well on mobile |

---

## 3. Description

**Field limit: 260 characters.** Shown under the tagline on the product page and in the feed
preview.

```
ShotDock captures a full page or the visible area as one clean image. Scrolling, stitching and encoding all happen inside your browser: no upload, no account, no watermark, no host permissions. Sticky headers handled, seams not. Free and open source.
```

**250 characters** — ten to spare.

**Alternate (240 characters):**

```
Click once, get the whole page as one image. ShotDock scrolls, stitches and encodes entirely inside your browser — no screenshot server, no account, no watermark. Handles sticky headers, lazy loading and very long pages. Free, MIT licensed.
```

---

## 4. Links

| Field | Value |
| ----- | ----- |
| **Website / main link** (required) | https://chromewebstore.google.com/detail/shotdock-%E2%80%94-full-page-scre/jfjemodmlmbednhkbhedipnbgniffaaa |
| Additional link — Product page | https://degird.com/products#extensions |
| Additional link — Support | https://degird.com/support |
| Additional link — Privacy policy | `TODO — public URL required, see §0 item 2` |
| Additional link — Source / repo | `TODO — public repo URL if the MIT source is published` |
| Additional link — More Degird tools | https://chromewebstore.google.com/search/degird |

The main link must be the Chrome Web Store page, not degird.com. PH visitors are one click from
installing; sending them to a marketing page first loses most of them.

---

## 5. Maker's first comment

**No hard character limit; length is a judgement call.** Post it the moment the launch goes live —
it sets the tone of the whole comment thread and is the second thing every visitor reads.

```
Hi Product Hunt 👋

I'm Rakib, and I build small Chrome tools at Degird.

ShotDock started with an annoyance. I needed a full-page screenshot of an internal dashboard,
installed the first extension I found, and watched it upload my dashboard to a rendering server so it
could hand the image back to me. That is a completely ordinary way for these tools to work, and I
found it hard to accept.

So ShotDock has no server. Capture, stitching and PNG/JPG encoding all happen inside your browser.
There is no account, no upload step, no watermark, and no ShotDock backend for a screenshot to
travel to.

The part I'd most like feedback on is what makes full-page screenshots hard rather than what makes
them private:

🔸 Sticky headers. A fixed header re-renders into every scroll frame, which is why naive full-page
screenshots have a header marching down them like a staircase. ShotDock keeps it in the first
section, where it genuinely belongs, and hides it for the rest — via visibility, so nothing reflows
underneath.

🔸 Seams. Sections overlap on purpose, and the stitcher aligns on where the page actually landed
after each scroll rather than where it was asked to go — browsers clamp scrolls, lazy content shifts
layout mid-capture, and scroll-snap lands where it likes. Each frame is drawn starting exactly where
the previous one stopped, so rounding can't open a gap. There's a test that enforces it.

🔸 Restoring the page. Everything ShotDock touches is reverted in a finally block, and if the browser
suspends the extension mid-capture the page restores itself on a watchdog timer. Your scroll
position comes back too.

🔸 Really long pages. Live progress you can pause, resume or cancel — and output past the browser's
canvas limit splits into numbered parts instead of failing outright.

One design decision worth calling out: ShotDock requests **no host permissions at all**. It never
asks to "read your data on all websites". Chrome grants access to a single tab at the moment you
click capture, and that access lapses when you navigate away.

It's free, MIT licensed, Chrome 116+, and there is no paid tier planned for what 1.0 does.

What's next, in order: capture history, then annotation/crop/blur, then PDF and collections. None of
that is in today's build.

I'll be here all day. Throw your ugliest page at it — an infinite feed, a dashboard with four fixed
panels, a site with a cookie banner that won't die — and tell me what breaks. Bug reports are the
most useful thing you can leave me. 🙏
```

**Note before posting:** replace the maker name if someone else is fronting the launch, and confirm
"no paid tier planned" is a promise Degird wants on the record — it is a strong trust signal on PH,
and equally a thing people will quote back later.

---

## 6. Categorisation and settings

| Field | Value | Notes |
| ----- | ----- | ----- |
| **Topics / categories** (max 3) | `Chrome Extensions`, `Productivity`, `Privacy` | Chrome Extensions is the category people browse to find this. Privacy is the differentiator and a smaller, more engaged topic — worth the slot. Design Tools is the runner-up if Privacy is unavailable. |
| **Pricing / "Is it free?"** | **Free** | Not "freemium" and not "free trial". There is no paid tier, no usage cap and no account. |
| **Platforms** | Chrome Extension (web) | Chrome 116+ and Chromium browsers that support MV3. Do not claim Firefox or Safari — the build targets Chrome APIs. |
| **Launch date/time** | 12:01 AM PT on the chosen day | Tue/Wed/Thu are the highest-traffic and highest-competition days; Sat/Sun are quieter with a genuinely easier top-5. |
| **Makers** | Add every real contributor; each maker's network is a distribution channel | Only tag people who actually built it. |
| **Promo code** | n/a — the product is free | |
| **Interactive demo** (optional) | Skip, or link the YouTube demo | A browser extension can't be meaningfully embedded; video is the better use of the slot. |
| **Shoutouts** (max 3) | `Vite`, `Vitest`, `React` — blurbs in §6.1 | Only tools actually in `package.json`. |

---

### 6.1 Shoutouts — the three to use

Product Hunt allows up to three, and reads them as credits: a shoutout to something you didn't
actually use is the kind of claim a commenter checks. All three below are real entries in
[package.json](../package.json). Each takes a short note in the form.

**1. Vite** — the build tool

> ShotDock is two Vite builds — one for the extension surfaces, one for the content script — and the
> whole thing goes from source to a loadable `dist/` in seconds. Watch mode is what made iterating on
> a Manifest V3 extension bearable.

**2. Vitest** — the test runner

> The seam-free stitching in ShotDock is a geometric invariant, not a lucky result, and the only
> reason I can say that is that Vitest holds it: every frame drawn exactly where the last one
> stopped, at 1×, 2× and fractional device-pixel ratios. Silent bugs need fast tests.

**3. React** — the UI layer

> The popup, the options page and the full-size preview tab are all React, sharing one header, footer
> and set of design tokens. The capture engine sends state out and the surfaces just render it —
> which is what lets the same engine serve a popup and a keyboard shortcut without changes.

**Substitute if a slot won't resolve:** `TypeScript` (in `devDependencies`, and the message contract
between the service worker, content script and offscreen document is the reason the capture flow is
debuggable at all). Confirm each name resolves in PH's shoutout search before launch day — some dev
tools have thin or unclaimed pages, and an unresolvable name wastes the slot.

---

## 7. Media assets

**None of these exist in the repo yet — all must be produced.** The build outputs no screenshots, and
the same gap blocks the Chrome Web Store submission (which mandates at least one 1280×800 or 640×400
PNG), so producing them once serves both launches.

Brand palette is fixed and load-bearing — graphite `#111827`, surface `#1f2937`, lime `#aeed22`.
There is no light theme: the lime is very light (L\* ≈ 87), so it may only appear as a filled shape
carrying dark `#111827` text, never as text on white. Every asset sits on the dark ground.

### 7.1 Thumbnail — 240×240

Required. Shown at ~40px in the feed, so it must survive being tiny.

- The ShotDock mark (lime camera) centred on graphite `#111827`.
- No wordmark, no tagline, no border — at feed size text becomes noise.
- Source: `public/icons/icon128.png`, upscaled or re-exported at 240×240. Do not letterbox a wide
  image into the square.
- An animated GIF thumbnail is permitted and does draw the eye; if used, keep it under 3 MB and make
  the first frame stand alone.

### 7.2 Gallery — 1270×760, at least 3, ideally 5–6

The first gallery image is the hero and appears in share cards. Order matters; each image should
make one point, legible at half size.

| # | Shot | The one point it makes |
| - | ---- | ---------------------- |
| 1 | **Hero.** The stitched full-page result on the left, the ShotDock popup overlaid on the right, headline in lime on graphite: "The whole page. One image. Nothing uploaded." | What it is, in one glance |
| 2 | **Before/after sticky header.** Side by side: a naive capture with the header repeating down the image vs. ShotDock's clean single header | The craft differentiator |
| 3 | **The popup, real.** Home state — Full Page / Visible Area, format toggle, keyboard shortcut hints | It's one click, and it looks good |
| 4 | **Progress mid-capture.** Live progress bar with Pause and Cancel visible on a long page | Long pages are handled, not endured |
| 5 | **Permissions.** Chrome's own install dialog showing the modest permission set, annotated: "No 'read your data on all websites'" | Privacy claim, proven by Chrome's UI rather than asserted |
| 6 | **Result actions.** Copy / Download / Open full size, plus the preview tab at zoom | What you get afterwards |

Production notes: capture on a real, recognisable public page (a long Wikipedia article and a
documentation site both work well and carry no NDA risk). Never use a real dashboard, inbox, or
anything containing a real person's data — a privacy product leaking a customer's screen in its own
gallery is the one unrecoverable launch mistake. Keep type at 24px+ at 1270×760.

### 7.3 Video — optional, high leverage

45–90 seconds, silent-friendly, hosted on YouTube. Full title, description, tags and chapter list are
in [docs/social-share-copy.md](social-share-copy.md) §4. Structure:

1. **0:00–0:10** The problem: a long page, and a naive screenshot with the header marching down it.
2. **0:10–0:30** One click on ShotDock → progress → the finished image. Real time, uncut.
3. **0:30–0:45** Copy, download, switch PNG→JPG, open full size.
4. **0:45–0:60** The permissions dialog and the words "no host permissions".
5. **0:60–end** Free, open source, Chrome Web Store link.

Show the network panel empty during a capture if you can frame it legibly — it is the only way to
*demonstrate* the core claim rather than state it.

---

## 8. Pre-written answers to likely comments

Reply speed and substance are what keep a launch near the top. Draft these, keep the file open on the
day, and adapt rather than compose.

**"How is this different from the built-in Chrome full-size screenshot in DevTools?"**
> DevTools' capture works and is genuinely useful — it's just five steps deep (F12 → Cmd/Ctrl+Shift+P
> → "full size screenshot"), it has no visible-area shortcut, no format or quality choice, no
> progress, no pause, and it struggles with sticky headers and lazy-loaded content on long pages.
> ShotDock is one click or one shortcut, handles fixed elements deliberately, and can be paused or
> cancelled mid-capture. Same privacy story, though — DevTools is local too, and that's a fair point.

**"How do I know it isn't uploading anything?"**
> Three ways, in ascending order of proof. Chrome's install dialog shows no host permissions — it
> literally cannot read sites you haven't invoked it on. Open DevTools' Network tab during a capture
> and you'll see nothing leave. And the source is MIT — read the capture path yourself; the CSP is
> `script-src 'self'`, so there's no remote code either.

**"Firefox / Safari / Edge?"**
> Edge and other Chromium browsers with MV3 support should work today. Firefox and Safari would need
> real porting work — different extension APIs — so I'd rather not promise a date. If there's demand
> here I'll take it seriously.

**"Does it capture `<some hard page>`?"**
> Genuinely want to know — please try it and tell me. Known limits: `chrome://` pages and the Chrome
> Web Store are off limits to every extension, not just this one. Pages beyond the browser's canvas
> limit come back as numbered parts rather than one file. Past 400 scroll frames it stops and says
> so instead of capturing forever.

**"Can it annotate / blur / crop / export PDF / OCR?"**
> Not in 1.0. The order I'm planning: capture history first, then annotation with crop and blur, then
> PDF and collections. The capture engine is deliberately decoupled from the UI so none of that
> requires reworking it.

**"Is it really free? What's the catch?"**
> Free, MIT licensed, no account, no cap. There's no paid tier for what 1.0 does. It costs me nothing
> to run because there's no server — that's the whole point of the architecture.

**"Why does it need the `downloads` / `scripting` permission?"**
> `scripting` injects the measure-and-scroll script into the one tab you're capturing, on demand —
> that's what makes `activeTab` sufficient and host permissions unnecessary. `downloads` saves the
> finished image to a ShotDock folder. Every permission is justified line by line in the store
> listing; there are five and no host permissions.

**"Open source?"**
> Yes, MIT. [repo link]

**"The screenshot has a seam / a gap."**
> That's the bug I most want. Please tell me the URL, your OS, your zoom level and your display
> scaling — seams almost always trace back to fractional device-pixel ratios or a page that reflowed
> mid-capture, and both are reproducible once I know the numbers.

---

## 9. Launch-day timeline (Pacific Time)

| Time | Action |
| ---- | ------ |
| **12:01 AM** | Launch goes live. Post the maker's comment (§5) immediately. |
| 12:15 AM | Verify: store link works, all gallery images render, video plays, topics correct. |
| 6:00 AM | X thread (`social-share-copy.md` §3.1). Reply to every PH comment so far. |
| 8:00 AM | LinkedIn post (§2.1) + first comment with the links. |
| 10:00 AM | Facebook post (§1.1). Relevant subreddits and communities — read each one's self-promo rules first; r/chrome and r/webdev are unforgiving about launch spam. |
| Through the day | Reply to every comment within ~15 minutes. This matters more than any other launch-day activity. |
| 6:00 PM | Post a short update comment — something learned, a bug fixed, a question answered — to resurface the thread. |
| 11:00 PM | Thank-you comment. |
| Next day | Post the result, whatever it is. Log every bug reported into the tracker. |

**Do not** ask for upvotes anywhere, publicly or privately — PH detects and penalises vote
solicitation, and it can sink an otherwise good launch. Ask people to "take a look" or "leave
feedback"; that's both allowed and more effective.

---

## 10. Claims register

Every claim used in this launch, and where it is verified in the repo. If a reviewer, commenter or
journalist challenges one, this is the answer.

| Claim | Verified by |
| ----- | ----------- |
| Nothing is uploaded; no server | No network code in `src/`; CSP `script-src 'self'`; no host permissions in `public/manifest.json` |
| No host permissions | `public/manifest.json` — `activeTab`, `scripting`, `downloads`, `offscreen`, `storage`, and no `host_permissions` key |
| Sticky headers kept in the first frame only | `src/content/` fixed-element handling |
| Seam-free stitching, enforced by tests | `tests/` crop-calculator no-gap/no-overlap invariant at 1×, 2× and fractional scales |
| The page is always restored | Restore in a `finally` plus the content-script watchdog; asserted by the e2e smoke test |
| Pause, resume, cancel | Session state machine with a single `checkpoint()` suspension point |
| Long pages split into parts | Dimension/part-splitting logic, covered by the naming and dimensions tests |
| Free and open source, MIT | `LICENSE`, `package.json` |
| Chrome 116+ | `minimum_chrome_version` in `public/manifest.json` |

**Never claim:** "best" or "#1", "unlimited", any speed figure, any user or download count, "works on
every site", or any roadmap feature (annotation, crop, blur, PDF, collections, capture history, OCR
or AI).

---

## 11. Where each field comes from

So a future launch — or a re-launch of 2.0 — doesn't start from a blank form.

| PH field | Source in this repo |
| -------- | ------------------- |
| Name, tagline, description | This document §1–§3; positioning shared with `docs/store-listing.md` §1 and §3 |
| Website link | Live: https://chromewebstore.google.com/detail/shotdock-%E2%80%94-full-page-scre/jfjemodmlmbednhkbhedipnbgniffaaa |
| Topics, pricing, platform | §6 above |
| Maker's comment | §5 above |
| Gallery, thumbnail, video | §7 above — assets to be produced; the same set satisfies the Chrome Web Store's screenshot requirement |
| Privacy policy link | `docs/store-listing.md` §7, once hosted publicly |
| Social amplification | `docs/social-share-copy.md` |
