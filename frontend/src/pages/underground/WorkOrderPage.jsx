import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import * as undergroundApi from '../../api/underground';
import useWorkOrder from '../../hooks/useWorkOrder';
import AppShell from '../../components/AppShell';
import ErrorBanner from '../../components/ErrorBanner';
import Spinner from '../../components/Spinner';
import WorkOrderForm from './WorkOrderForm';
import { formsForProjectType } from '../../utils/forms';
import { formatRupees, levelNames } from '../../utils/workOrder';

// One work order: the forms for entries under it and, for the superadmin,
// the rates its labour and billing figures use.
export default function WorkOrderPage() {
  const { projectId, workOrderId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { workOrder, setWorkOrder, missing, error } = useWorkOrder(projectId, workOrderId);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (missing) navigate(`/projects/${projectId}`, { replace: true });
  }, [missing, navigate, projectId]);

  const hasFormAccess = (slug) =>
    user.isSuperAdmin || user.assignments.some((a) => a.projectId === projectId && a.forms.includes(slug));
  const forms = formsForProjectType('underground').filter((f) => f.implemented && hasFormAccess(f.slug));

  return (
    <AppShell title={workOrder ? `Work order ${workOrder.number}` : 'Work order'} backTo={`/projects/${projectId}`}>
      <ErrorBanner message={error} />
      {!workOrder && !error && <Spinner full />}

      {workOrder && (
        <div className="space-y-6">
          <div className="text-sm text-slate-600">
            <div>
              {workOrder.levelIds.length > 0 ? `Levels: ${levelNames(workOrder)}` : 'No levels on this work order yet.'}
            </div>
            {workOrder.description && <div className="text-slate-500">{workOrder.description}</div>}
          </div>

          <div className="space-y-2">
            {forms.map((f) => (
              <button
                key={f.slug}
                type="button"
                onClick={() => navigate(`/projects/${projectId}/wo/${workOrderId}/${f.slug}`)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand-300"
              >
                <span className="font-medium text-slate-900">{f.label}</span>
              </button>
            ))}
          </div>

          {user.isSuperAdmin &&
            (editing ? (
              <WorkOrderForm
                projectId={projectId}
                title="Edit work order"
                initial={workOrder}
                onSubmit={(values) => undergroundApi.updateWorkOrder(projectId, workOrderId, values)}
                onSaved={(updated) => {
                  setWorkOrder(updated);
                  setEditing(false);
                }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-slate-900">Rates</h2>
                  <button type="button" className="text-sm font-medium text-brand-600" onClick={() => setEditing(true)}>
                    Edit
                  </button>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-slate-500">Rate per m³</dt>
                  <dd className="text-slate-900">{formatRupees(workOrder.ratePerCubicMetre)}</dd>
                  <dt className="text-slate-500">Driller wage</dt>
                  <dd className="text-slate-900">{formatRupees(workOrder.drillerWage)} / day</dd>
                  <dt className="text-slate-500">Helper wage</dt>
                  <dd className="text-slate-900">{formatRupees(workOrder.helperWage)} / day</dd>
                  <dt className="text-slate-500">Wage add-on</dt>
                  <dd className="text-slate-900">{workOrder.wageMarkupPct}%</dd>
                </dl>
              </div>
            ))}
        </div>
      )}
    </AppShell>
  );
}
