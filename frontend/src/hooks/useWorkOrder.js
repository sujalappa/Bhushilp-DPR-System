import { useEffect, useState } from 'react';
import * as undergroundApi from '../api/underground';

// Loads one work order of an underground project. `workOrder` is null while
// loading; `missing` is true if the id isn't one of the project's.
export default function useWorkOrder(projectId, workOrderId) {
  const [workOrder, setWorkOrder] = useState(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    undergroundApi
      .listWorkOrders(projectId)
      .then((list) => {
        if (cancelled) return;
        const found = list.find((w) => w._id === workOrderId);
        if (found) setWorkOrder(found);
        else setMissing(true);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [projectId, workOrderId]);

  return { workOrder, setWorkOrder, missing, error };
}
