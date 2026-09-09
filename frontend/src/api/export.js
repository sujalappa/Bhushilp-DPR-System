import client from './client';

export const getExportPreview = (projectId, type, { from, to } = {}) =>
  client
    .get(`/projects/${projectId}/export/preview`, { params: { type, from, to } })
    .then((r) => r.data.data);

// Downloads the .xlsx directly via a blob rather than a plain <a href> link,
// so the request goes through axios with credentials guaranteed attached
// (a bare cross-navigation link relies on SameSite cookie behavior, which
// is fine here but this is the more robust, browser-independent way).
export async function downloadExportExcel(projectId, projectName, { from, to } = {}) {
  const res = await client.get(`/projects/${projectId}/export/excel`, {
    params: { from, to },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}_export.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
