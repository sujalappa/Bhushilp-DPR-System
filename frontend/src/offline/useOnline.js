import { useSyncExternalStore } from 'react';

const subscribe = (listener) => {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
};

// Whether the phone thinks it has a connection. "Online" can still mean a
// signal too weak to reach the server — requests that fail that way are
// handled as offline where they happen (see api/client.js).
export default function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine);
}
