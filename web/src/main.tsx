import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { UserProvider } from './context/User';
import { StatusProvider } from './context/Status';
import { ThemeProvider } from './context/Theme';
import { ToastContainer } from './components/ui';
import { redirectToAuth } from './helpers/auth';
import './index.css';
import './i18n/i18n';

window.addEventListener('hyxware:auth-required', () => redirectToAuth('login'));
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(
  <BrowserRouter>
    <UserProvider>
      <StatusProvider>
        <ThemeProvider>
          <App />
          <ToastContainer />
        </ThemeProvider>
      </StatusProvider>
    </UserProvider>
  </BrowserRouter>,
);
