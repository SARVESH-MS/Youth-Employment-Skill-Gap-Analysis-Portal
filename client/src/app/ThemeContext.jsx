import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import api from '../api/client';

export const themeOptions = [
  { value: 'midnight', label: 'Midnight', description: 'Deep teal', color: '#55c7b0', previewBg: '#102022', previewSurface: '#1a3032' },
  { value: 'dark', label: 'Dark', description: 'Charcoal cyan', color: '#4dbfd0', previewBg: '#181b22', previewSurface: '#272b33' },
  { value: 'light', label: 'Light', description: 'Warm neutral', color: '#2b8279', previewBg: '#f7f7f2', previewSurface: '#fffefa' },
  { value: 'slate', label: 'Slate', description: 'Cool blue', color: '#397cab', previewBg: '#eef4f8', previewSurface: '#fbfdff' },
  { value: 'emerald', label: 'Emerald', description: 'Forest green', color: '#24845c', previewBg: '#edf6f0', previewSurface: '#fbfefc' },
  { value: 'royal', label: 'Royal', description: 'Indigo violet', color: '#7160c7', previewBg: '#f2f0fb', previewSurface: '#fcfbff' },
  { value: 'sunset', label: 'Sunset', description: 'Copper cream', color: '#bb6642', previewBg: '#faf1e9', previewSurface: '#fffaf5' },
  { value: 'graphite', label: 'Graphite', description: 'Charcoal mint', color: '#70c7ae', previewBg: '#151515', previewSurface: '#252525' },
  { value: 'ocean', label: 'Ocean', description: 'Navy aqua', color: '#45b9d0', previewBg: '#10212b', previewSurface: '#1e3944' },
  { value: 'rose', label: 'Rose', description: 'Soft berry', color: '#ae5876', previewBg: '#f8eff3', previewSurface: '#fffbfd' },
  { value: 'amber', label: 'Amber', description: 'Warm sand', color: '#a66b25', previewBg: '#f8f2e8', previewSurface: '#fffdf8' },
];

const themeValues = new Set(themeOptions.map((item) => item.value));
const themeStorageKey = 'yesgap.theme';
const ThemeContext = createContext(null);

function readStoredTheme() {
  try {
    const stored = window.localStorage.getItem(themeStorageKey);
    return themeValues.has(stored) ? stored : 'dark';
  } catch {
    return 'dark';
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
