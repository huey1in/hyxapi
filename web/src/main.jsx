import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { UserProvider } from './context/User';
import { StatusProvider } from './context/Status';
import { ThemeProvider } from './context/Theme';
import { LoginModalProvider } from './context/LoginModal';
import { ToastContainer } from './components/ui';
import './index.css';
import './i18n/i18n';

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <UserProvider>
      <StatusProvider>
        <ThemeProvider>
          <LoginModalProvider>
            <App />
            <ToastContainer />
          </LoginModalProvider>
        </ThemeProvider>
      </StatusProvider>
    </UserProvider>
  </BrowserRouter>,
);
