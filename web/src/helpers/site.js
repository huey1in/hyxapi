// 控制台无独立登录界面：未登录/无有效 token 时统一跳转到 home-site（首页站点）的登录页。
// home-site 地址优先取 VITE_HOME_SITE_URL；本地开发默认指向 Vite 的 5173 端口；
// 其余环境回退到生产首页域名。

let redirecting = false;

export function homeSiteUrl() {
  const configured = import.meta.env.VITE_HOME_SITE_URL;
  if (configured && configured.trim()) {
    return configured.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:5173`;
    }
  }
  return 'https://demo.claudeai.one';
}

// 读取邀请码：优先取当前 URL 上的 aff（如 /register?aff=xxx），否则回退 localStorage。
function readAffCode() {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('aff');
    if (fromQuery) return fromQuery;
    return localStorage.getItem('aff') || '';
  } catch {
    return '';
  }
}

export function homeLoginUrl(mode = 'login') {
  const params = new URLSearchParams();
  if (mode && mode !== 'login') params.set('mode', mode);
  // 跨域跳转：localStorage 无法跨 origin 传递，邀请码必须随 URL 带到 home-site。
  const aff = readAffCode();
  if (aff) params.set('aff', aff);
  const query = params.toString();
  return query ? `${homeSiteUrl()}/login?${query}` : `${homeSiteUrl()}/login`;
}

export function redirectToHomeLogin(mode = 'login') {
  if (redirecting) return;
  redirecting = true;
  window.location.assign(homeLoginUrl(mode));
}
