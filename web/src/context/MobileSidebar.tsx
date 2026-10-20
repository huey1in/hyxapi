import { createContext, useContext, useEffect, useState } from 'react';
import type { Dispatch, PropsWithChildren, SetStateAction } from 'react';
import { useLocation } from 'react-router-dom';

type SidebarState = [boolean, Dispatch<SetStateAction<boolean>>];
const MobileSidebarContext = createContext<SidebarState>([false, () => {}]);
export function MobileSidebarProvider({ children }: PropsWithChildren) {
  const state = useState(false);
  const location = useLocation();
  useEffect(() => { state[1](false); }, [location.pathname, location.search]);
  return <MobileSidebarContext.Provider value={state}>{children}</MobileSidebarContext.Provider>;
}
export const useMobileSidebar = () => useContext(MobileSidebarContext);
