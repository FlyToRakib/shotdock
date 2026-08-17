/**
 * Namespaced logging. Errors always surface; chatter is opt-in via
 * `localStorage.shotdockDebug = '1'` (extension pages) so shipped builds stay quiet.
 */

let verbose = false;
try {
  // Extension surfaces only. A content script shares the *page's* localStorage,
  // so reading the flag there would let any site switch ShotDock's logging on.
  if (globalThis.location?.protocol === 'chrome-extension:') {
    verbose = globalThis.localStorage?.getItem('shotdockDebug') === '1';
  }
} catch {
  verbose = false;
}

export function createLogger(scope: string) {
  const prefix = `[ShotDock:${scope}]`;
  return {
    debug: (...args: unknown[]) => {
      if (verbose) console.debug(prefix, ...args);
    },
    info: (...args: unknown[]) => {
      if (verbose) console.info(prefix, ...args);
    },
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
  };
}
