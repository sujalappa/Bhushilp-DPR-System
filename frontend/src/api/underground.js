import client from './client';

const base = (projectId, resource) => `/projects/${projectId}/${resource}`;

// Both list calls return { entries, ...totals } for one date + shift.
export const listProduction = (projectId, date, shift) =>
  client.get(base(projectId, 'ug-production'), { params: { date, shift } }).then((r) => r.data.data);
export const upsertProduction = (projectId, payload) =>
  client.post(base(projectId, 'ug-production'), payload).then((r) => r.data.data);
export const deleteProduction = (projectId, entryId) =>
  client.delete(`${base(projectId, 'ug-production')}/${entryId}`);

export const listDevelopment = (projectId, date, shift) =>
  client.get(base(projectId, 'ug-development'), { params: { date, shift } }).then((r) => r.data.data);
export const upsertDevelopment = (projectId, payload) =>
  client.post(base(projectId, 'ug-development'), payload).then((r) => r.data.data);
export const deleteDevelopment = (projectId, entryId) =>
  client.delete(`${base(projectId, 'ug-development')}/${entryId}`);
