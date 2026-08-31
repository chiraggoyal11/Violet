import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function RequireAuth({ children }) {
  const { token, booting } = useAuth();
  const location = useLocation();

  if (booting) {
    return <p className="status">Loading…</p>;
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
