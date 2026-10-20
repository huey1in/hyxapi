import { useNavigate } from 'react-router-dom';
import { useMobileSidebar } from '../context/MobileSidebar';
import { logoutAuthentication, updateAPI } from '../helpers';
import { useOwnedOperation } from './useOwnedOperation';

export function useLogout() {
  const navigate = useNavigate();
  const [, setMobileOpen] = useMobileSidebar();
  const { busy, run } = useOwnedOperation();
  const logout = () => void run(async (signal) => {
    const cleared = await logoutAuthentication(signal);
    if (!cleared) return;
    updateAPI();
    setMobileOpen(false);
    navigate('/');
  });
  return { busy, logout };
}
