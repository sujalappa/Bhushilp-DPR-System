import client from './client';

export const listFuelLogs = (projectId, date) =>
  client.get(`/projects/${projectId}/fuel`, { params: { date } }).then((r) => r.data.data);

export const upsertFuelLog = (projectId, payload) =>
  client.post(`/projects/${projectId}/fuel`, payload).then((r) => r.data.data);

export const deleteFuelLog = (projectId, fuelLogId) => client.delete(`/projects/${projectId}/fuel/${fuelLogId}`);
