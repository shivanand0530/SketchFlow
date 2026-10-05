import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthContext';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading SketchFlow...</div>;
  return user ? <Outlet /> : <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;
}