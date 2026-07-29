import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { UserProvider } from './context/User';
import { StatusProvider } from './context/Status';
import { ThemeProvider } from './context/Theme';
import { ToastContainer } from './components/ui';
import { updateAPI } from './helpers/api';
import { redirectToAuth } from './helpers/auth';
import './index.css';
import './i18n/i18n';

// 跨域单点登录：home-site 登录后带 #code= 跳转过来，渲染前用该一次性 code
// 调用后端 exchange 接口，在本（控制台）域名上建立会话并写入本地用户态。
// 必须在 render 之前完成，否则子组件 PrivateRoute 的 effect 会先于此处触发而跳走。
async function consumeHandoffCode() {
  const hash = window.location.hash || '';
  const match = hash.match(/[#&]code=([^&]+)/);
  if (!match) return;
  const code = decodeURIComponent(match[1]);
  try {
    const res = await fetch('/api/user/handoff/exchange', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const body = await res.json();
    if (res.ok && body?.success && body?.data) {
      try {
        localStorage.setItem('user', JSON.stringify(body.data));
      } catch {}
      updateAPI();
    }
  } catch {}
  // 无论成功失败都清除地址栏的 fragment，避免 code 残留/重放
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {}
}

async function bootstrap() {
  await consumeHandoffCode();
  window.addEventListener('routify:auth-required', () => redirectToAuth('login'));
  createRoot(document.getElementById('root')).render(
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
}

bootstrap();
