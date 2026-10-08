import { motion } from 'framer-motion';
import { ArrowRight, LoaderCircle, Search, TriangleAlert } from 'lucide-react';

export function PageMotion({ children, className = '' }) {
  return <motion.div className={className} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: 'easeOut' }}>{children}</motion.div>;
}

export function FullPageLoader() {
  return <div className="loading-screen"><LoaderCircle className="spin" size={28} /><span>Preparing your workspace</span></div>;
}

export function Loading({ label = 'Loading your information…' }) {
  return <div className="loading-inline"><LoaderCircle className="spin" size={18} />{label}</div>;
}

export function ErrorNotice({ message, onRetry }) {
  return <div className="notice error-notice" role="alert"><TriangleAlert size={17} /><span>{message}</span>{onRetry && <button className="text-button" onClick={onRetry}>Try again</button>}</div>;
}

export function EmptyState({ icon: Icon = Search, title, description, action }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={22} /></div><h3>{title}</h3><p>{description}</p>{action && <button className="button button-soft" onClick={action.onClick}>{action.label}<ArrowRight size={15} /></button>}</div>;
}

export function StatCard({ label, value, detail, icon: Icon, tone = 'mint', trend }) {
  return <motion.article className={`stat-card stat-${tone}`} whileHover={{ y: -3 }} transition={{ duration: 0.18 }}>
    <div className="stat-top"><span>{label}</span><div className="stat-icon">{Icon && <Icon size={18} />}</div></div>
    <div className="stat-value">{value ?? '—'}{trend && <span className="stat-trend">{trend}</span>}</div>
    {detail && <p>{detail}</p>}
  </motion.article>;
}

export function SectionHeading({ eyebrow, title, description, action }) {
  return <div className="section-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>;
}

export function ProgressBar({ value = 0, tone = 'mint', label }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className={`progress-track progress-${tone}`} role="progressbar" aria-label={label || 'Progress'} aria-valuemin="0" aria-valuemax="100" aria-valuenow={safe}><motion.span initial={{ width: 0 }} animate={{ width: `${safe}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} /></div>;
}

export function Badge({ children, tone = 'neutral' }) { return <span className={`badge badge-${tone}`}>{children}</span>; }

export function Field({ label, hint, children, className = '' }) {
  return <label className={`field ${className}`}><span className="field-label">{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function FormInput(props) { return <input className="input" {...props} />; }
export function FormSelect(props) { return <select className="input select-input" {...props} />; }

export function Modal({ title, onClose, children }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><motion.section role="dialog" aria-modal="true" aria-label={title} className="modal-card" initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}><header><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}>×</button></header>{children}</motion.section></div>;
}
