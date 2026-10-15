import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getItems } from './outbox';
import { prefetchForOffline, syncNow } from './sync';

const PREFETCH_EVERY_MS = 10 * 60 * 1000;
const RETRY_EVERY_MS = 30 * 1000;

// Renders nothing. While someone is logged in it sends waiting entries
// whenever there's a chance the signal is back (app opened, phone back
// online, every half minute while any are waiting), and refreshes the
// phone's copy of the form lists now and then.
export default function OfflineSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return undefined;
    let lastPrefetch = 0;

    const run = () => {
      syncNow();
      if (navigator.onLine && Date.now() - lastPrefetch > PREFETCH_EVERY_MS) {
        lastPrefetch = Date.now();
        prefetchForOffline(user).catch(() => {
          lastPrefetch = 0;
        });
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && run();
    const timer = setInterval(() => {
      if (getItems().some((i) => i.status === 'pending')) syncNow();
    }, RETRY_EVERY_MS);

    run();
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user]);

  return null;
}
