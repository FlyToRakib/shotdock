import { useEffect, useState } from 'react';
import type { BroadcastMessage } from '../shared/messages';
import type { SessionState } from '../shared/types';
import { api } from '../ui/api';

const EMPTY: SessionState = {
  status: 'idle',
  type: null,
  progress: { completed: 0, total: 0, detail: '' },
  result: null,
  error: null,
};

/**
 * Mirrors background session state. Pulls once on open (a capture may already be
 * running from a keyboard shortcut) and then follows broadcasts, so closing and
 * reopening the popup mid-capture picks up exactly where things are.
 */
export function useSession(): { state: SessionState; loaded: boolean } {
  const [state, setState] = useState<SessionState>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api
      .getState()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    const listener = (message: BroadcastMessage) => {
      if (message?.target === 'ui' && message.type === 'state') setState(message.state);
    };
    chrome.runtime.onMessage.addListener(listener);

    return () => {
      cancelled = true;
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  return { state, loaded };
}
