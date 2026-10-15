import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as undergroundApi from '../../api/underground';
import Button from '../../components/Button';
import ErrorBanner from '../../components/ErrorBanner';
import Spinner from '../../components/Spinner';
import WorkOrderForm from './WorkOrderForm';
import { WORK_ORDER_DEFAULTS, levelNames } from '../../utils/workOrder';

// An underground project's page lists its work orders; each one opens the
// forms for entries under that contract. Only a superadmin can add one,
// since it carries billing rates.
export default function WorkOrderList({ projectId, canManage }) {
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    undergroundApi
      .listWorkOrders(projectId, { active: true })
      .then((list) => !cancelled && setWorkOrders(list))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (error) return <ErrorBanner message={error} />;
  if (workOrders === null) return <Spinner full />;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-slate-600">Work orders</h2>

      {workOrders.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          {canManage ? 'No work orders yet. Add the first one below.' : 'No work orders yet. Ask the admin to add one.'}
        </p>
      )}

      <div className="space-y-2">
        {workOrders.map((w) => (
          <button
            key={w._id}
            type="button"
            onClick={() => navigate(`/projects/${projectId}/wo/${w._id}`)}
            className="block w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand-300"
          >
            <div className="font-medium text-slate-900">Work order {w.number}</div>
            <div className="text-sm text-slate-500">
              {w.levelIds?.length > 0 ? `Levels: ${levelNames(w)}` : 'No levels yet'}
            </div>
            {w.description && <div className="text-sm text-slate-500">{w.description}</div>}
          </button>
        ))}
      </div>

      {canManage &&
        (adding ? (
          <WorkOrderForm
            projectId={projectId}
            title="New work order"
            initial={WORK_ORDER_DEFAULTS}
            onSubmit={(values) => undergroundApi.createWorkOrder(projectId, values)}
            onSaved={(created) => {
              setWorkOrders((list) => [...list, created].sort((a, b) => a.number.localeCompare(b.number)));
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <Button variant="accent" className="w-full" onClick={() => setAdding(true)}>
            + Add work order
          </Button>
        ))}
    </div>
  );
}
