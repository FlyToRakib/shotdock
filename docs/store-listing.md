# ShotDock — Chrome Web Store Listing & SEO Metadata

Prepared for Chrome Web Store submission. All content below reflects ShotDock 1.0.0 as built:
Manifest V3, five permissions, no host permissions, and no network requests to any server.

- **Developer:** Degird
- **Contact email:** hello@degird.com
- **Extension version:** 1.0.0
- **Minimum Chrome version:** 116
- **Category:** Art & Design — Google's category guidance names "capturing screenshots" under Art &
  Design explicitly. **Tools** is defined as "utilities not fitting other categories", so it is the
  wrong pick here precisely because a named category does fit.
- **Language:** English
- **Last updated:** 17 August 2026

---

## 1. Name

**ShotDock — Full Page Screenshot**

Store name, 31 characters (limit 75). The product name leads; the descriptive suffix carries the
search terms people actually type without turning the title into a keyword list.

**Manifest `name`:** `ShotDock — Full Page Screenshot`

The Chrome Web Store has no separate listing-title field: the title on the store page is taken from
the manifest `name`, so the full string lives there. The plain brand name is carried by
`short_name` below, which is what Chrome shows in the toolbar and the extensions manager.

---

## 2. Short Name

**ShotDock**

8 characters. Suitable for the manifest `short_name` field (recommended 12 characters or fewer),
and used as the toolbar tooltip name, the downloads folder name, and the launcher label. The brand
name is already short enough that abbreviating it further would only weaken recognition.

---

## 3. Short Description

**Manifest `short_description` / Store summary:**

> Capture full page screenshots that stay on your device. Fast, complete images — no account, no
> upload, no watermark.

116 characters (limit 132).

---

## 4. Store Listing Description

**ShotDock takes a screenshot of the whole page — and never sends it anywhere.**

Open ShotDock, choose **Full Page** or **Visible Area**, and get one clean, complete image in
seconds. The capture, the stitching and the encoding all happen inside your browser. There is no
screenshot server, no upload step and no account to create, so a screenshot of an internal
dashboard or a private document stays exactly where you took it.

**What it does**

- **Full page capture.** ShotDock scrolls the page for you and joins every section into a single
  image, including the parts far below the fold.
- **Visible area capture.** One click for just what is on screen right now.
- **Sticky headers handled properly.** Fixed headers, floating nav bars and cookie banners are kept
  in the first section, where they belong, and hidden afterwards — so they do not march down the
  finished image the way they do in a naive full-page screenshot.
- **Seam-free stitching.** Sections overlap on purpose, and the stitcher aligns on where the page
  actually landed rather than where it was asked to go. Pages that shift mid-capture, lazy-loading
  content, high-DPI displays and page zoom all come out aligned.
- **PNG or JPG.** PNG for lossless text and UI, JPG with an adjustable quality setting when file
  size matters more. Switch format after the capture without taking it again.
- **Copy, download or open full size.** Copy straight to the clipboard, save to a tidy `ShotDock`
  folder in your downloads, or open the result in its own tab to zoom and inspect it.
- **Keyboard shortcuts.** `Alt+Shift+S` for a full page, `Alt+Shift+V` for the visible area, both
  rebindable on Chrome's shortcuts page.
- **Progress you can control.** Long pages show live progress and can be paused, resumed or
  cancelled mid-capture. The page is always restored to how you found it, scroll position included.
- **Very long pages are handled, not refused.** Output beyond the browser's canvas limit is split
  into numbered parts instead of failing.

**Who it is for**

Designers and developers archiving a layout or filing a visual bug. QA engineers attaching evidence
to a ticket. Writers and researchers keeping an article as it appeared. Support teams documenting a
reproduction. Anyone who has to record a long page, a dashboard or a receipt and would rather not
route it through someone else's server.

**Why it is built this way**

ShotDock requests no host permissions at all. Instead of standing access to every site you visit,
it asks for access to a single tab at the moment you capture it, and that access lapses when you
navigate away. Screenshots are processed in a hidden document inside the extension and released as
soon as they are rendered. The result is a screenshot tool with nothing to trust it with.

