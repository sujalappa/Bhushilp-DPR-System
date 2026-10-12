import client from './client';

export const getAnalysis = (projectId, { from, to } = {}) =>
  client.get(`/projects/${projectId}/analysis`, { params: { from, to } }).then((r) => r.data.data);
