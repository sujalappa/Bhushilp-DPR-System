import * as undergroundApi from '../api/underground';
import * as mastersApi from '../api/masters';
import * as projectsApi from '../api/projects';
import { getItems, markFailed, removeItem, setSyncState } from './outbox';

const SENDERS = {
  'ug-production': undergroundApi.upsertProduction,
  'ug-development': undergroundApi.upsertDevelopment,
};

const syncedListeners = new Set();

// Called with each item once the server has saved it, so an open form can
// swap its waiting copy for the server's.
export function onSynced(listener) {
  syncedListeners.add(listener);
  return () => syncedListeners.delete(listener);
}

let running = null;

// Sends the waiting entries, oldest first. Stops at the first sign the
// server can't be reached or the session has ended (everything after it
// would fail the same way); an entry the server refuses for its content is
// marked failed and the rest carry on.
export function syncNow() {
  if (running) return running;
  running = (async () => {
    const pending = getItems().filter((i) => i.status === 'pending');
    if (pending.length === 0) {
      setSyncState({ problem: '' });
      return;
    }
    setSyncState({ sending: true });
    let problem = '';
    for (const item of pending) {
      try {
        await SENDERS[item.kind](item.projectId, item.payload);
        removeItem(item.id);
        syncedListeners.forEach((l) => l(item));
      } catch (err) {
        if (err.offline) {
          problem = 'offline';
          break;
        }
        // The server is up but struggling (e.g. waking up); try again later.
        if (err.status >= 500) {
          problem = 'server';
          break;
        }
        if (err.status === 401) {
          problem = 'login';
          break;
        }
        markFailed(item.id, err.message);
      }
    }
    setSyncState({ sending: false, problem });
  })().finally(() => {
    running = null;
  });
  return running;
}

// Loads the lists the underground forms need into the phone's copy (see
// offline/cache.js) while there's signal, so a form can still be filled in
// later without it — even one the person hasn't opened today. Same calls,
// same parameters as the forms make.
export async function prefetchForOffline(user) {
  const projects = await projectsApi.listProjects();
  const underground = projects.filter(
    (p) =>
      p.type === 'underground' &&
      (user.isSuperAdmin ||
        user.assignments.some((a) => a.projectId === p._id && a.forms.some((f) => f.startsWith('ug-'))))
  );
  await Promise.all(
    underground.map((p) =>
      Promise.all([
        undergroundApi.listWorkOrders(p._id),
        undergroundApi.listWorkOrders(p._id, { active: true }),
        mastersApi.listLevels(p._id, { active: true }),
        mastersApi.listSupervisors(p._id, { active: true }),
        mastersApi.listWorkers(p._id, { active: true }),
        mastersApi.listHeadings(p._id, { active: true }),
      ])
    )
  );
}
