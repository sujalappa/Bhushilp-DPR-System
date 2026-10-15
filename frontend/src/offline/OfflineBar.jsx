import { useState } from 'react';
import { Link } from 'react-router-dom';
import { removeItem, useOutbox, useSyncState } from './outbox';
import { syncNow } from './sync';
import useOnline from './useOnline';
import { shiftLabel } from '../utils/shift';

const FORM_LABELS = { 'ug-production': 'Level Production', 'ug-development': 'Development' };

const plural = (n) => `${n} ${n === 1 ? 'entry' : 'entries'}`;

// The strip under the header that says whether the phone is offline and
// what's still waiting to reach the server, with a list to open or discard
// each waiting entry. Hidden when online with nothing waiting.
export default function OfflineBar() {
  const online = useOnline();
  const items = useOutbox();
  const { sending, problem } = useSyncState();
  const [open, setOpen] = useState(false);

  const pending = items.filter((i) => i.status === 'pending').length;
  const failed = items.filter((i) => i.status === 'failed').length;
  if (online && items.length === 0) return null;

  let message;
  if (!online) {
    message = items.length
      ? `Offline · ${plural(items.length)} saved on this phone, waiting to send`
      : "Offline · entries you save will stay on this phone until there's signal";
  } else if (sending) {
    message = `Sending ${plural(pending)}…`;
  } else if (pending > 0) {
    message = `${plural(pending)} waiting to send`;
    if (problem === 'login') message += ' · log in again to send them';
    else if (problem === 'server') message += " · the server isn't answering, will retry";
    else if (problem === 'offline') message += " · signal too weak, will retry";
  }
  const failedMessage = failed > 0 ? `${plural(failed)} not accepted by the server · open to fix` : '';
  const tone = failed > 0 ? 'bg-red-50 text-red-800' : online ? 'bg-brand-50 text-brand-900' : 'bg-accent-100 text-accent-700';

  return (
    <div className={`border-b border-slate-200 px-4 py-2 text-sm ${tone}`} role="status">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          {message && <div className="font-medium">{message}</div>}
          {failedMessage && <div className="font-medium">{failedMessage}</div>}
        </div>
        <div className="flex shrink-0 gap-3">
          {online && pending > 0 && !sending && (
            <button type="button" className="font-medium underline" onClick={() => syncNow()}>
              Send now
            </button>
          )}
          {items.length > 0 && (
            <button type="button" className="font-medium underline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? 'Hide' : 'Show'}
            </button>
          )}
        </div>
      </div>

      {open && items.length > 0 && (
        <ul className="mx-auto mt-2 max-w-2xl space-y-2">
          {items.map((item) => {
            const { workOrderId, date, shift } = item.payload;
            return (
              <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 text-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{item.display.title}</div>
                    <div className="text-slate-500">
                      {FORM_LABELS[item.kind]} · {date} · {shiftLabel(shift)}
                    </div>
                    <div className={item.status === 'failed' ? 'text-red-700' : 'text-slate-500'}>
                      {item.status === 'failed' ? `Not accepted: ${item.error}` : 'Waiting to send'}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 font-medium">
                    <Link
                      className="text-brand-600"
                      to={`/projects/${item.projectId}/wo/${workOrderId}/${item.kind}?date=${date}&shift=${shift}`}
                      onClick={() => setOpen(false)}
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      className="text-red-600"
                      onClick={() => window.confirm(`Discard the unsent entry for ${item.display.title}?`) && removeItem(item.id)}
                    >
                      Discard
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
