import client from './client';

export const listUsers = () => client.get('/users').then((r) => r.data.data);

export const createUser = (payload) => client.post('/users', payload).then((r) => r.data.data);

export const updateUser = (id, payload) =>
  client.patch(`/users/${id}`, payload).then((r) => r.data.data);

export const setAssignments = (id, assignments) =>
  client.post(`/users/${id}/assignments`, { assignments }).then((r) => r.data.data);
