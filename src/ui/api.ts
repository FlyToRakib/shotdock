import { sendToBackground } from '../shared/messages';
import type { CaptureType, ImageFormat, SessionState } from '../shared/types';

/** Typed wrapper over the background message router, with errors unwrapped. */

async function call<T>(message: Parameters<typeof sendToBackground>[0]): Promise<T> {
  const response = await sendToBackground<T>(message);
  if (!response?.ok) throw new Error(response?.error ?? 'ShotDock is not responding');
  return response.value;
}

export const api = {
  getState: () => call<SessionState>({ target: 'background', type: 'get-state' }),
  startCapture: (captureType: CaptureType) =>
    call<SessionState>({ target: 'background', type: 'start-capture', captureType }),
  pause: () => call<SessionState>({ target: 'background', type: 'pause' }),
  resume: () => call<SessionState>({ target: 'background', type: 'resume' }),
  cancel: () => call<SessionState>({ target: 'background', type: 'cancel' }),
  reset: () => call<SessionState>({ target: 'background', type: 'reset' }),
  setFormat: (format: ImageFormat, quality: number) =>
    call<SessionState>({ target: 'background', type: 'set-format', format, quality }),
  download: () => call<boolean>({ target: 'background', type: 'download' }),
  getImage: (part: number) => call<string>({ target: 'background', type: 'get-image', part }),
  getObjectUrl: (part: number) =>
    call<string>({ target: 'background', type: 'get-object-url', part }),
  openPreview: () => call<boolean>({ target: 'background', type: 'open-preview' }),
};
