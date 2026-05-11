/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Copy, Check } from 'lucide-react';
import { API, showError, copy, showSuccess } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { StatusContext } from '../../context/Status';
import { useActualTheme } from '../../context/Theme';
import { UserContext } from '../../context/User';
import { Button, IconButton, Card } from '../../components/ui';
import { useLoginModal } from '../../context/LoginModal';
/* NoticeModal 暂未迁移；用一个不渲染任何内容的占位 */
const NoticeModal = () => null;

const SnakeCanvas = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const ROWS = 7;
    const CELL = 14;
    const GAP = 3;
    const STEP_MS = 90;
    const MAX_SNAKE = 9;

    let animId;
    let lastTime = 0;
    let cols = 0;
    let cells = [];
    let snake = [];
    let target = null;

    const readVar = (name) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    const getColors = () => {
      const isDark = document.documentElement.classList.contains('dark');
      return {
        empty: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
        cell: readVar('--ui-brand') || '#3b82f6',
        snake: readVar('--ui-text') || (isDark ? '#fafafa' : '#18181b'),
      };
    };

    const roundRect = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      cols = Math.floor((rect.width - GAP) / (CELL + GAP));
    };

    const seedCells = () => {
      cells = [];
      for (let c = 0; c < cols; c++) {
        cells[c] = [];
        for (let r = 0; r < ROWS; r++) {
          const v = Math.random();
          cells[c][r] = v < 0.45 ? 0 : v < 0.7 ? 1 : v < 0.86 ? 2 : v < 0.95 ? 3 : 4;
        }
      }
    };

    const findTarget = () => {
      const head = snake[0];
      let best = null;
      let bestDist = Infinity;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < ROWS; r++) {
          if (cells[c][r] > 0) {
            const d = Math.abs(c - head.c) + Math.abs(r - head.r);
            if (d < bestDist) {
              bestDist = d;
              best = { c, r };
            }
          }
        }
      }
      return best;
    };

    const reset = () => {
      seedCells();
      snake = [{ c: 0, r: 3 }];
      target = findTarget();
    };

    const step = () => {
      if (!target || cells[target.c][target.r] === 0) {
        target = findTarget();
        if (!target) {
          reset();
          return;
        }
      }
      const head = snake[0];
      let dc = 0;
      let dr = 0;
      if (head.c !== target.c) dc = head.c < target.c ? 1 : -1;
      else if (head.r !== target.r) dr = head.r < target.r ? 1 : -1;
      const newHead = { c: head.c + dc, r: head.r + dr };

      const eating =
        cells[newHead.c] !== undefined && cells[newHead.c][newHead.r] > 0;
      snake.unshift(newHead);
      if (eating) {
        cells[newHead.c][newHead.r] = 0;
        if (snake.length > MAX_SNAKE) snake.pop();
      } else {
        snake.pop();
      }
    };

    const hexToRgb = (hex) => {
      const m = hex.replace('#', '');
      const v = m.length === 3
        ? m.split('').map((c) => c + c).join('')
        : m;
      const n = parseInt(v, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const colors = getColors();
      const [br, bg, bb] = hexToRgb(colors.cell.startsWith('#') ? colors.cell : '#3b82f6');

      const totalW = cols * (CELL + GAP) - GAP;
      const totalH = ROWS * (CELL + GAP) - GAP;
      const offsetX = (rect.width - totalW) / 2;
      const offsetY = (rect.height - totalH) / 2;

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < ROWS; r++) {
          const x = offsetX + c * (CELL + GAP);
          const y = offsetY + r * (CELL + GAP);
          const v = cells[c][r];
          if (v === 0) {
            ctx.fillStyle = colors.empty;
          } else {
            const op = 0.18 + v * 0.18;
            ctx.fillStyle = `rgba(${br},${bg},${bb},${op})`;
          }
          roundRect(x, y, CELL, CELL, 3);
        }
      }

      snake.forEach((seg, i) => {
        const x = offsetX + seg.c * (CELL + GAP);
        const y = offsetY + seg.r * (CELL + GAP);
        const headFade = 1 - (i / snake.length) * 0.5;
        ctx.fillStyle = colors.snake;
        ctx.globalAlpha = headFade;
        roundRect(x, y, CELL, CELL, 3);
      });
      ctx.globalAlpha = 1;
    };

    const loop = (time) => {
      if (time - lastTime > STEP_MS) {
        step();
        lastTime = time;
      }
      draw();
      animId = requestAnimationFrame(loop);
    };

    const onResize = () => {
      resize();
      reset();
    };

    resize();
    reset();
    animId = requestAnimationFrame(loop);
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className='block w-full h-full' />;
};

