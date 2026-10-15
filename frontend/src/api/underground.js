import client from './client';

const base = (projectId, resource) => `/projects/${projectId}/${resource}`;

export const listWorkOrders = (projectId, params = {}) =>
  client.get(base(projectId, 'work-orders'), { params }).then((r) => r.data.data);
export const createWorkOrder = (projectId, payload) =>
  client.post(base(projectId, 'work-orders'), payload).then((r) => r.data.data);
export const updateWorkOrder = (projectId, workOrderId, payload) =>
  client.patch(`${base(projectId, 'work-orders')}/${workOrderId}`, payload).then((r) => r.data.data);

// Both list calls return { entries, ...totals } for one work order, date
// and shift.
export const listProduction = (projectId, workOrderId, date, shift) =>
  client.get(base(projectId, 'ug-production'), { params: { workOrderId, date, shift } }).then((r) => r.data.data);
export const upsertProduction = (projectId, payload) =>
  client.post(base(projectId, 'ug-production'), payload).then((r) => r.data.data);
export const deleteProduction = (projectId, entryId) =>
  client.delete(`${base(projectId, 'ug-production')}/${entryId}`);

export const listDevelopment = (projectId, workOrderId, date, shift) =>
  client.get(base(projectId, 'ug-development'), { params: { workOrderId, date, shift } }).then((r) => r.data.data);
export const upsertDevelopment = (projectId, payload) =>
  client.post(base(projectId, 'ug-development'), payload).then((r) => r.data.data);
export const deleteDevelopment = (projectId, entryId) =>
  client.delete(`${base(projectId, 'ug-development')}/${entryId}`);
