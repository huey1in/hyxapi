import { Navigate, useLocation } from 'react-router-dom';
import { logLocation } from './log-navigation';

export default function LegacyLogRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={logLocation(search, hash)} replace />;
}
