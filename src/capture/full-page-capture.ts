import type { CaptureSession } from '../background/capture-session';
import type { RenderedOutput } from '../shared/messages';
import type { CapturePlan, Settings } from '../shared/types';
import { createLogger } from '../utils/logger';
import { planCapture } from './capture-planner';
import type { RateLimiter } from './capture-timing';
import type { FrameManager } from './frame-manager';
import type { PageBridge } from './page-bridge';
import { captureVisibleTab } from './visible-capture';

const log = createLogger('full-page');

export interface CaptureContext {
  windowId: number;
  bridge: PageBridge;
  frames: FrameManager;
  session: CaptureSession;
  settings: Settings;
  limiter: RateLimiter;
}

export interface FullPageCaptureOutcome {
  output: RenderedOutput;
  plan: CapturePlan;
}

/**
 * Smart Full Page: measure → plan → prepare → (scroll, settle, capture)× → restore
 * → stitch. The page is restored in a `finally`, so a cancel, a timeout or an
 * outright crash still leaves the site exactly as the user left it.
 */
export async function runFullPageCapture(ctx: CaptureContext): Promise<FullPageCaptureOutcome> {
  const { bridge, frames, session, settings, limiter } = ctx;

  session.setStatus('analyzing', 'Analyzing page…');
  await bridge.connect();
  const analysis = await bridge.analyze();
  const plan = planCapture(analysis.metrics);
  log.debug('plan', {
    frames: plan.positions.length,
    rows: plan.rows,
    columns: plan.columns,
    truncated: plan.truncated,
  });

  session.setTotal(plan.positions.length);
  session.setStatus('preparing', 'Preparing page…');
  await bridge.prepare();

  await frames.begin({
    pageWidth: plan.captureWidth,
    pageHeight: plan.captureHeight,
    viewportWidth: plan.viewportWidth,
    viewportHeight: plan.viewportHeight,
    seamDetection: settings.seamDetection,
  });

  try {
    session.setStatus('capturing');
    for (const position of plan.positions) {
      await session.checkpoint();

      // captureVisibleTab is capped at two calls a second, and scrolling the page
      // costs nothing against that quota. Claiming the next slot before the scroll
      // round trip lets the two waits run together, so a page that settles quickly
      // pays the pacing interval once rather than the pacing interval plus itself.
      const slot = limiter.acquire();

      // Sticky headers stay for the very first frame — that is where they
      // genuinely live — and are hidden from then on so they don't repeat.
      const hideFixedElements = settings.handleFixedElements && position.index > 0;
      const landed = await bridge.scrollTo({
        x: position.x,
        y: position.y,
        hideFixedElements,
        delay: settings.captureDelay,
      });

      await session.checkpoint();
      const dataUrl = await captureVisibleTab(ctx.windowId, limiter, slot);

      await frames.addFrame({
        index: position.index,
        row: position.row,
        col: position.col,
        x: landed.x,
        y: landed.y,
        dataUrl,
      });
      session.frameCompleted();
    }
  } finally {
    await bridge.restore(settings.restoreScrollPosition);
  }

  session.setStatus('stitching', 'Rendering final image…');
  const output = await frames.finish(settings.format, settings.jpegQuality);
  return { output, plan };
}
