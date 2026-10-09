import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, BookOpen, BriefcaseBusiness, ChartNoAxesCombined, ChevronDown, ClipboardCheck, Code2, FileText, GraduationCap, Grid2X2, Layers3, LogOut, Menu, MessageSquareWarning, PanelLeftClose, PanelLeftOpen, Search, Settings2, ShieldCheck, Sparkles, Target, UsersRound, X } from 'lucide-react';
import { useAuth } from '../app/AuthContext';
import api, { dataOf } from '../api/client';
import BrandLogo from '../components/BrandLogo';
import ThemePicker from '../components/ThemePicker';
import ScrollArrows from '../components/ScrollArrows';
import { ErrorNotice, FullPageLoader } from '../components/Common';
import PortalPages from './PortalPages';

const navByRole = {
  student: [
    { label: 'MY SPACE', items: [{ id: 'dashboard', label: 'Overview', icon: Grid2X2 }, { id: 'skills', label: 'All skills', icon: Layers3 }, { id: 'roadmap', label: 'My roadmap', icon: ChartNoAxesCombined }, { id: 'learning', label: 'Learning', icon: BookOpen }] },
    { label: 'CAREER', items: [{ id: 'opportunities', label: 'Opportunities', icon: BriefcaseBusiness }, { id: 'recruitment', label: 'Recruitment', icon: ClipboardCheck }, { id: 'results', label: 'Assessment results', icon: FileText }] },
    { label: 'ACCOUNT', items: [{ id: 'notifications', label: 'Inbox', icon: Bell, count: true }, { id: 'complaints', label: 'Help & feedback', icon: MessageSquareWarning }, { id: 'profile', label: 'Profile & settings', icon: Settings2 }] },
  ],
  company: [
    { label: 'HIRING WORKSPACE', items: [{ id: 'dashboard', label: 'Overview', icon: Grid2X2 }, { id: 'candidates', label: 'Find candidates', icon: UsersRound }, { id: 'opportunities', label: 'Opportunities', icon: BriefcaseBusiness }, { id: 'recruitment', label: 'Recruitment', icon: ClipboardCheck }] },
    { label: 'ACCOUNT', items: [{ id: 'notifications', label: 'Inbox', icon: Bell, count: true }, { id: 'complaints', label: 'Help & feedback', icon: MessageSquareWarning }, { id: 'profile', label: 'Company profile', icon: Settings2 }] },
  ],
  admin: [
    { label: 'PLATFORM', items: [{ id: 'dashboard', label: 'Overview', icon: Grid2X2 }, { id: 'approvals', label: 'Company approvals', icon: ShieldCheck }, { id: 'users', label: 'User accounts', icon: UsersRound }] },
    { label: 'CATALOG & CONTENT', items: [{ id: 'domains', label: 'Career domains', icon: Layers3 }, { id: 'skills', label: 'Skills catalog', icon: Sparkles }, { id: 'learning', label: 'Learning content', icon: BookOpen }, { id: 'practice', label: 'Practice questions', icon: Target }, { id: 'coding', label: 'Coding problems', icon: Code2 }, { id: 'tests', label: 'Question bank', icon: ClipboardCheck }] },
    { label: 'OPERATIONS', items: [{ id: 'complaints', label: 'Complaints', icon: MessageSquareWarning }, { id: 'activity', label: 'Activity & audit', icon: FileText }, { id: 'notifications', label: 'Inbox', icon: Bell, count: true }] },
  ],
};
const titles = { dashboard: 'Overview', skills: 'Skill library', roadmap: 'Your learning roadmap', learning: 'Learning studio', practice: 'Practice question bank', coding: 'Coding challenge library', tests: 'Assessment question bank', opportunities: 'Opportunities', recruitment: 'Recruitment', results: 'Assessment results', notifications: 'Your inbox', complaints: 'Help & feedback', profile: 'Profile & settings', candidates: 'Candidate discovery', approvals: 'Company approvals', users: 'User accounts', domains: 'Career domains', activity: 'Activity & audit', };

