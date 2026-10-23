const PAGE_TITLES: Record<string, string> = {
  '/tickets': 'Support tickets',
  '/console/tickets': 'Ticket management',
  '/': 'Home',
  '/setup': 'System initialization',
  '/user/reset': 'Reset password',
  '/forbidden': 'Access denied',
  '/pricing': 'Models',
  '/console': '概览',
  '/console/channel': '渠道管理',
  '/console/models': '模型管理',
  '/console/vendors': '供应商管理',
  '/token': 'API',
  '/log': '日志',
  '/console/task': '日志',
  '/console/midjourney': '日志',
  '/console/user': '用户管理',
  '/console/operations': 'Operations report',
  '/console/audit': '审计日志',
  '/console/system-status': '系统状态',
  '/console/redemption': '兑换码管理',
  '/console/subscription': '订阅管理',
  '/topup': '充值',
  '/subscription': '订阅',
  '/console/setting': '系统设置',
  '/personal': '设置',
  '/notices': '通知',
};

// Null delegates to pages whose titles depend on their own content or state.
export function pageTitleKey(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (['/auth', '/user-agreement', '/privacy-policy'].includes(path) || /^\/(?:console\/)?pricing\/model\//.test(pathname)) return null;
  if (path.startsWith('/oauth/')) return 'Sign in';
  return PAGE_TITLES[path] ?? '';
}
