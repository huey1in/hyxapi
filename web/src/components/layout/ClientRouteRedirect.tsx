import { Navigate, useLocation } from 'react-router-dom';
import { canonicalClientPath } from '../../lib/console-routes';

export default function ClientRouteRedirect() {
  const { pathname, search, hash } = useLocation();
  return <Navigate replace to={{ pathname: canonicalClientPath(pathname), search, hash }} />;
}
