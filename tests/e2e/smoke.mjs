/**
 * End-to-end smoke test: runs the built extension in a real Chrome.
 *
 *   npm run build && npm run test:e2e
 *
 * It serves a tall page with a sticky header, drives a full-page capture through
 * the same messages the popup sends, and checks the things unit tests cannot:
 * that the content script injects, the scroll loop runs, the offscreen renderer
 * stitches and encodes, the downloads API accepts the result — and that the page
 * is left exactly as it was found.
 *
 * Two concessions the harness has to make, neither of which touches shipped code:
 *  - Chrome 137+ ignores --load-extension, so the extension is installed over the
 *    CDP Extensions domain (hence --enable-unsafe-extension-debugging).
 *  - activeTab is only granted by a genuine toolbar click, which CDP cannot fake,
 *    so the harness runs against a copy of dist/ with host_permissions added. The
 *    shipped manifest still requests no host access.
 *
 * Pass --save-image <path> to write the stitched PNG out for inspection.
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = join(ROOT, 'dist');
const DEBUG_PORT = 9333;
const PAGE_PORT = 9444;
const SECTIONS = 12; // 400px each, plus a 56px header
const PAGE_HEIGHT = 56 + SECTIONS * 400;

const saveImageIndex = process.argv.indexOf('--save-image');
const saveImagePath = saveImageIndex > -1 ? process.argv[saveImageIndex + 1] : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error('Chrome not found — set CHROME_PATH');
  return found;
}

// --- the page under test ----------------------------------------------------

const sections = Array.from(
  { length: SECTIONS },
  (_, i) =>
    `<section style="height:400px;background:hsl(${i * 29} 70% ${i % 2 ? 88 : 76}%)">
       <h2 style="margin:0;padding:24px;font:600 28px system-ui">Section ${i + 1}</h2>
     </section>`,
).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><title>ShotDock test page</title>
<style>body{margin:0;font-family:system-ui}
header{position:fixed;top:0;left:0;right:0;height:56px;background:#111;color:#fff;
display:flex;align-items:center;padding:0 20px;z-index:10}</style></head>
<body><header>Sticky header that must not repeat</header>
<div style="height:56px"></div>${sections}</body></html>`;

// --- CDP plumbing -----------------------------------------------------------

const listTargets = () => fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`).then((r) => r.json());

async function attach(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    socket.onopen = res;
    socket.onerror = rej;
  });

  let nextId = 0;
  const pending = new Map();
  const exceptions = [];
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      exceptions.push(details.exception?.description ?? details.text);
    }
  };

  const command = (method, params = {}) =>
    new Promise((res) => {
      const id = ++nextId;
      pending.set(id, res);
      socket.send(JSON.stringify({ id, method, params }));
    });

  await command('Runtime.enable').catch(() => undefined);

  const evaluate = async (expression) => {
    const response = await command('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    const details = response.result?.exceptionDetails;
    if (details) throw new Error(details.exception?.description ?? details.text);
    return response.result.result.value;
  };

  return { command, evaluate, exceptions, close: () => socket.close() };
}

const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

// --- run --------------------------------------------------------------------

const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(html);
});
await new Promise((r) => server.listen(PAGE_PORT, '127.0.0.1', r));

const workDir = mkdtempSync(join(tmpdir(), 'shotdock-e2e-'));
const extensionDir = join(workDir, 'extension');
cpSync(DIST, extensionDir, { recursive: true });
const manifest = JSON.parse(readFileSync(join(extensionDir, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['<all_urls>'];
writeFileSync(join(extensionDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

const chrome = spawn(findChrome(), [
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${join(workDir, 'profile')}`,
  '--enable-unsafe-extension-debugging',
  '--headless=new',
  '--window-size=1280,800',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  `http://127.0.0.1:${PAGE_PORT}/`,
]);

let chromeStderr = '';
chrome.stderr.on('data', (chunk) => (chromeStderr += chunk.toString()));

let exitCode = 0;
try {
  let browserInfo = null;
  for (let i = 0; i < 40 && !browserInfo; i++) {
    await sleep(500);
    browserInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)
      .then((r) => r.json())
      .catch(() => null);
  }
  check(browserInfo, 'Chrome never exposed its debugging endpoint');

  const browser = await attach(browserInfo.webSocketDebuggerUrl);
  const installed = await browser.command('Extensions.loadUnpacked', { path: extensionDir });
  const extensionId = installed.result?.id;
  check(extensionId, `loadUnpacked failed: ${JSON.stringify(installed.error ?? installed.result)}`);
  console.log('✓ extension installed:', extensionId);

  let targets = [];
  let workerTarget = null;
  for (let i = 0; i < 40 && !workerTarget; i++) {
    await sleep(500);
    targets = await listTargets();
    workerTarget = targets.find((t) => t.type === 'service_worker' && t.url.includes(extensionId));
  }
  check(workerTarget, 'the ShotDock service worker never started');
  const worker = await attach(workerTarget.webSocketDebuggerUrl);
  console.log('✓ service worker booted');

  // The popup is opened as a tab so it can send the same messages the real popup
  // does. It must be opened by the extension itself.
  await worker.evaluate(`chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') })`);
  await sleep(1500);
  targets = await listTargets();
  const popupTarget = targets.find((t) => t.url.endsWith('/popup.html'));
  check(popupTarget, 'the popup page did not open');
  const popup = await attach(popupTarget.webSocketDebuggerUrl);

  // Hand focus back to the page under test — the popup tab took it.
  const activeTab = await popup.evaluate(`(async () => {
    const tabs = await chrome.tabs.query({});
    const page = tabs.find(t => t.url && t.url.startsWith('http://127.0.0.1:${PAGE_PORT}'));
    if (!page) return null;
    await chrome.tabs.update(page.id, { active: true });
    return page.url;
  })()`);
  check(activeTab, 'the test page tab was not found');
  await sleep(500);
  console.log('✓ capturing:', activeTab);

  const call = (message) =>
    popup.evaluate(`chrome.runtime.sendMessage(${JSON.stringify(message)})`);

  const initial = await call({ target: 'background', type: 'get-state' });
  check(initial?.ok && initial.value.status === 'idle', `bad initial state: ${JSON.stringify(initial)}`);

  // --- full page ------------------------------------------------------------
  await call({ target: 'background', type: 'start-capture', captureType: 'full-page' });

  let state = null;
  const statuses = new Set();
  for (let i = 0; i < 90; i++) {
    await sleep(400);
    state = (await call({ target: 'background', type: 'get-state' })).value;
    statuses.add(state.status);
    if (['ready', 'error', 'cancelled'].includes(state.status)) break;
  }
  check(
    state.status === 'ready',
    `capture ended as ${state?.status}: ${JSON.stringify(state?.error)}`,
  );

  const result = state.result;
  console.log(
    `✓ captured ${result.width}×${result.height} from ${state.progress.total} sections ` +
      `(${[...statuses].join(' → ')})`,
  );

  check(state.progress.total >= 4, 'expected several frames for a 4856px page');
  check(result.parts.length >= 1, 'no image parts produced');
  check(result.previewDataUrl.startsWith('data:image/'), 'no preview produced');

  const expectedHeight = PAGE_HEIGHT * result.scale;
  check(
    Math.abs(result.height - expectedHeight) <= 60 * result.scale,
    `output height ${result.height} does not match the page (${expectedHeight})`,
  );
  console.log('✓ output height matches the page');

  // --- the page must be untouched ------------------------------------------
  targets = await listTargets();
  const pageTarget = targets.find((t) => t.url.startsWith(`http://127.0.0.1:${PAGE_PORT}`));
  const page = await attach(pageTarget.webSocketDebuggerUrl);
  const after = JSON.parse(
    await page.evaluate(`JSON.stringify({
      scrollY: window.scrollY,
      headerVisibility: getComputedStyle(document.querySelector('header')).visibility,
      headerInlineStyle: document.querySelector('header').getAttribute('style'),
      captureStyles: document.getElementById('shotdock-capture-mode') ? 1 : 0,
    })`),
  );
  check(after.scrollY === 0, 'scroll position was not restored');
  check(after.headerVisibility === 'visible', 'the sticky header was left hidden');
  check(!after.headerInlineStyle, 'an inline style was left on the header');
  check(!after.captureStyles, 'the capture stylesheet was left in the page');
  console.log('✓ page fully restored (scroll, sticky header, injected styles)');

  // --- the preview tab ------------------------------------------------------
  // `openInNewTab` is on by default, so finishing a capture must have opened it.
  let previewTarget = null;
  for (let i = 0; i < 20 && !previewTarget; i++) {
    await sleep(300);
    targets = await listTargets();
    previewTarget = targets.find((t) => t.url.endsWith('/preview.html'));
  }
  check(previewTarget, 'the preview tab did not open after the capture');
  const preview = await attach(previewTarget.webSocketDebuggerUrl);

  let previewState = null;
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    previewState = JSON.parse(
      await preview.evaluate(`(() => {
        const image = document.querySelector('.sd-page__image');
        return JSON.stringify({
          host: document.querySelector('.sd-page__host')?.textContent ?? '',
          src: image?.currentSrc ?? '',
          decoded: image?.naturalWidth ?? 0,
          note: document.querySelector('.sd-page__note')?.textContent ?? '',
          canCopy: !document.querySelector('.sd-page__actions .sd-btn')?.disabled,
        });
      })()`),
    );
    if (previewState.decoded > 0) break;
  }
  check(
    previewState.decoded > 0,
    `the preview tab rendered no image (${JSON.stringify(previewState)})`,
  );
  check(previewState.src.startsWith('blob:'), 'the preview did not take its own copy of the bytes');
  check(previewState.host === '127.0.0.1', `preview names the wrong page: ${previewState.host}`);
  check(previewState.canCopy, 'the preview left its Copy and Download buttons disabled');
  console.log(`✓ preview tab shows ${previewState.decoded}px of ${previewState.host}, full size`);

  // --- output paths ---------------------------------------------------------
  const reencoded = await call({
    target: 'background',
    type: 'set-format',
    format: 'jpeg',
    quality: 70,
  });
  check(
    reencoded?.ok && reencoded.value.result.format === 'jpeg',
    `set-format failed: ${JSON.stringify(reencoded)}`,
  );
  console.log('✓ re-encoded to JPEG:', reencoded.value.result.parts[0].byteSize, 'bytes');

  const jpeg = await call({ target: 'background', type: 'get-image', part: 0 });
  check(jpeg?.ok && jpeg.value.startsWith('data:image/jpeg'), 'get-image returned no JPEG');

  await call({ target: 'background', type: 'set-format', format: 'png', quality: 100 });
  const png = await call({ target: 'background', type: 'get-image', part: 0 });
  check(png?.ok && png.value.startsWith('data:image/png'), 'get-image returned no PNG');
  console.log('✓ image bytes readable for clipboard and download');

  if (saveImagePath) {
    writeFileSync(saveImagePath, Buffer.from(png.value.split(',')[1], 'base64'));
    console.log('✓ wrote', saveImagePath);
  }

  const download = await call({ target: 'background', type: 'download' });
  check(download?.ok, `download failed: ${JSON.stringify(download)}`);
  console.log('✓ download accepted by the downloads API');

  // --- visible area ---------------------------------------------------------
  await call({ target: 'background', type: 'reset' });
  await call({ target: 'background', type: 'start-capture', captureType: 'visible' });
  let visible = null;
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    visible = (await call({ target: 'background', type: 'get-state' })).value;
    if (['ready', 'error'].includes(visible.status)) break;
  }
  check(
    visible.status === 'ready',
    `visible capture ended as ${visible?.status}: ${JSON.stringify(visible?.error)}`,
  );
  // The preview tab was in front when this capture started. It must have gone
  // back to the page the preview came from rather than capturing itself.
  check(
    visible.result.hostname === '127.0.0.1',
    `capturing from the preview tab captured ${visible.result.hostname} instead of the page`,
  );
  console.log(`✓ visible capture ${visible.result.width}×${visible.result.height} of the source page`);

  // "Receiving end does not exist" is the normal state broadcast with no popup open.
  const thrown = worker.exceptions.filter((e) => !String(e).includes('Receiving end'));
  check(thrown.length === 0, `service worker threw: ${thrown.join('; ')}`);

  console.log('\nSMOKE TEST PASSED');
} catch (error) {
  exitCode = 1;
  console.error('\nSMOKE TEST FAILED:', error.message);
  if (chromeStderr.trim()) {
    console.error('chrome stderr tail:\n' + chromeStderr.split('\n').slice(-20).join('\n'));
  }
} finally {
  chrome.kill();
  server.close();
  await sleep(400);
  try {
    rmSync(workDir, { recursive: true, force: true });
  } catch {
    /* Windows sometimes holds the profile briefly */
  }
  process.exit(exitCode);
}
