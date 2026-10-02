import { useEffect, useRef, useSyncExternalStore } from 'react';
import { S } from './store.js';

/* Re-render whenever the store commits. Components read fresh values from S during render. */
export function useStore() {
  useSyncExternalStore(S.on, () => S.version);
  return S;
}

/* Run a callback for specific store events (e.g. 'cart', 'wishlist') while mounted */
export function useStoreEvent(events, fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => S.on(evt => { if (events.includes(evt)) ref.current(evt); }), [events.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
}
