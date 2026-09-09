import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as mastersApi from '../../api/masters';
import * as shiftCardApi from '../../api/shiftCard';
import AppShell from '../../components/AppShell';
import ErrorBanner from '../../components/ErrorBanner';
import Spinner from '../../components/Spinner';
import PickOrAdd from '../../components/PickOrAdd';

// A vehicle's shift is no longer a single record — a mid-shift driver
// handover means multiple segments (one per driver) plus, optionally, one
// "no driver ever assigned" segment for a vehicle that sat idle all shift.
// This screen is the drill-down step where the clerk picks which segment to
// open, or adds a new one for a driver not shown yet.
export default function DriverSegmentsPage() {
  const { projectId, date, shift, vehicleId } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [segments, setSegments] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([
      mastersApi.listVehicles(projectId, { active: true }),
      mastersApi.listDrivers(projectId, { active: true }),
      shiftCardApi.listShiftLogs(projectId, date, shift),
    ])
      .then(([vehicles, driverList, logs]) => {
        setVehicle(vehicles.find((v) => v._id === vehicleId) || null);
        setDrivers(driverList);
        setSegments(logs.filter((l) => l.vehicleId._id === vehicleId));
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, [projectId, date, shift, vehicleId]);

  const openSegment = (driverId) =>
    navigate(`/projects/${projectId}/shift-card/${date}/${shift}/${vehicleId}/${driverId || 'none'}`);

  const noDriverSegment = segments?.find((s) => !s.driverId);
  const driverSegments = segments?.filter((s) => s.driverId) || [];
  const availableDrivers = drivers.filter((d) => !driverSegments.some((s) => s.driverId._id === d._id));

  return (
    <AppShell
      title={vehicle?.name || 'Vehicle'}
      backTo={`/projects/${projectId}/shift-card/${date}/${shift}`}
    >
      <p className="mb-4 text-sm text-slate-500">
        {date} — Shift {shift}
      </p>

      <ErrorBanner message={error} />

      {segments === null ? (
        <Spinner full />
      ) : (
        <div className="space-y-2">
          {driverSegments.map((s) => (
            <button
              key={s._id}
              onClick={() => openSegment(s.driverId._id)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand-300"
            >
              <span className="font-medium text-slate-900">{s.driverId.name}</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  s.status === 'working' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {s.status === 'working' ? 'Working' : 'Non-working'}
              </span>
            </button>
          ))}

          {driverSegments.length === 0 && !noDriverSegment && (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              No drivers logged yet for this vehicle this shift.
            </p>
          )}

          {noDriverSegment && (
            <button
              onClick={() => openSegment(null)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand-300"
            >
              <span className="font-medium text-slate-900">No driver assigned</span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                Non-working
              </span>
            </button>
          )}
        </div>
      )}

      <div className="mt-6 space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <PickOrAdd
          label="Add a driver for this vehicle"
          options={availableDrivers}
          value=""
          onChange={openSegment}
          onCreate={(name) => mastersApi.createDriver(projectId, { name })}
        />

        {!noDriverSegment && (
          <button className="text-sm font-medium text-slate-500 underline" onClick={() => openSegment(null)}>
            This vehicle had no driver at all this shift
          </button>
        )}
      </div>
    </AppShell>
  );
}
