import { useEffect, useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { themeOptions, useTheme } from '../app/ThemeContext';

export default function ThemePicker({ className = '', compact = false }) {
  const { theme, setTheme, saving, accountLinked } = useTheme();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const pickerRef = useRef(null);
  const current = themeOptions.find((item) => item.value === theme) || themeOptions[0];

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const choose = async (nextTheme) => {
    setError('');
    try {
      await setTheme(nextTheme);
      setOpen(false);
    } catch {
      setError('Could not save this theme. Your previous theme was restored.');
    }
  };

  return <div className={`theme-picker ${className}`.trim()} ref={pickerRef}>
    <button type="button" className="theme-picker-trigger" aria-label={`Choose appearance. Current theme: ${current.label}`} title={`Appearance: ${current.label}`} aria-haspopup="menu" aria-expanded={open} onClick={() => { setError(''); setOpen((value) => !value); }}>
      <Palette size={16} aria-hidden="true" />
      {!compact && <span>Theme</span>}
    </button>
    {open && <div className="theme-picker-menu" role="menu" aria-label="Choose appearance">
      <div className="theme-picker-heading"><strong>Appearance</strong><span><i style={{ '--theme-current-color': current.color }} />{current.label}</span></div>
      <div className="theme-picker-options">{themeOptions.map((item) => <button type="button" role="menuitemradio" aria-checked={theme === item.value} className={`theme-picker-option ${theme === item.value ? 'selected' : ''}`} key={item.value} disabled={saving} onClick={() => { void choose(item.value); }}>
        <span className="theme-picker-preview" aria-hidden="true" style={{ '--theme-preview-bg': item.previewBg, '--theme-preview-surface': item.previewSurface, '--theme-preview-accent': item.color }}><i /><i /><i /></span>
        <span><strong>{item.label}</strong><small>{item.description}</small></span>
        {theme === item.value && <Check size={15} aria-hidden="true" />}
      </button>)}</div>
      {error && <p className="theme-picker-error" role="alert">{error}</p>}
      <p className="theme-picker-note">{saving ? 'Saving your preference…' : accountLinked ? 'Saved to your account across devices.' : 'Remembered on this device.'}</p>
    </div>}
  </div>;
}
