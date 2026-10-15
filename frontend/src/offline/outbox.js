import { useSyncExternalStore } from 'react';
import { readJson, removeKey, writeJson } from './storage';

// Entries saved on the phone while it couldn't reach the server, waiting to
// be sent (see sync.js). Each item is
//   { id, kind, projectId, key, payload, display, status, error, savedAt }
// where `payload` is exactly what the form would have posted, `key` is the
// entry's identity within its form (so saving the same gang again replaces
// the waiting copy instead of queueing two), and `display` is the entry as
// the form shows it until the server's own copy comes back. `status` is
// 'pending' (will be sent) or 'failed' (the server refused it; `error` says
// why, and it waits for the person to fix or discard it).
//
// The server stores entries by that same identity, so sending one twice —
// say the signal drops before the reply arrives — just saves it again.

const KEY = 'dpr:outbox';

let items = readJson(KEY, []);
// Shared state for the status bar: whether a send is in progress, and why
// the last one stopped early ('offline' or 'login'), if it did.
let syncState = { sending: false, problem: '' };
const listeners = new Set();

const notify = () => listeners.forEach((l) => l());

function save(next) {
  items = next;
  writeJson(KEY, items);
  notify();
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Another tab of the app changed the outbox.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    items = readJson(KEY, []);
    notify();
  });
}

export const getItems = () => items;
export const getSyncState = () => syncState;

export function setSyncState(patch) {
  syncState = { ...syncState, ...patch };
  notify();
}

export const useOutbox = () => useSyncExternalStore(subscribe, getItems);
export const useSyncState = () => useSyncExternalStore(subscribe, getSyncState);

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export function enqueue({ kind, projectId, key, payload, display }) {
  const item = {
    id: newId(),
    kind,
    projectId,
    key,
    payload,
    display,
    status: 'pending',
    error: '',
    savedAt: new Date().toISOString(),
  };
  save([...items.filter((i) => !(i.kind === kind && i.projectId === projectId && i.key === key)), item]);
  return item;
}

export function removeItem(id) {
  save(items.filter((i) => i.id !== id));
}

export function markFailed(id, error) {
  save(items.map((i) => (i.id === id ? { ...i, status: 'failed', error } : i)));
}

export function clearOutbox() {
  items = [];
  removeKey(KEY);
  notify();
}

// The waiting entries of one form, work order, date and shift.
export const itemsFor = (list, kind, projectId, workOrderId, date, shift) =>
  list.filter(
    (i) =>
      i.kind === kind &&
      i.projectId === projectId &&
      i.payload.workOrderId === workOrderId &&
      i.payload.date === date &&
      i.payload.shift === shift
  );
