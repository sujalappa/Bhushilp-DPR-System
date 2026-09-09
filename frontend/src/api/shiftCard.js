import client from './client';

export const getShiftStatus = (projectId, date, shift) =>
  client
    .get(`/projects/${projectId}/shift-status`, { params: { date, shift } })
    .then((r) => r.data.data);

export const setShiftStatus = (projectId, payload) =>
  client.post(`/projects/${projectId}/shift-status`, payload).then((r) => r.data.data);

export const listShiftLogs = (projectId, date, shift) =>
  client
    .get(`/projects/${projectId}/shift-logs`, { params: { date, shift } })
    .then((r) => r.data.data);

export const getShiftLog = (projectId, shiftLogId) =>
  client.get(`/projects/${projectId}/shift-logs/${shiftLogId}`).then((r) => r.data.data);

export const upsertShiftLog = (projectId, payload) =>
  client.post(`/projects/${projectId}/shift-logs`, payload).then((r) => r.data.data);

export const listTrips = (projectId, shiftLogId) =>
  client.get(`/projects/${projectId}/shift-logs/${shiftLogId}/trips`).then((r) => r.data.data);

export const addTrip = (projectId, shiftLogId, payload) =>
  client.post(`/projects/${projectId}/shift-logs/${shiftLogId}/trips`, payload).then((r) => r.data.data);

export const updateTrip = (projectId, shiftLogId, tripId, payload) =>
  client
    .patch(`/projects/${projectId}/shift-logs/${shiftLogId}/trips/${tripId}`, payload)
    .then((r) => r.data.data);

export const deleteTrip = (projectId, shiftLogId, tripId) =>
  client.delete(`/projects/${projectId}/shift-logs/${shiftLogId}/trips/${tripId}`);
