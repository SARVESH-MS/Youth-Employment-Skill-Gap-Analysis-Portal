import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import api from '../api/client';

export const themeOptions = [
  { value: 'midnight', label: 'Midnight', description: 'Deep navy and mint', color: '#64c7b2' },
  { value: 'dark', label: 'Dark', description: 'Low-glare charcoal', color: '#83d7c5' },
  { value: 'light', label: 'Light', description: 'Warm paper', color: '#379889' },
  { value: 'slate', label: 'Slate', description: 'Cool blue-grey', color: '#6aa9d2' },
  { value: 'emerald', label: 'Emerald', description: 'Evergreen accents', color: '#319b73' },
  { value: 'royal', label: 'Royal', description: 'Indigo and violet', color: '#7364c5' },
  { value: 'sunset', label: 'Sunset', description: 'Warm copper', color: '#c46d47' },
  { value: 'graphite', label: 'Graphite', description: 'Monochrome', color: '#a5b2b3' },
];

const themeValues = new Set(themeOptions.map((item) => item.value));
const themeStorageKey = 'yesgap.theme';
const ThemeContext = createContext(null);

function readStoredTheme() {
  try {
    const stored = window.localStorage.getItem(themeStorageKey);
    return themeValues.has(stored) ? stored : 'midnight';
  } catch {
    return 'midnight';
  }
}

function storeTheme(theme) {
  try { window.localStorage.setItem(themeStorageKey, theme); } catch { /* Keep the current theme for this page. */ }
}

export function ThemeProvider({ children }) {
  const { user, updateUser, loading: authLoading } = useAuth();
  const [theme, setThemeState] = useState(readStoredTheme);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    const accountTheme = themeValues.has(user?.theme) ? user.theme : null;
    setThemeState(accountTheme || readStoredTheme());
  }, [authLoading, user?.theme]);

  useEffect(() => {
    if (!themeValues.has(theme)) return;
    document.documentElement.dataset.theme = theme;
    storeTheme(theme);
  }, [theme]);

  const setTheme = useCallback(async (nextTheme) => {
    if (!themeValues.has(nextTheme) || nextTheme === theme) return;
    const previousTheme = theme;
    setThemeState(nextTheme);
    if (!user) return;

    updateUser({ theme: nextTheme });
    setSaving(true);
    try {
      await api.patch('/profile', { theme: nextTheme });
    } catch (error) {
      setThemeState(previousTheme);
      updateUser({ theme: previousTheme });
      throw error;
    } finally {
      setSaving(false);
    }
  }, [theme, user, updateUser]);

  const accountLinked = Boolean(user);
  const value = useMemo(() => ({ theme, setTheme, saving, accountLinked }), [theme, setTheme, saving, accountLinked]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