export default function Workspace() {
  const { user, logout, updateUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem('yesgap.sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [unread, setUnread] = useState(0);
  const sidebarNavRef = useRef(null);
  const path = location.pathname.split('/').filter(Boolean);
  const role = path[0] || user.role;
  const section = path[1] || 'dashboard';
  const skillId = section === 'skills' ? path[2] : undefined;

  useEffect(() => {
    if (sidebarNavRef.current) sidebarNavRef.current.scrollTop = 0;
  }, [location.pathname]);

  useEffect(() => {
    try {
      window.localStorage.setItem('yesgap.sidebar-collapsed', String(sidebarCollapsed));
    } catch {
      // Keep the current layout for this page even if browser storage is unavailable.
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!user || user.role === 'company' && user.approvalStatus !== 'approved') return;
    let active = true;
    api.get('/notifications?limit=1').then((response) => { if (active) setUnread(response.data?.meta?.unreadCount || 0); }).catch(() => undefined);
    return () => { active = false; };
  }, [user, location.pathname]);

  if (user.role === 'company' && user.approvalStatus !== 'approved') {
    return <main className="pending-screen"><div className="pending-top"><BrandLogo subtitle="HIRING WORKSPACE" compact /><div className="pending-top-actions"><ThemePicker compact /><button className="button button-quiet" onClick={logout}><LogOut size={16} />Sign out</button></div></div><section className="pending-card"><div className="pending-icon"><ShieldCheck size={25} /></div><div className="eyebrow">COMPANY ACCESS</div><h1>We’re reviewing your workspace.</h1><p>Your company profile is in the administrator approval queue. We’ll update your YESGAP inbox as soon as a decision is made.</p>{user.approvalNote && <div className="notice">{user.approvalNote}</div>}<div className="pending-steps"><span className="step-done"><i>✓</i>Registration received</span><span className="step-current"><i>2</i>Admin review</span><span><i>3</i>Hiring workspace</span></div><button className="button button-soft" onClick={() => navigate('/company/profile')}>Review your company profile<ChevronDown size={15} /></button></section></main>;
  }

  const navigation = navByRole[role] || navByRole.student;
  const roleLabel = role === 'student' ? 'STUDENT WORKSPACE' : role === 'company' ? 'COMPANY WORKSPACE' : 'ADMIN CONSOLE';
  const goBack = () => {
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === 'number' && historyIndex > 0) navigate(-1);
    else navigate(`/${role}/dashboard`);
  };

  return <div className={`workspace-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    {mobileOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand-row"><BrandLogo to={`/${role}/dashboard`} subtitle={roleLabel} compact /><button aria-label="Close menu" className="icon-button mobile-close" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
      <div className="sidebar-nav-wrap"><nav ref={sidebarNavRef} className="sidebar-nav" aria-label="Main navigation">{navigation.map((group) => <div className="nav-group" key={group.label}><div className="nav-caption">{group.label}</div>{group.items.map((item) => <Link key={item.id} to={`/${role}/${item.id}`} onClick={() => setMobileOpen(false)} className={`nav-link ${section === item.id && !skillId ? 'active' : ''}`} aria-label={item.label} title={sidebarCollapsed ? item.label : undefined}><item.icon size={18} strokeWidth={1.8} /><span>{item.label}</span>{item.count && unread > 0 && <span className="nav-count">{unread > 9 ? '9+' : unread}</span>}</Link>)}</div>)}</nav><ScrollArrows targetRef={sidebarNavRef} /></div>
      {role === 'admin' && user.isSuperAdmin && <div className="admin-badge"><ShieldCheck size={15} />Super administrator</div>}
      <div className="sidebar-bottom"><button className="nav-link signout-link" onClick={logout} aria-label="Sign out" title={sidebarCollapsed ? 'Sign out' : undefined}><LogOut size={18} /><span>Sign out</span></button><div className="sidebar-user"><div className="user-avatar">{(user.fullName || user.companyName || 'Y').slice(0, 1).toUpperCase()}</div><div><strong>{user.fullName || user.companyName}</strong><small>{user.username}</small></div><button type="button" className="sidebar-collapse-action" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}>{sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button></div></div>
    </aside>
    <main className="workspace-main">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><button className="workspace-back" type="button" onClick={goBack} aria-label="Go to previous page" title="Go to previous page"><ArrowLeft size={17} /><span>Back</span></button><div className="breadcrumb"><span>{role === 'student' ? 'My space' : role === 'company' ? 'Hiring workspace' : 'Administration'}</span><b>/</b><strong>{titles[section] || 'Overview'}</strong></div></div><div className="topbar-actions"><div className="topbar-date">{new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}</div><ThemePicker className="topbar-theme" compact /><Link className="notification-button" to={`/${role}/notifications`} aria-label={`Inbox, ${unread} unread notifications`}><Bell size={18} />{unread > 0 && <i />}</Link><div className="topbar-divider" /><button className="topbar-profile" onClick={() => navigate(`/${role}/profile`)}><span className="user-avatar">{(user.fullName || 'Y').slice(0, 1).toUpperCase()}</span><span><strong>{user.fullName}</strong><small>{roleLabel}</small></span><ChevronDown size={14} /></button></div></header>
      {user.mustChangePassword && <ForcedPasswordNotice role={role} />}
      <PortalPages key={`${section}:${skillId || ''}`} role={role} section={section} skillId={skillId} user={user} onUserUpdated={updateUser} onNavigate={navigate} />
    </main>
  </div>;
}

function ForcedPasswordNotice({ role }) {
  const [open, setOpen] = useState(true);
  return open ? <div className="forced-password-banner"><LockKeyIcon /><span>This is a temporary password. Change it now in <Link to={`/${role}/profile`}>profile settings</Link>.</span><button aria-label="Dismiss" onClick={() => setOpen(false)}><X size={15} /></button></div> : null;
}
function LockKeyIcon() { return <ShieldCheck size={16} />; }
