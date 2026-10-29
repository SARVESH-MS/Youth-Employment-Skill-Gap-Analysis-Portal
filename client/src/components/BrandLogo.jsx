import { Link } from 'react-router-dom';
import { useTheme } from '../app/ThemeContext';

export default function BrandLogo({ to = '/', className = '', variant = 'auto', subtitle, compact = false, onClick }) {
  const { theme } = useTheme();
  if (compact) {
    return <Link to={to} onClick={onClick} className={`brand brand-with-emblem ${className}`.trim()} aria-label={`YESGAP ${subtitle || 'home'}`}>
      <img className="brand-emblem" src="/yesgap-mark.svg" alt="" />
      <span><strong>YESGAP</strong>{subtitle && <small>{subtitle}</small>}</span>
    </Link>;
  }

  const darkThemes = new Set(['midnight', 'dark', 'graphite']);
  const useInverse = variant === 'inverse' || variant === 'auto' && darkThemes.has(theme);
  return <Link to={to} onClick={onClick} className={`brand-logo-link ${className}`.trim()} aria-label="YESGAP home">
    <img className="brand-logo-image" src={useInverse ? '/yesgap-logo-inverse.svg' : '/yesgap-logo.svg'} alt="YESGAP Youth Employment" />
  </Link>;
}
