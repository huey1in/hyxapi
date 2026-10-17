import { createContext, useContext, useState } from 'react';

const MobileSidebarContext = createContext([false, () => {}]);

export const MobileSidebarProvider = ({ children }) => {
  const state = useState(false);
  return (
    <MobileSidebarContext.Provider value={state}>
      {children}
    </MobileSidebarContext.Provider>
  );
};

export const useMobileSidebar = () => useContext(MobileSidebarContext);
