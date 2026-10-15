// Under an entry that's still on the phone: waiting for signal, or refused
// by the server (with its reason) and waiting to be fixed or discarded.
export default function WaitingBadge({ item }) {
  if (item.status === 'failed') {
    return (
      <div className="mt-2 rounded-md bg-red-50 px-2 py-1 text-sm text-red-700">
        ✗ Not accepted: {item.error} Edit it and save again, or discard it.
      </div>
    );
  }
  return (
    <div className="mt-2 inline-block rounded-md bg-accent-50 px-2 py-1 text-sm font-medium text-accent-700">
      ⏳ On this phone · waiting to send
    </div>
  );
}
