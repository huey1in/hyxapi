import { Navigate, useLocation } from 'react-router-dom';
import { canonicalConsolePath } from '../../lib/console-routes';

export default function ConsoleRouteRedirect() {
  const { pathname, search, hash } = useLocation();
  return <Navigate replace to={{ pathname: canonicalConsolePath(pathname), search, hash }} />;
}
