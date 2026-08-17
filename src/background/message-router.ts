import { isExpectedFailure, toErrorInfo } from '../shared/errors';
import { fail, ok, type Response, type UiMessage } from '../shared/messages';
import { createLogger } from '../utils/logger';
import type { CaptureManager } from './capture-manager';

const log = createLogger('router');

/**
 * Single entry point for everything the UI can ask of the background.
 *
 * Long-running intents (start-capture) are acknowledged immediately and report
 * through session state instead of the response — a capture outlives the popup
 * that started it.
 */
export function registerMessageRouter(manager: CaptureManager): void {
  chrome.runtime.onMessage.addListener((message: UiMessage, sender, sendResponse) => {
    // Everything here can start a capture or hand back screenshot bytes, so the
    // sender has to be ShotDock itself — a popup, the preview tab, or a content
    // script of ours — and never anything else that reaches this listener.
    if (sender.id !== chrome.runtime.id) return false;
    if (message?.target !== 'background') return false;

    handle(manager, message)
      .then((value) => sendResponse(ok(value)))
      .catch((error: unknown) => {
        if (isExpectedFailure(error)) log.warn(message.type, error);
        else log.error(message.type, error);
        const info = toErrorInfo(error);
        sendResponse(fail(info.message, info.code) satisfies Response<never>);
      });
    return true;
  });
}

async function handle(manager: CaptureManager, message: UiMessage): Promise<unknown> {
  switch (message.type) {
    case 'start-capture':
      // Intentionally not awaited: the capture runs on past this response.
      void manager.start(message.captureType);
      return manager.session.snapshot();

    case 'pause':
      manager.pause();
      return manager.session.snapshot();

    case 'resume':
      manager.resume();
      return manager.session.snapshot();

    case 'cancel':
      manager.cancel();
      return manager.session.snapshot();

    case 'reset':
      await manager.reset();
      return manager.session.snapshot();

    case 'get-state':
      return manager.session.snapshot();

    case 'set-format':
      await manager.setFormat(message.format, message.quality);
      return manager.session.snapshot();

    case 'download':
      await manager.download();
      return true;

    case 'get-image':
      return manager.getImage(message.part);

    case 'get-object-url':
      return manager.getObjectUrl(message.part);

    case 'open-preview':
      await manager.openPreviewTab();
      return true;

    default:
      return null;
  }
}
