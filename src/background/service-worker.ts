import type { CaptureType } from '../shared/types';
import { createLogger } from '../utils/logger';
import { CaptureManager } from './capture-manager';
import { registerMessageRouter } from './message-router';

/**
 * MV3 entry point. Kept deliberately thin: listeners must be registered
 * synchronously at the top level, or Chrome won't deliver events to a worker it
 * has to wake up first.
 */

const log = createLogger('worker');
const manager = new CaptureManager();

registerMessageRouter(manager);

chrome.runtime.onInstalled.addListener((details) => {
  log.info('installed', details.reason);
});

// Keyboard shortcuts are a first-class entry point, not a popup convenience.
chrome.commands.onCommand.addListener((command) => {
  const type = COMMAND_TYPES[command];
  if (!type) return;
  void manager.start(type);
  // Best effort: shows live progress if the browser allows opening the popup.
  void chrome.action.openPopup?.().catch(() => undefined);
});

const COMMAND_TYPES: Record<string, CaptureType | undefined> = {
  'capture-full-page': 'full-page',
  'capture-visible': 'visible',
};

// A capture is tied to one tab; if it navigates or closes, stop rather than
// stitching frames from two different pages together.
chrome.tabs.onRemoved.addListener((tabId) => {
  manager.notifyTabChanged(tabId);
  manager.notifyTabRemoved(tabId);
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && changeInfo.url) manager.notifyTabChanged(tabId);
});

// A capture reads whatever tab is in front of the window, so bringing another one
// forward has to stop it rather than quietly photograph the wrong page.
chrome.tabs.onActivated.addListener((info) => {
  manager.notifyTabActivated(info.tabId, info.windowId);
});

// The worker is restarted for every event it has to handle, so this runs on each
// wake-up: it re-adopts a finished capture that outlived the previous worker.
void manager.hydrate();
