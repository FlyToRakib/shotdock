import { fail, ok, type OffscreenMessage, type RenderedOutput, type Response } from '../shared/messages';
import { ShotDockError, toErrorInfo } from '../shared/errors';
import { blobToDataUrl } from '../stitching/canvas-renderer';
import { Stitcher, type RenderedPart } from '../stitching/stitcher';
import type { ImageFormat } from '../shared/types';
import { createLogger } from '../utils/logger';

/**
 * The offscreen document exists purely because MV3 service workers have no DOM
 * and therefore no canvas. It owns the image pipeline: frames stream in, a
 * stitched surface builds up, and encoded images are held here until the user
 * copies, downloads, or starts another capture.
 */

const log = createLogger('offscreen');

let stitcher: Stitcher | null = null;
let rendered: RenderedPart[] = [];
let preview = '';
const objectUrls = new Map<number, string>();

chrome.runtime.onMessage.addListener((message: OffscreenMessage, sender, sendResponse) => {
  // This document holds the decoded screenshot. Nothing outside ShotDock's own
  // contexts has any business asking it for the bytes.
  if (sender.id !== chrome.runtime.id) return false;
  if (message?.target !== 'offscreen') return false;
  handle(message)
    .then((value) => sendResponse(ok(value)))
    .catch((error: unknown) => {
      log.error(message.type, error);
      const info = toErrorInfo(error);
      sendResponse(fail(info.message, info.code) satisfies Response<never>);
    });
  return true;
});

async function handle(message: OffscreenMessage): Promise<unknown> {
  switch (message.type) {
    case 'begin': {
      releaseAll();
      stitcher = new Stitcher({
        pageWidth: message.pageWidth,
        pageHeight: message.pageHeight,
        viewportWidth: message.viewportWidth,
        viewportHeight: message.viewportHeight,
        seamDetection: message.seamDetection,
      });
      return null;
    }

    case 'add-frame': {
      if (!stitcher) throw new ShotDockError('RENDER_FAILED');
      await stitcher.addFrame(message.frame);
      return null;
    }

    case 'finish': {
      if (!stitcher) throw new ShotDockError('RENDER_FAILED');
      return renderCurrent(message.format, message.quality);
    }

    case 'reencode': {
      if (!stitcher) throw new ShotDockError('RENDER_FAILED');
      return renderCurrent(message.format, message.quality);
    }

    case 'get-image': {
      const part = rendered[message.part];
      if (!part) throw new ShotDockError('RENDER_FAILED');
      return blobToDataUrl(part.blob);
    }

    case 'get-object-url': {
      const part = rendered[message.part];
      if (!part) throw new ShotDockError('RENDER_FAILED');
      // Object URLs stay valid while this document lives, which is exactly as
      // long as the result does — and they hand the downloads API a reference
      // instead of a multi-megabyte string.
      const existing = objectUrls.get(part.index);
      if (existing) return existing;
      const url = URL.createObjectURL(part.blob);
      objectUrls.set(part.index, url);
      return url;
    }

    case 'release': {
      releaseAll();
      return null;
    }

    default:
      throw new ShotDockError('UNKNOWN');
  }
}

async function renderCurrent(format: ImageFormat, quality: number): Promise<RenderedOutput> {
  if (!stitcher) throw new ShotDockError('RENDER_FAILED');
  const result = await stitcher.render(format, quality);
  revokeObjectUrls(); // the previous encoding's URLs point at stale blobs
  rendered = result.parts;
  preview = result.previewDataUrl;

  return {
    parts: result.parts.map((part) => ({
      index: part.index,
      width: part.width,
      height: part.height,
      byteSize: part.blob.size,
    })),
    width: result.width,
    height: result.height,
    scale: result.scale,
    previewDataUrl: preview,
  };
}

function releaseAll(): void {
  stitcher?.release();
  stitcher = null;
  rendered = [];
  preview = '';
  revokeObjectUrls();
}

function revokeObjectUrls(): void {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
}
