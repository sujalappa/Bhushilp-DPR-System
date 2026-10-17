import client from './client';

const base = (projectId) => `/projects/${projectId}/utilization`;

// { shiftHours, wholeShift, vehicles } for one date and shift.
export const listUtilization = (projectId, date, shift) =>
  client.get(base(projectId), { params: { date, shift } }).then((r) => r.data.data);
export const upsertUtilization = (projectId, payload) =>
  client.post(base(projectId), payload).then((r) => r.data.data);
export const deleteUtilization = (projectId, entryId) => client.delete(`${base(projectId)}/${entryId}`);