Free, open source under the MIT licence, and built by Degird.

---

## 5. Single-Purpose Description

> ShotDock has a single purpose: capturing screenshots of the web page in the user's active tab and
> giving the user the resulting image.
>
> When the user clicks the ShotDock toolbar icon or presses its keyboard shortcut, the extension
> captures either the full page or the visible area of that tab. For a full-page capture it injects
> a script into the tab to measure the page, scroll through it and manage fixed elements, then
> restores the page to its original state. The sections are stitched and encoded into one image
> inside the extension, and the user can copy it, download it, or open it full size in a tab.
>
> Every feature serves that one function: the popup starts and controls a capture, the preview tab
> displays the finished image, and the options page stores capture preferences such as format and
> quality. ShotDock does not modify, monitor or interact with web pages outside of an active
> capture.

901 characters (limit 1000).

---

## 6. Permission Justification

ShotDock declares five permissions and **no host permissions**. Each is required for the capture
flow described above.

### `activeTab`

Required to read the contents of the page the user wants to capture. ShotDock deliberately uses
`activeTab` instead of broad host permissions such as `<all_urls>`: access is granted only for the
tab the user invokes ShotDock on, only at the moment they click the toolbar icon or press the
capture shortcut, and it lapses when that tab navigates away. ShotDock cannot read any page the
user has not explicitly asked it to capture.

### `scripting`

Required to inject ShotDock's capture script into the tab being captured at the moment of capture.
That script measures the page dimensions, scrolls through the page, temporarily hides fixed and
sticky elements so they do not repeat in every section, reports the position the page actually
settled at, and then restores the page to its original state. The script is injected on demand via
`chrome.scripting.executeScript` rather than declared as a content script, so it never runs on
pages the user is not capturing.

### `downloads`

Required to save the finished screenshot to the user's computer. ShotDock writes the rendered image
to a `ShotDock` folder in the browser's download location when the user clicks Download or has
enabled automatic download. It is used only to save images the user has just captured, and for no
other file.

### `offscreen`

Required because Manifest V3 service workers have no DOM and therefore no canvas, while stitching
and encoding a screenshot need one. ShotDock creates a hidden offscreen document to join the
captured sections into a single image and encode it as PNG or JPG, and closes it when the work is
finished. The offscreen document is local to the extension and performs no network activity.

### `storage`

Required for two things. First, the user's preferences — image format, JPEG quality, capture delay,
sticky-element handling, seam detection, scroll restoration, and what happens after a capture — are
saved in `chrome.storage.sync` so they persist and follow the user's browser profile. Second, the
state of an in-progress or just-finished capture is held in `chrome.storage.session`, which is
in-memory only, so that a capture survives the browser suspending the extension's service worker
mid-run and the popup can still show the last result.

---

## 7. Privacy Policy

**ShotDock Privacy Policy**
Effective date: 17 August 2026 · Applies to: ShotDock Chrome Extension, version 1.0.0

### Summary

ShotDock captures, stitches and encodes screenshots entirely inside your browser. It sends no data
to Degird or to any other server, has no accounts, and includes no analytics, tracking or
advertising. This policy explains precisely what the extension accesses, what it stores, and where
that data goes.

### Who we are

ShotDock is developed by Degird. For any privacy question about this extension, contact
**hello@degird.com**.

### What the extension accesses

**Web page content of the tab you capture.** To produce a screenshot, ShotDock reads the visual
contents and layout measurements (page dimensions, scroll position, and the positions of fixed or
sticky elements) of the page in the active tab. This access is granted by Chrome's `activeTab`
permission at the moment you click the ShotDock icon or press a ShotDock keyboard shortcut, and it
applies only to that tab. ShotDock requests no host permissions, so it has no standing access to
any website and cannot read pages you have not asked it to capture.

**Page title and hostname.** The title and hostname of the captured page are read so the result can
be labelled in the extension's interface and used to build the screenshot's filename, for example
`example.com-full-page-2026-08-17.png`.

