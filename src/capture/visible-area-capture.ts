import type { RenderedOutput } from '../shared/messages';
import type { CaptureContext } from './full-page-capture';
import { captureVisibleTab } from './visible-capture';

/**
 * Visible Area: one frame, no scrolling, nothing hidden — exactly what the user
 * is looking at, sticky headers included.
 *
 * It still runs through the renderer so format, quality, preview, clipboard and
 * download all follow the same path as a full-page capture.
 */
export async function runVisibleCapture(ctx: CaptureContext): Promise<RenderedOutput> {
  const { bridge, frames, session, settings, limiter } = ctx;

  session.setStatus('analyzing', 'Reading viewport…');
  await bridge.connect();
  const analysis = await bridge.analyze();
  const { viewportWidth, viewportHeight } = analysis.metrics;

  session.setTotal(1);
  session.setStatus('capturing');
  await session.checkpoint();
  const dataUrl = await captureVisibleTab(ctx.windowId, limiter);

  // The viewport *is* the page here, so the frame sits at the output origin.
  await frames.begin({
    pageWidth: viewportWidth,
    pageHeight: viewportHeight,
    viewportWidth,
    viewportHeight,
    seamDetection: false,
  });
  await frames.addFrame({ index: 0, row: 0, col: 0, x: 0, y: 0, dataUrl });
  session.frameCompleted();

  session.setStatus('stitching', 'Rendering image…');
  return frames.finish(settings.format, settings.jpegQuality);
}
