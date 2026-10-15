import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as authApi from '../api/auth';
import { clearCache, rememberUser } from '../offline/cache';
import { clearOutbox } from '../offline/outbox';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .fetchMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const loggedInUser = await authApi.login(email, password);
    // A fresh copy of the lists for whoever this is. The outbox is kept: it's
    // usually the same person logging back in to send what's waiting.
    clearCache();
    rememberUser(loggedInUser);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const logout = useCallback(async () => {
    // Needs the server (offline this throws), or the session cookie would
    // outlive the log out.
    await authApi.logout();
    clearCache();
    clearOutbox();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// A restricted user whose access resolves to exactly one project+form skips
// every picker screen and lands directly on that form — the common case for
// a single-purpose data-entry clerk.
export function getLandingPath(user) {
  if (!user) return '/login';
  if (user.isSuperAdmin) return '/projects';
  if (user.assignments.length === 1 && user.assignments[0].forms.length === 1) {
    const { projectId, forms } = user.assignments[0];
    // Underground forms live inside a work order, so land on the project's
    // work-order list instead.
    if (forms[0].startsWith('ug-')) return `/projects/${projectId}`;
    return `/projects/${projectId}/${forms[0]}`;
  }
  return '/projects';
}