### What the extension stores, and where

**Your settings — stored in your browser profile.** Your preferences (image format, JPEG quality,
capture delay, sticky-element handling, seam detection, scroll restoration, and post-capture
behaviour) are saved using `chrome.storage.sync`. If you are signed in to Chrome with sync enabled,
Chrome replicates these settings across your own signed-in browsers through your Google account.
This is handled by Chrome, not by Degird, and the data consists only of the preference values
listed above — never screenshots or page content. If sync is unavailable, the settings are stored
locally instead.

**The current capture — held in memory.** While a capture is running and after it completes, the
image and a small downscaled preview of it, along with the captured page's title and hostname, are
held in the extension's memory and in `chrome.storage.session`. Session storage exists only for the
lifetime of the browser session: it is not written to disk, not synced, and is cleared when you
close the browser. Each new capture replaces the previous one.

**Screenshots you choose to save.** When you download a screenshot it is written by Chrome's own
downloads system to a `ShotDock` folder in your download location. From that point the file is
yours and is governed by your own device, not by ShotDock. When you copy a screenshot, the image is
placed on your system clipboard at your request.

### What the extension does not do

- It does not transmit screenshots, page content, URLs, titles or settings to Degird or to any
  third party.
- It contains no analytics, telemetry, crash reporting, advertising or tracking of any kind.
- It has no user accounts and asks for no personal information — no name, email address, or
  payment details.
- It does not sell, rent or trade user data, does not transfer user data to third parties, and does
  not use user data for advertising, credit assessment or lending purposes.
- It does not use or transfer user data for any purpose unrelated to its single purpose of
  capturing screenshots.

### Network activity and third-party services

ShotDock makes no requests to any external server as part of its operation. It uses no third-party
APIs, SDKs, analytics services, image-hosting services or content delivery networks, and there is
no ShotDock backend for it to talk to.

The extension's interface contains ordinary links — for example to degird.com for support and
product information, and to the Chrome Web Store. These open only when you click them, and visiting
those pages is a normal web visit governed by the privacy policy of the site you land on, not by
this policy.

### Data retention

Settings persist until you change them, reset them from the options page, or uninstall the
extension. The current capture is discarded when it is replaced by a new capture, when you reset
the session, or when the browser session ends. Uninstalling ShotDock removes its stored settings
and all extension data from the browser. Files you downloaded and images you copied to the
clipboard remain on your device and are unaffected by uninstalling.

### Children's privacy

ShotDock collects no personal information from anyone, including children.

### Your controls

Because no data leaves your device, there is nothing for Degird to disclose, export or delete on
your behalf. You remain in full control: capture access is granted per tab and only when you invoke
the extension; settings can be reset from the options page at any time; the current capture is
cleared by resetting the session or closing your browser; and uninstalling removes the extension's
data from your browser.

### Changes to this policy

If this policy changes, the updated version will be published with a new effective date before or
alongside the release it describes. Material changes affecting how data is handled will be
described in the extension's Chrome Web Store listing.

### Contact

Questions about this policy or about ShotDock's data handling: **hello@degird.com** (Degird).

---

## 8. SEO Notes

**Primary search terms this listing targets naturally:** full page screenshot, screenshot extension,
capture full page, scrolling screenshot, webpage screenshot, private screenshot tool.

**Where they appear:** the store name carries the strongest term once; the short description leads
with the primary phrase; the description's opening line and feature headings use the terms in
ordinary sentences. Nothing is repeated for the sake of density, and no term appears in a way that
would read as unnatural to a reviewer or a user.

**Differentiators the copy leans on**, all verifiable in the extension itself: local-only
processing, no host permissions, sticky-element handling, seam-aware stitching, pause/resume, and
graceful handling of pages beyond canvas limits. These are what distinguish ShotDock from the
large number of similar screenshot extensions, and they are more persuasive than keyword volume.

**Claims deliberately avoided:** "best", "#1", "unlimited", any speed figure, any user count, and
any claim of features on the roadmap (annotation, OCR, PDF export, capture history) that 1.0.0 does
not ship.
