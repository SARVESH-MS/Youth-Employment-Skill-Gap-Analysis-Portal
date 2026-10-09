import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { dataOf, ensureCsrf } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState(30);

  const applySessionPolicy = useCallback((response) => {
    const minutes = Number(response.headers?.['x-session-idle-timeout']);
    if (Number.isFinite(minutes) && minutes > 0) setIdleTimeoutMinutes(minutes);
  }, []);

  const refreshUser = useCallback(async () => {
    const response = await api.get('/auth/me');
    applySessionPolicy(response);
    const next = dataOf(response);
    setUser(next);
    return next;
  }, [applySessionPolicy]);

  useEffect(() => {
    let alive = true;
    ensureCsrf(true).catch(() => undefined).then(() => api.get('/auth/me').catch(async (error) => {
      if (error.response?.status !== 401) throw error;
      return api.post('/auth/refresh');
    })).then((response) => { if (alive) { applySessionPolicy(response); setUser(dataOf(response)); } })
      .catch(() => { if (alive) setUser(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [applySessionPolicy]);

  useEffect(() => {
    const expireSession = () => setUser(null);
    window.addEventListener('yesgap:session-expired', expireSession);
    return () => window.removeEventListener('yesgap:session-expired', expireSession);
  }, []);

  const login = useCallback(async (credentials) => {
    await ensureCsrf(true);
    const response = await api.post('/auth/login', credentials);
    applySessionPolicy(response);
    setUser(dataOf(response));
    return dataOf(response);
  }, [applySessionPolicy]);
  const googleLogin = useCallback(async (credentials) => {
    await ensureCsrf(true);
    const response = await api.post('/auth/google', credentials);
    applySessionPolicy(response);
    setUser(dataOf(response));
    return dataOf(response);
  }, [applySessionPolicy]);
  const register = useCallback(async (role, values) => {
    await ensureCsrf(true);
    const response = await api.post(`/auth/register/${role}`, values);
    applySessionPolicy(response);
    setUser(dataOf(response));
    return dataOf(response);
  }, [applySessionPolicy]);
  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally { setUser(null); }
  }, []);
  const updateUser = useCallback((changes) => setUser((current) => current ? { ...current, ...changes } : current), []);

  useEffect(() => {
    if (!user) return undefined;
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { void logout(); }, idleTimeoutMinutes * 60 * 1000);
    };
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [user?._id, idleTimeoutMinutes, logout]);

  const value = useMemo(() => ({ user, setUser, loading, login, googleLogin, register, logout, refreshUser, updateUser }), [user, loading, login, googleLogin, register, logout, refreshUser, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
