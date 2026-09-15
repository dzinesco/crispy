import { Navigate, useLocation } from 'react-router-dom';
import { useMe } from '../lib/api.js';

export default function AdminGate({ children }) {
  const { data, isLoading, error } = useMe();
  const location = useLocation();
  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 text-ink/50">Loading…</div>
    );
  }
  if (error || !data?.user) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}
