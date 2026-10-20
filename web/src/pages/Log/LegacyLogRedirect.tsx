import { Navigate, useLocation } from 'react-router-dom';
import { logTabLocation } from './log-navigation';
import type { LogTab } from './log-navigation';

export default function LegacyLogRedirect({ tab }: { tab: LogTab }) {
  const { search, hash } = useLocation();
  return <Navigate to={logTabLocation(tab, search, hash)} replace />;
}
