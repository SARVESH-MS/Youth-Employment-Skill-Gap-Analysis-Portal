import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './app/AuthContext';
import { ThemeProvider } from './app/ThemeContext';
import { LandingPage, AuthPage } from './pages/PublicPages';
import Workspace from './pages/Workspace';
import { FullPageLoader } from './components/Common';
import AssistantChat from './components/AssistantChat';
import ScrollArrows from './components/ScrollArrows';

function Guard({ role }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={`/${user.role}/dashboard`} replace />;
  if (user.mustChangePassword && !window.location.pathname.endsWith('/profile')) return <Navigate to={`/${user.role}/profile`} replace />;
  return <Workspace />;
}

export default function App() {
  return <ThemeProvider><AppRoutes /></ThemeProvider>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  return <>
    <Routes>
      <Route path="/" element={loading ? <FullPageLoader /> : user ? <Navigate to={`/${user.role}/dashboard`} replace /> : <LandingPage />} />
      <Route path="/login" element={user ? <Navigate to={`/${user.role}/dashboard`} replace /> : <AuthPage mode="login" />} />
      <Route path="/register/:role" element={user ? <Navigate to={`/${user.role}/dashboard`} replace /> : <AuthPage mode="register" />} />
      <Route path="/student/*" element={<Guard role="student" />} />
      <Route path="/company/*" element={<Guard role="company" />} />
      <Route path="/admin/*" element={<Guard role="admin" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <AssistantChat />
    <ScrollArrows />
  </>;
}
