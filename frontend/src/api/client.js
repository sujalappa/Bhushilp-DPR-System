import axios from 'axios';
import { cacheKey, isCacheable, readCached, removeCached, writeCached } from '../offline/cache';

// withCredentials so the httpOnly session cookie is sent/received —
// the backend never uses a bearer token, only the cookie.
const client = axios.create({
  // Unset in production: the app calls its own /api, which vercel.json
  // forwards to the backend, so the login cookie stays on one domain.
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  // Underground the signal can be too weak to ever finish a request; give
  // up and treat it as offline rather than spin forever.
  timeout: 20000,
});

// Thrown when the server can't be reached at all. `offline` lets callers
// keep an entry on the phone instead of showing an error.
export function offlineError() {
  const error = new Error("You're offline. This needs an internet connection.");
  error.offline = true;
  return error;
}

const keyOf = (config) => cacheKey(config.url, config.params);

client.interceptors.response.use(
  (res) => {
    if (res.config.method === 'get' && isCacheable(res.config.url)) writeCached(keyOf(res.config), res.data);
    return res;
  },
  (err) => {
    if (axios.isCancel(err)) return Promise.reject(err);
    const config = err.config || {};

    // No answer from the server: no signal, or too weak to finish in time.
    // A read the phone has seen before is answered from what it kept, and
    // failing that from the caller's `offlineFallback`, if it gave one.
    if (!err.response) {
      if (config.method === 'get') {
        const cached = isCacheable(config.url) ? readCached(keyOf(config)) : undefined;
        if (cached !== undefined) return { data: cached, status: 200, headers: {}, config, offline: true };
        if (config.offlineFallback !== undefined) {
          return { data: { success: true, data: config.offlineFallback }, status: 200, headers: {}, config, offline: true };
        }
      }
      return Promise.reject(offlineError());
    }

    // A logged-out session mustn't be brought back from the phone's copy.
    if (err.response.status === 401 && config.url === '/auth/me') removeCached('/auth/me');

    // Every backend error response is { success: false, message }. Unwrap it
    // so callers can just do `catch (err) { setError(err.message) }`.
    const error = new Error(err.response.data?.message || 'Something went wrong. Please try again.');
    error.status = err.response.status;
    return Promise.reject(error);
  }
);

export default client;
