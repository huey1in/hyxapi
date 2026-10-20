import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { UserProvider } from './context/User';
import { StatusProvider } from './context/Status';
import { ThemeProvider } from './context/Theme';
import { ToastContainer } from './components/ui';
import { redirectToAuth } from './helpers/auth';
import { useAuthStore } from './stores/auth-store';
import './index.css';
import './i18n/i18n';

window.addEventListener('hyxware:auth-required', () => redirectToAuth('login'));
const queryClient = new QueryClient();
useAuthStore.subscribe((next, previous) => {
  if (next.auth.session?.sid !== previous.auth.session?.sid || next.auth.user?.id !== previous.auth.user?.id) queryClient.clear();
});
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter future={{ v7_startTransition: true }}>
      <UserProvider>
        <StatusProvider>
          <ThemeProvider>
            <App />
            <ToastContainer />
          </ThemeProvider>
        </StatusProvider>
      </UserProvider>
    </BrowserRouter>
  </QueryClientProvider>,
);