const buildSnippet = (proto, base) => {
  if (proto === 'OpenAI') {
    return [
      ['$ ', 'p'], ['curl ', 'c'], [`${base}/v1/chat/completions \\\n`, 'u'],
      ['  -H ', 'f'], ['"Authorization: Bearer $TOKEN" \\\n', 's'],
      ['  -d ', 'f'], ['\'{\n', 's'],
      ['    "model": ', 'k'], ['"gpt-4o",\n', 's'],
      ['    "messages": [{"role":', 'k'], ['"user"', 's'], [', "content":', 'k'], ['"Hello!"}]\n', 's'],
      ['  }\'', 's'],
    ];
  }
  return [
    ['$ ', 'p'], ['curl ', 'c'], [`${base}/v1/messages \\\n`, 'u'],
    ['  -H ', 'f'], ['"x-api-key: $TOKEN" \\\n', 's'],
    ['  -H ', 'f'], ['"anthropic-version: 2023-06-01" \\\n', 's'],
    ['  -d ', 'f'], ['\'{\n', 's'],
    ['    "model": ', 'k'], ['"claude-sonnet-4",\n', 's'],
    ['    "max_tokens": ', 'k'], ['1024,\n', 's'],
    ['    "messages": [{"role":', 'k'], ['"user"', 's'], [', "content":', 'k'], ['"Hello!"}]\n', 's'],
    ['  }\'', 's'],
  ];
};

