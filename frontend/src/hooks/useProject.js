import { useCallback, useEffect, useState } from 'react';
import * as projectsApi from '../api/projects';

// Loads one project from the user's own project list. `project` is null
// while loading; `missing` is true when it isn't in the list — a bad URL or
// a project the user has no access to, which look the same from here.
export default function useProject(projectId) {
  const [project, setProject] = useState(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    let cancelled = false;
    projectsApi
      .listProjects()
      .then((projects) => {
        if (cancelled) return;
        const found = projects.find((p) => p._id === projectId);
        if (found) setProject(found);
        else setMissing(true);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(load, [load]);

  return { project, setProject, missing, error };
}
