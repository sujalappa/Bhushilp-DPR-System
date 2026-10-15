import client from './client';

// Vehicles, drivers and loading points share the same list+create shape from
// the frontend's point of view (see backend/utils/simpleMasterController.js
// for why drivers/loading-points are literally the same controller).
const path = (projectId, resource) => `/projects/${projectId}/${resource}`;

export const listVehicles = (projectId, params = {}) =>
  client.get(path(projectId, 'vehicles'), { params }).then((r) => r.data.data);
export const createVehicle = (projectId, payload) =>
  client.post(path(projectId, 'vehicles'), payload).then((r) => r.data.data);

export const listDrivers = (projectId, params = {}) =>
  client.get(path(projectId, 'drivers'), { params }).then((r) => r.data.data);
export const createDriver = (projectId, payload) =>
  client.post(path(projectId, 'drivers'), payload).then((r) => r.data.data);

// Underground projects
export const listLevels = (projectId, params = {}) =>
  client.get(path(projectId, 'levels'), { params }).then((r) => r.data.data);
export const createLevel = (projectId, payload) =>
  client.post(path(projectId, 'levels'), payload).then((r) => r.data.data);
export const updateLevel = (projectId, levelId, payload) =>
  client.patch(`${path(projectId, 'levels')}/${levelId}`, payload).then((r) => r.data.data);

export const listSupervisors = (projectId, params = {}) =>
  client.get(path(projectId, 'supervisors'), { params }).then((r) => r.data.data);
export const createSupervisor = (projectId, payload) =>
  client.post(path(projectId, 'supervisors'), payload).then((r) => r.data.data);

// Workers are added by the server when a new name is typed on an entry.
export const listWorkers = (projectId, params = {}) =>
  client.get(path(projectId, 'workers'), { params }).then((r) => r.data.data);

export const listHeadings = (projectId, params = {}) =>
  client.get(path(projectId, 'headings'), { params }).then((r) => r.data.data);
export const createHeading = (projectId, payload) =>
  client.post(path(projectId, 'headings'), payload).then((r) => r.data.data);

export const listLoadingPoints = (projectId, params = {}) =>
  client.get(path(projectId, 'loading-points'), { params }).then((r) => r.data.data);
export const createLoadingPoint = (projectId, payload) =>
  client.post(path(projectId, 'loading-points'), payload).then((r) => r.data.data);
