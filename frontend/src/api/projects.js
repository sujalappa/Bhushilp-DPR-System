import client from './client';

export const listProjects = (type) =>
  client.get('/projects', { params: type ? { type } : {} }).then((r) => r.data.data);

export const createProject = (payload) =>
  client.post('/projects', payload).then((r) => r.data.data);