const TOKEN_COLOR = {
  p: 'rgba(255,255,255,0.35)',
  c: '#7dd3fc',
  u: 'rgba(255,255,255,0.7)',
  f: '#facc15',
  s: '#fde68a',
  k: 'rgba(255,255,255,0.55)',
};

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const [userState] = useContext(UserContext);
  const { openLoginModal } = useLoginModal();
  const navigate = useNavigate();
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
  const docsLink = statusState?.status?.docs_link || '';
  const docsEnabled = useMemo(() => {
    const cfg = statusState?.status?.HeaderNavModules;
    if (!cfg) return true;
    try {
      const modules = JSON.parse(cfg);
      if (typeof modules.docs === 'boolean') return modules.docs;
      if (modules.docs && typeof modules.docs === 'object') {
        return modules.docs.enabled !== false;
      }
      return true;
    } catch {
      return true;
    }
  }, [statusState?.status?.HeaderNavModules]);
  const showDocs = !!docsLink && docsEnabled;
  const serverAddress =
    statusState?.status?.server_address || `${window.location.origin}`;

  const [tab, setTab] = useState('OpenAI');
  const [copied, setCopied] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [modelCount, setModelCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await API.get('/api/pricing');
        if (data?.success) {
          setVendors((data.vendors || []).map((v) => v.name).filter(Boolean));
          setModelCount((data.data || []).length);
        }
      } catch {
        // 静默失败，用兜底数据
      }
    })();
  }, []);

  // 动态生成第 1 步登录方式说明
  const status = statusState?.status || {};
  const oauthLabels = useMemo(() => {
    const out = [];
    if (status.github_oauth) out.push('GitHub');
    if (status.discord_oauth) out.push('Discord');
    if (status.linuxdo_oauth) out.push('LinuxDO');
    if (status.wechat_login) out.push(t('微信'));
    if (status.oidc_enabled) out.push('OIDC');
    if (status.telegram_oauth) out.push('Telegram');
    return out;
  }, [
    status.github_oauth, status.discord_oauth, status.linuxdo_oauth,
    status.wechat_login, status.oidc_enabled, status.telegram_oauth, t,
  ]);
  const registerDesc = useMemo(() => {
    if (oauthLabels.length === 0) return t('邮箱注册账号，即刻开始使用。');
    return t('使用 {{providers}} 一键登录，即刻开始使用。').replace(
      '{{providers}}',
      oauthLabels.join(' / '),
    );
  }, [oauthLabels, t]);

  const displayHomePageContent = async () => {
    setHomePageContent(localStorage.getItem('home_page_content') || '');
    const res = await API.get('/api/home_page_content');
    const { success, message, data } = res.data;
    if (success) {
      let content = data;
      if (!data.startsWith('https://')) content = marked.parse(data);
      setHomePageContent(content);
      localStorage.setItem('home_page_content', content);
      if (data.startsWith('https://')) {
        const iframe = document.querySelector('iframe');
        if (iframe) {
          iframe.onload = () => {
            iframe.contentWindow.postMessage({ themeMode: actualTheme }, '*');
            iframe.contentWindow.postMessage({ lang: i18n.language }, '*');
          };
        }
      }
    } else {
      showError(message);
      setHomePageContent(t('加载首页内容失败...'));
    }
    setHomePageContentLoaded(true);
  };

  const handleStart = () => {
    const hasUser = !!userState?.user || !!localStorage.getItem('user');
    if (hasUser) navigate('/console');
    else openLoginModal('login');
  };

  const snippet = buildSnippet(tab, serverAddress);
  const snippetText = snippet.map((p) => p[0]).join('');

  const handleCopySnippet = async () => {
    const ok = await copy(snippetText);
    if (ok) {
      setCopied(true);
      showSuccess(t('已复制到剪切板'));
      setTimeout(() => setCopied(false), 1800);
    }
  };

  useEffect(() => {
    const checkNoticeAndShow = async () => {
      const lastCloseDate = localStorage.getItem('notice_close_date');
      const today = new Date().toDateString();
      if (lastCloseDate !== today) {
        try {
          const res = await API.get('/api/notice');
          const { success, data } = res.data;
          if (success && data && data.trim() !== '') setNoticeVisible(true);
        } catch (error) {
          console.error('获取公告失败:', error);
        }
      }
    };
    checkNoticeAndShow();
  }, []);

  useEffect(() => {
    displayHomePageContent();
  }, []);

  const hasCustomContent = homePageContentLoaded && homePageContent !== '';

  const heading = { letterSpacing: '-0.025em' };

  return (
    <div className='w-full overflow-x-hidden bg-[#f8f8f6] dark:bg-[#1a1a18]'>
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />

      {hasCustomContent ? (
        <div className='overflow-x-hidden w-full'>
          {homePageContent.startsWith('https://') ? (
            <iframe src={homePageContent} className='w-full h-screen border-none' />
          ) : (
            <div className='mt-[60px]' dangerouslySetInnerHTML={{ __html: homePageContent }} />
          )}
        </div>
      ) : (
        <>
          {/* ─── Hero ─── */}
          <section className='relative overflow-hidden border-b border-ui-border flex items-center' style={{ minHeight: 'calc(100vh - var(--header-height))' }}>
            <div
              className='absolute inset-0 -z-10 opacity-40'
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, var(--ui-border) 1px, transparent 0)',
                backgroundSize: '24px 24px',
                maskImage:
                  'radial-gradient(ellipse 100% 80% at 0% 0%, black 20%, transparent 80%)',
                WebkitMaskImage:
                  'radial-gradient(ellipse 100% 80% at 0% 0%, black 20%, transparent 80%)',
              }}
            />
            <div
              className='absolute -z-10 -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-10 blur-3xl pointer-events-none'
              style={{ background: 'var(--ui-brand)' }}
            />

            <div className='max-w-6xl mx-auto px-6 py-16 md:py-20 w-full'>
              <div className='grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center'>
                {/* Left content */}
                <div>
                  <p className='font-mono text-sm text-ui-text-3 mb-6 tracking-wide'>
                    // less plumbing, more product
                  </p>

                  <h1
                    className='text-5xl md:text-6xl lg:text-7xl font-bold text-ui-text leading-[1.05] mb-6 tracking-tight'
                    style={heading}
                  >
                    {t('build')} {t('something')}<br />
                    <span style={{ color: 'var(--ui-brand)' }}>{t('great!')}</span>
                  </h1>

                  <p className='text-lg md:text-xl text-ui-text-2 max-w-xl mb-10 leading-relaxed'>
                    {t('兼容 OpenAI / Claude / Gemini 等协议，智能路由，统一计费。')}
                  </p>

                  <div className='flex flex-wrap items-center gap-3'>
                    <Button size='lg' onClick={handleStart}>
                      {t('免费开始')} →
                    </Button>
                    {showDocs && (
                      <a href={docsLink} target='_blank' rel='noopener noreferrer'>
                        <Button size='lg' variant='secondary'>
                          {t('查看文档')} →
                        </Button>
                      </a>
                    )}
                  </div>
                </div>

                {/* Right code preview */}
                <div className='relative hidden md:block'>
                  <div className='rounded-2xl overflow-hidden border border-ui-border bg-[#0a0a0a] shadow-2xl'>
                    <div className='flex items-center justify-between px-4 py-2.5 border-b' style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <div className='flex items-center gap-1'>
                        {['OpenAI', 'Claude'].map((proto) => (
                          <Button
                            key={proto}
                            variant='tab'
                            selected={tab === proto}
                            size='sm'
                            onClick={() => setTab(proto)}
                            className='font-mono'
                          >
                            {proto}
                          </Button>
                        ))}
                      </div>
                      <IconButton
                        icon={copied ? Check : Copy}
                        size='sm'
                        tone={copied ? 'green' : 'default'}
                        onClick={handleCopySnippet}
                        title={copied ? 'Copied' : 'Copy'}
                      />
                    </div>
                    <pre className='font-mono text-[12.5px] leading-relaxed p-5 overflow-x-auto'>
                      <code>
                        {snippet.map(([text, kind], i) => (
                          <span key={i} style={{ color: TOKEN_COLOR[kind] }}>{text}</span>
                        ))}
                      </code>
                    </pre>
                    <div className='px-5 py-2.5 border-t font-mono text-[11px]' style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                      <span style={{ color: '#4ade80' }}>200 OK</span>
                      <span className='mx-2'>·</span>
                      <span>latency 312ms</span>
                      <span className='mx-2'>·</span>
                      <span>tokens 42</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ─── Trust / Providers strip ─── */}
          <section className='border-b border-ui-border py-14 md:py-16'>
            <div className='max-w-6xl mx-auto px-6'>
              <p className='font-mono text-xs text-ui-text-3 tracking-widest uppercase mb-6 text-center'>
                {t('支持主流模型提供商')}
              </p>
              <div className='flex flex-wrap items-center justify-center gap-x-10 md:gap-x-14 gap-y-4'>
                {(vendors.length > 0
                  ? vendors
                  : ['OpenAI', 'Anthropic', 'Google', 'DeepSeek', 'Mistral', 'Cohere', 'Meta', 'xAI', 'Qwen', 'Moonshot']
                ).slice(0, 12).map((name) => (
                  <span
                    key={name}
                    className='text-base md:text-lg font-semibold text-ui-text-2 hover:text-ui-text transition-colors'
                    style={heading}
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Features ─── */}
          <section className='px-6 py-24 md:py-32 border-b border-ui-border'>
            <div className='max-w-6xl mx-auto'>
              <div className='mb-14 md:mb-20 max-w-3xl'>
                <p className='font-mono text-xs text-ui-text-3 tracking-widest uppercase mb-3'>
                  // {t('为什么选择我们')}
                </p>
                <h2 className='text-4xl md:text-5xl font-bold text-ui-text leading-tight tracking-tight' style={heading}>
                  {t('企业级')}<span style={{ color: 'var(--ui-brand)' }}> AI </span>{t('网关')}
                </h2>
                <p className='mt-5 text-lg text-ui-text-2 leading-relaxed'>
                  {t('一个 API，兼容所有顶级大模型。智能路由、统一计费、毫秒级响应。')}
                </p>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-3 gap-px bg-ui-border rounded-3xl overflow-hidden border border-ui-border'>
                {[
                  {
                    num: '01',
                    title: t('智能路由'),
                    desc: t('自动选择最优渠道，按延迟、成功率与价格动态调度。'),
                  },
                  {
                    num: '02',
                    title: t('统一计费'),
                    desc: t('多账户、多渠道汇总记账，按实际 token 透明结算。'),
                  },
                  {
                    num: '03',
                    title: t('协议兼容'),
                    desc: t('完全兼容 OpenAI / Anthropic 等原生 SDK，零迁移成本。'),
                  },
                ].map((f) => (
                  <div
                    key={f.num}
                    className='bg-ui-bg-elevated p-8 md:p-10 hover:bg-ui-bg-subtle/50 transition-colors'
                  >
                    <span className='font-mono text-xs text-ui-text-3 tracking-widest'>{f.num}</span>
                    <h3 className='mt-6 text-2xl font-bold text-ui-text mb-3 tracking-tight' style={heading}>
                      {f.title}
                    </h3>
                    <p className='text-[15px] text-ui-text-2 leading-relaxed'>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── How it works ─── */}
          <section className='px-6 py-24 md:py-32 border-b border-ui-border'>
            <div className='max-w-6xl mx-auto'>
              <div className='mb-14 md:mb-20 max-w-3xl'>
                <p className='font-mono text-xs text-ui-text-3 tracking-widest uppercase mb-3'>
                  // how it works
                </p>
                <h2 className='text-4xl md:text-5xl font-bold text-ui-text leading-tight tracking-tight' style={heading}>
                  {t('三步接入，分钟级上线')}
                </h2>
              </div>
              <Card variant='elevated' radius='xl' padding='none'>
                {[
                  { num: '01', title: t('注册账号'), desc: registerDesc, to: '/register' },
                  { num: '02', title: t('创建 API Key'), desc: t('在控制台创建密钥，支持多 Key 管理与权限控制。'), to: '/console/token' },
                  { num: '03', title: t('发起请求'), desc: t('使用你熟悉的 SDK 调用任意模型，完全兼容原生协议。'), to: docsLink || '/console' },
                ].map((step, idx, arr) => {
                  const isExternal = step.to.startsWith('http');
                  const inner = (
                    <div className='group grid grid-cols-[80px_1fr_auto] md:grid-cols-[140px_1fr_auto] items-center'>
                      <div className='px-5 md:px-10 py-9 border-r border-ui-border'>
                        <span className='font-mono text-3xl md:text-5xl font-bold text-ui-text-3 group-hover:text-ui-brand transition-colors duration-200'>
                          {step.num}
                        </span>
                      </div>
                      <div className='px-5 md:px-10 py-9'>
                        <h3 className='text-base md:text-lg font-semibold text-ui-text mb-1.5'>
                          {step.title}
                        </h3>
                        <p className='text-[15px] text-ui-text-2'>
                          {step.desc}
                        </p>
                      </div>
                      <span className='pr-5 md:pr-10 font-mono text-2xl text-ui-text-3 group-hover:text-ui-brand group-hover:translate-x-1 transition-all duration-200'>
                        →
                      </span>
                    </div>
                  );
                  const className = `block hover:bg-ui-bg-subtle transition-colors duration-150 ${idx !== arr.length - 1 ? 'border-b border-ui-border' : ''}`;
                  return isExternal ? (
                    <a key={step.num} href={step.to} target='_blank' rel='noopener noreferrer' className={className}>
                      {inner}
                    </a>
                  ) : (
                    <Link key={step.num} to={step.to} className={className}>
                      {inner}
                    </Link>
                  );
                })}
              </Card>
            </div>
          </section>

          {/* ─── Stats ─── */}
          <section className='px-6 py-24 md:py-32 border-b border-ui-border'>
            <div className='max-w-6xl mx-auto'>
              <div className='grid grid-cols-2 md:grid-cols-4 gap-px bg-ui-border rounded-3xl overflow-hidden border border-ui-border'>
                {[
                  { value: modelCount > 0 ? `${modelCount}+` : '50+', label: t('支持模型') },
                  { value: '99.9%', label: t('稳定性') },
                  { value: '<100ms', label: t('平均延迟') },
                  { value: '100K+', label: t('每秒请求') },
                ].map((s, i) => (
                  <div
                    key={i}
                    className='bg-ui-bg-elevated px-6 py-10 md:py-12 text-center md:text-left'
                  >
                    <div
                      className='text-4xl md:text-5xl font-bold text-ui-text leading-none tracking-tight tabular-nums'
                      style={heading}
                    >
                      {s.value}
                    </div>
                    <p className='mt-3 text-sm text-ui-text-3 uppercase tracking-widest font-mono'>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Final CTA ─── */}
          <section className='px-6 py-24 md:py-32'>
            <div className='max-w-6xl mx-auto'>
              <div
                className='relative overflow-hidden rounded-3xl border border-ui-border p-10 md:p-20'
                style={{ backgroundColor: 'var(--ui-bg-elevated)' }}
              >
                {/* 装饰背景 */}
                <div
                  className='absolute -top-24 -right-24 w-[400px] h-[400px] rounded-full opacity-[0.07] blur-3xl pointer-events-none'
                  style={{ background: 'var(--ui-brand)' }}
                />
                <div
                  className='absolute inset-0 -z-10 opacity-30 pointer-events-none'
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 1px 1px, var(--ui-border) 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                    maskImage: 'radial-gradient(ellipse 60% 80% at 100% 0%, black 0%, transparent 70%)',
                    WebkitMaskImage: 'radial-gradient(ellipse 60% 80% at 100% 0%, black 0%, transparent 70%)',
                  }}
                />
                <p className='font-mono text-xs text-ui-text-3 tracking-widest uppercase mb-4'>
                  // {t('准备好开始了吗')}
                </p>
                <h2
                  className='text-4xl md:text-6xl font-bold text-ui-text leading-[1.05] tracking-tight max-w-3xl mb-6'
                  style={heading}
                >
                  {t('让每个 token 都有去处')}
                </h2>
                <p className='text-lg text-ui-text-2 max-w-xl mb-10 leading-relaxed'>
                  {t('免费注册，分钟级接入。兼容你现有的 SDK 和工作流。')}
                </p>
                <div className='flex flex-wrap items-center gap-3'>
                  <Button size='lg' onClick={handleStart}>
                    {t('免费开始')} →
                  </Button>
                  {showDocs && (
                    <a href={docsLink} target='_blank' rel='noopener noreferrer'>
                      <Button size='lg' variant='secondary'>
                        {t('查看文档')} →
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default Home;
