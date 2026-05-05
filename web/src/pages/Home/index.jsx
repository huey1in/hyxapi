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

import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Copy, Check } from 'lucide-react';
import { API, showError, copy, showSuccess } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { StatusContext } from '../../context/Status';
import { useActualTheme } from '../../context/Theme';
import NoticeModal from '../../components/layout/NoticeModal';

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
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
  const docsLink = statusState?.status?.docs_link || '';
  const serverAddress =
    statusState?.status?.server_address || `${window.location.origin}`;

  const [tab, setTab] = useState('OpenAI');
  const [copied, setCopied] = useState(false);

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

  const heading = { fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.025em' };

  return (
    <div className='w-full overflow-x-hidden' style={{ backgroundColor: '#f8f8f6' }}>
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
          <section className='relative overflow-hidden border-b border-ui-border min-h-[calc(100vh-4rem)] flex items-center'>
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
                    className='text-3xl md:text-4xl lg:text-5xl font-bold text-ui-text leading-[1.1] mb-5'
                    style={heading}
                  >
                    build something<br />
                    <span style={{ color: 'var(--ui-brand)' }}>great!</span>
                  </h1>

                  <p className='text-base text-ui-text-2 max-w-xl mb-8 leading-relaxed'>
                    {t('兼容 OpenAI / Claude / Gemini 等协议，智能路由，统一计费。')}
                  </p>

                  <div className='flex flex-wrap items-center gap-3'>
                    <Link to='/console'>
                      <button className='inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover hover:shadow-md active:scale-95 transition-all duration-200'>
                        {t('免费开始')} →
                      </button>
                    </Link>
                    {docsLink && (
                      <a href={docsLink} target='_blank' rel='noopener noreferrer'>
                        <button className='inline-flex items-center px-5 py-2.5 text-sm font-medium rounded-lg border border-ui-border text-ui-text bg-ui-bg-elevated hover:bg-ui-bg-subtle active:scale-95 transition-all duration-200'>
                          {t('查看文档')} →
                        </button>
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
                          <button
                            key={proto}
                            onClick={() => setTab(proto)}
                            className='font-mono text-xs px-2.5 py-1.5 rounded-md transition-colors'
                            style={
                              tab === proto
                                ? { background: 'rgba(255,255,255,0.1)', color: '#fff' }
                                : { color: 'rgba(255,255,255,0.4)' }
                            }
                            onMouseEnter={(e) => { if (tab !== proto) e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                            onMouseLeave={(e) => { if (tab !== proto) e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
                          >
                            {proto}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={handleCopySnippet}
                        className='flex items-center gap-1.5 font-mono text-xs px-2.5 py-1.5 rounded-md transition-colors'
                        style={{ color: copied ? '#4ade80' : 'rgba(255,255,255,0.5)' }}
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
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

          {/* ─── How it works ─── */}
          <section className='px-6 py-20 border-b border-ui-border'>
            <div className='max-w-5xl mx-auto'>
              <div className='mb-12'>
                <p className='font-mono text-xs text-ui-text-3 tracking-widest uppercase mb-3'>
                  // how it works
                </p>
                <h2 className='text-2xl md:text-3xl font-bold text-ui-text' style={heading}>
                  {t('三步接入，分钟级上线')}
                </h2>
              </div>
              <div className='border border-ui-border rounded-2xl overflow-hidden bg-ui-bg-elevated'>
                {[
                  { num: '01', title: t('注册账号'), desc: t('邮箱或 GitHub / Discord 等账号一键登录，即刻开始使用。'), to: '/register' },
                  { num: '02', title: t('创建 API Key'), desc: t('在控制台创建密钥，支持多 Key 管理与权限控制。'), to: '/console/token' },
                  { num: '03', title: t('发起请求'), desc: t('使用你熟悉的 SDK 调用任意模型，完全兼容原生协议。'), to: docsLink || '/console' },
                ].map((step, idx, arr) => {
                  const isExternal = step.to.startsWith('http');
                  const inner = (
                    <div className='group grid grid-cols-[80px_1fr_auto] md:grid-cols-[120px_1fr_auto] items-center'>
                      <div className='px-5 md:px-8 py-7 border-r border-ui-border'>
                        <span className='font-mono text-3xl md:text-5xl font-bold text-ui-text-3 group-hover:text-ui-brand transition-colors duration-200'>
                          {step.num}
                        </span>
                      </div>
                      <div className='px-5 md:px-8 py-7'>
                        <h3 className='text-sm md:text-base font-semibold text-ui-text mb-1'>
                          {step.title}
                        </h3>
                        <p className='text-sm text-ui-text-2'>
                          {step.desc}
                        </p>
                      </div>
                      <span className='pr-5 md:pr-8 font-mono text-xl text-ui-text-3 group-hover:text-ui-brand group-hover:translate-x-1 transition-all duration-200'>
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
              </div>
            </div>
          </section>

          {/* ─── Final visual ─── */}
          <section className='px-6 py-20 bg-ui-bg'>
            <div className='max-w-5xl mx-auto'>
              <div className='mb-10 text-center'>
                <p className='font-mono text-xs text-ui-text-3 tracking-widest uppercase mb-3'>
                  // build with us
                </p>
                <h2 className='text-2xl md:text-3xl font-bold text-ui-text' style={heading}>
                  {t('让每个 token 都有去处')}
                </h2>
              </div>
              <div className='rounded-2xl border border-ui-border bg-ui-bg-elevated p-6 md:p-10' style={{ height: 280 }}>
                <SnakeCanvas />
              </div>
              <p className='mt-6 text-center font-mono text-xs tracking-wide text-ui-text-3'>
                {t('免费注册，分钟级接入。兼容你现有的 SDK 和工作流。')}
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default Home;
