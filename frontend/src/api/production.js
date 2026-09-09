import client from './client';

export const getProduction = (projectId, date, shift) =>
  client
    .get(`/projects/${projectId}/production`, { params: { date, shift } })
    .then((r) => r.data.data);

export const upsertProduction = (projectId, payload) =>
  client.post(`/projects/${projectId}/production`, payload).then((r) => r.data.data);
