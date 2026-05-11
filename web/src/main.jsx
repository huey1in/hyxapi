import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { StatusProvider } from './context/Status';
import { UserProvider } from './context/User';
import { ThemeProvider } from './context/Theme';
import { LoginModalProvider } from './context/LoginModal';
import { ToastContainer } from './components/ui/feedback/Toast';
import { ConfirmHost } from './components/business/confirm';
import LoginModal from './components/business/auth/LoginModal';
import './i18n/i18n';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StatusProvider>
      <UserProvider>
        <BrowserRouter>
          <ThemeProvider>
            <LoginModalProvider>
              <App />
              <LoginModal />
              <ToastContainer />
              <ConfirmHost />
            </LoginModalProvider>
          </ThemeProvider>
        </BrowserRouter>
      </UserProvider>
    </StatusProvider>
  </React.StrictMode>,
);
