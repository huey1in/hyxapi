import React, { useContext, useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Globe2, LockKeyhole, Menu, Monitor, Moon, RotateCw, Sun, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Dashboard from '../Dashboard';
import Pricing from '../Pricing';
import Token from '../Token';
import Log from '../Log';
import SiderBar from '../../components/layout/SiderBar';
import { useSetTheme, useTheme } from '../../context/Theme';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import MarkdownRenderer from '../../components/common/markdown/MarkdownRenderer';
import { API, showError, updateAPI } from '../../helpers';
import { extractSupportedModelBrands } from './modelBrands';

const MODEL_ICON_CDN = 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/light';

const ICON_SLUGS = {
  openai: 'openai', claude: 'claude', gemini: 'gemini', deepseek: 'deepseek',
  xai: 'xai', mistral: 'mistral', qwen: 'qwen', moonshot: 'moonshot',
  zhipu: 'zhipu', meta: 'meta', cohere: 'cohere', doubao: 'doubao',
  anthropic: 'claude-color', google: 'gemini-color', mistralai: 'mistral-color',
};

const iconSource = (icon) => {
  if (/^https?:\/\//i.test(icon || '')) return icon;
  const [name, variant] = String(icon || '').split('.');
  const normalized = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const slug = ICON_SLUGS[normalized] || normalized;
  const colorSuffix = String(variant || '').toLowerCase() === 'color' && !slug.endsWith('-color') ? '-color' : '';
  return `${MODEL_ICON_CDN}/${slug}${colorSuffix}.png`;
};

const ProviderIcon = ({ icon, name }) => (
  <span className='model-provider-image'>
    <img
      src={iconSource(icon)}
      alt=''
      width='44'
      height='44'
      loading='lazy'
      onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.nextElementSibling.hidden = false; }}
    />
    <span hidden>{name?.charAt(0)?.toUpperCase() || '?'}</span>
  </span>
);

const BrowserAddress = ({ children }) => (
  <span className='mac-window-address'>
    <LockKeyhole size={10} strokeWidth={2} aria-hidden='true' />
    <span>{children}</span>
    <RotateCw size={10} strokeWidth={2} aria-hidden='true' />
  </span>
);

const modelProviders = [
  { name: 'OpenAI', icon: 'OpenAI' },
  { name: 'Anthropic', icon: 'Claude.Color' },
  { name: 'Google', icon: 'Gemini.Color' },
  { name: 'DeepSeek', icon: 'DeepSeek.Color' },
  { name: 'xAI', icon: 'XAI' },
  { name: 'Mistral AI', icon: 'Mistral.Color' },
];

const moveModelSpotlight = (event) => {
  event.currentTarget.querySelectorAll('.model-card').forEach((card) => {
    const icon = card.querySelector('.model-icon-stack');
    const rect = icon.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
    card.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
    card.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
    card.style.setProperty('--spot-opacity', inside ? '1' : '0');
  });
};

const hideModelSpotlight = (event) => {
  event.currentTarget.querySelectorAll('.model-card').forEach((card) => {
    card.style.setProperty('--spot-opacity', '0');
  });
};

const Home = () => {
  const navigate = useNavigate();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [supportedBrands, setSupportedBrands] = useState(modelProviders);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [legal, setLegal] = useState(null);
  const brandSectionRef = useRef(null);
  const languageRef = useRef(null);
  const { i18n } = useTranslation();
  const theme = useTheme();
  const setTheme = useSetTheme();
  const currentLanguage = i18n.language?.startsWith('zh') ? 'zh-CN' : 'en';
  const en = currentLanguage === 'en';
  const isLoggedIn = Boolean(userState?.user);
  const status = statusState?.status || {};
  const agreementEnabled = Boolean(status.user_agreement_enabled);
  const privacyEnabled = Boolean(status.privacy_policy_enabled);

  const openLegal = async (type) => {
    const endpoint = type === 'terms' ? '/api/user-agreement' : '/api/privacy-policy';
    setLegal({ type, content: '', loading: true });
    try {
      const response = await API.get(endpoint);
      setLegal({ type, content: response?.data?.data || '', loading: false });
    } catch (error) {
      setLegal(null);
      showError(error);
    }
  };

  const logout = async () => {
    try {
      await API.get('/api/user/logout');
    } catch (error) {
      showError(error);
    }
    localStorage.removeItem('user');
    updateAPI();
    userDispatch?.({ type: 'logout' });
    setMenuOpen(false);
    navigate('/');
  };

  const switchLanguage = (language) => {
    i18n.changeLanguage(language);
    try { localStorage.setItem('i18nextLng', language); } catch {}
    setLanguageOpen(false);
  };

  useEffect(() => {
    let active = true;
    API.get('/api/pricing').then((response) => {
      const payload = response?.data;
      if (!active || !payload?.success) return;
      const brands = extractSupportedModelBrands(payload.data, payload.vendors);
      if (brands.length > 0) setSupportedBrands(brands);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const closeLanguageMenu = (event) => {
      if (!languageRef.current?.contains(event.target)) setLanguageOpen(false);
    };
    document.addEventListener('mousedown', closeLanguageMenu);
    return () => document.removeEventListener('mousedown', closeLanguageMenu);
  }, []);

  useEffect(() => {
    const section = brandSectionRef.current;
    if (!section || typeof ResizeObserver === 'undefined') return undefined;
    const updateScale = () => {
      const scale = section.clientWidth / 1210;
      section.style.setProperty('--brand-scale', String(scale));
      section.style.setProperty('--brand-pad', `${24 * scale}px`);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <div className='home-page studio-home cursor-home'>
      <header className='home-nav'>
        <Link to='/' className='home-brand'>Routify</Link>
        <nav className={`home-nav-links${menuOpen ? ' is-open' : ''}`}>
          <Link to='/console'>{en ? 'Console' : '控制台'}</Link>
          {isLoggedIn ? (
            <button type='button' className='home-nav-start' onClick={logout}>
              {en ? 'Sign out' : '退出登录'}
            </button>
          ) : (
            <>
              <Link to='/auth?mode=login'>{en ? 'Sign in' : '登录'}</Link>
              <Link className='home-nav-start' to='/auth?mode=register'>{en ? 'Create account' : '创建账户'}</Link>
            </>
          )}
        </nav>
        <button className='home-menu-button' onClick={() => setMenuOpen(!menuOpen)} aria-label='切换菜单'>
          {menuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
      </header>

      <main>
        <section className='studio-hero'>
          <div className='studio-hero-copy'>
            <h1>{en ? 'Routify is the unified model gateway for AI applications.' : 'Routify 是面向 AI 应用的统一模型网关。'}</h1>
            <div className='studio-actions'>
              <Link to='/auth?mode=register'>{en ? 'Get started with Routify' : '开始使用 Routify'} <ArrowRight size={16} /></Link>
            </div>
          </div>
          <div className='hero-side-note'><span>OPENAI COMPATIBLE</span><code>https://api.routify.dev/v1</code></div>
        </section>

        <section id='inside' className='product-frame' aria-label='Routify 控制台预览'>
          <div className='product-frame-bar'>
            <div className='mac-window-controls' aria-hidden='true'><i /><i /><i /></div>
            <BrowserAddress>routifyapi.com/console</BrowserAddress>
            <span aria-hidden='true' />
          </div>
          <div className='product-shell'>
            <SiderBar preview />
            <div className='dashboard-preview-content'><Dashboard preview /></div>
          </div>
        </section>

        <section className='model-trust'>
          <h2>{en ? 'Works with the models you already use' : '与你正在使用的模型一起工作'}</h2>
          <div className='model-marquee' onPointerMove={moveModelSpotlight} onPointerLeave={hideModelSpotlight}>
            <div className={`model-track${supportedBrands.length < 8 ? ' is-static' : ''}`}>
              {(supportedBrands.length < 8 ? [0] : [0, 1]).map((group) => (
                <div className='model-card-group' key={group} aria-hidden={group === 1 ? 'true' : undefined}>
                  {supportedBrands.map(({ name, icon }) => (
                    <article key={name} className='model-card' aria-label={group === 0 ? name : undefined}>
                      <span className='model-icon-stack'>
                        <span className='model-icon-gray'><ProviderIcon icon={icon} name={name} /></span>
                        <span className='model-icon-color'><ProviderIcon icon={icon} name={name} /></span>
                      </span>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className='marketplace-showcase' aria-labelledby='marketplace-title'>
          <div className='marketplace-showcase-copy'>
            <h2 id='marketplace-title'>{en ? 'More providers, transparent pricing' : '聚合更多渠道，价格公开透明'}</h2>
            <p>{en ? 'Compare every provider for the same model. Choose lower-cost routes with prices below official rates.' : '同一模型接入不同渠道，每项价格清晰可查。灵活选择更低成本的线路，价格低于官方。'}</p>
            <Link to='/console/pricing'>{en ? 'View model pricing' : '查看模型价格'} <ArrowRight size={15} /></Link>
          </div>
          <div className='marketplace-stage' aria-label='Routify 模型广场预览'>
            <div className='marketplace-preview-mat'>
              <div className='product-frame marketplace-frame'>
                <div className='product-frame-bar'>
                  <div className='mac-window-controls' aria-hidden='true'><i /><i /><i /></div>
                  <BrowserAddress>routifyapi.com/console/pricing</BrowserAddress>
                  <span aria-hidden='true' />
                </div>
                <div className='product-shell'>
                  <SiderBar preview previewActive='/console/pricing' />
                  <div className='marketplace-preview-content'><Pricing preview /></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className='feature-showcase-stack'>
        <section className='feature-showcase api-showcase' aria-labelledby='api-showcase-title'>
          <div className='feature-stage feature-stage-right' aria-label='Routify API 页面预览'>
            <div className='feature-preview-mat'>
              <div className='product-frame console-feature-frame api-feature-frame'>
                <div className='product-frame-bar'>
                  <div className='mac-window-controls' aria-hidden='true'><i /><i /><i /></div>
                  <BrowserAddress>routifyapi.com/console/token</BrowserAddress>
                  <span aria-hidden='true' />
                </div>
                <div className='product-shell'>
                  <SiderBar preview previewActive='/console/token' />
                  <div className='console-feature-content'><Token preview /></div>
                </div>
              </div>
            </div>
          </div>
          <div className='feature-showcase-copy'>
            <h2 id='api-showcase-title'>{en ? 'One key for every model' : '一把密钥，接入所有模型'}</h2>
            <p>{en ? 'Create keys by project and manage quotas, groups, and model access from one place.' : '按项目创建 API 密钥，统一设置额度、分组和模型范围，业务代码只保留一个入口。'}</p>
            <Link to='/console/token'>{en ? 'Manage API keys' : '管理 API 密钥'} <ArrowRight size={15} /></Link>
          </div>
        </section>

        <section className='feature-showcase log-showcase' aria-labelledby='log-showcase-title'>
          <div className='feature-showcase-copy'>
            <h2 id='log-showcase-title'>{en ? 'Every request, fully traceable' : '每一次调用，都有迹可循'}</h2>
            <p>{en ? 'Track model, provider, tokens, latency, and actual cost in one complete request log.' : '模型、渠道、Token、延迟和实际成本逐条记录，问题定位与费用核对都回到同一份日志。'}</p>
            <Link to='/console/log'>{en ? 'View request logs' : '查看调用日志'} <ArrowRight size={15} /></Link>
          </div>
          <div className='feature-stage feature-stage-left' aria-label='Routify 日志页面预览'>
            <div className='feature-preview-mat'>
              <div className='product-frame console-feature-frame log-feature-frame'>
                <div className='product-frame-bar'>
                  <div className='mac-window-controls' aria-hidden='true'><i /><i /><i /></div>
                  <BrowserAddress>routifyapi.com/console/log</BrowserAddress>
                  <span aria-hidden='true' />
                </div>
                <div className='product-shell'>
                  <SiderBar preview previewActive='/console/log' />
                  <div className='console-feature-content'><Log preview /></div>
                </div>
              </div>
            </div>
          </div>
        </section>
        </div>

        <section className='frontier-section' aria-labelledby='frontier-title'>
          <h2 id='frontier-title'>{en ? 'Always at the frontier' : '始终保持前沿'}</h2>
          <div className='frontier-grid'>
            <article className='frontier-card'>
              <div className='frontier-card-copy'>
                <h3>{en ? 'The latest models, ready when you are' : '最新模型，上线即可使用'}</h3>
                <p>{en ? 'Access new releases from leading providers through the same OpenAI-compatible API.' : '主流厂商发布新模型后，通过同一套 OpenAI 兼容接口即可接入。'}</p>
                <Link to='/pricing'>{en ? 'Explore models' : '查看模型'} <ArrowRight size={14} /></Link>
              </div>
              <div className='frontier-visual frontier-model-menu' aria-hidden='true'>
                <div className='frontier-composer'><span>{en ? 'Choose the best model for this request' : '为这次请求选择最佳模型'}</span><b>Auto</b></div>
                <div className='frontier-model-list'>{['GPT-5.6', 'Claude Opus 5', 'Gemini 3.1 Pro', 'DeepSeek V4'].map((model, index) => <span key={model}><i />{model}{index === 0 && <b>{en ? 'New' : '新'}</b>}</span>)}</div>
              </div>
            </article>
            <article className='frontier-card'>
              <div className='frontier-card-copy'>
                <h3>{en ? 'Every provider, one clear price' : '不同渠道，每一笔价格都清楚'}</h3>
                <p>{en ? 'Compare routes for the same model and use prices below official rates without changing your SDK.' : '同一模型按渠道比较价格，无需更换 SDK，即可使用低于官方的线路。'}</p>
                <Link to='/pricing'>{en ? 'Compare pricing' : '比较价格'} <ArrowRight size={14} /></Link>
              </div>
              <div className='frontier-visual frontier-price-list' aria-hidden='true'>
                <div><span>{en ? 'Provider' : '渠道'}</span><span>{en ? 'Input / 1M' : '输入 / 1M'}</span><span>{en ? 'Status' : '状态'}</span></div>
                <div><strong>Routify A</strong><b>$1.82</b><em>{en ? 'Best price' : '最低价'}</em></div><div><strong>Routify B</strong><b>$2.06</b><em>{en ? 'Available' : '可用'}</em></div><div><strong>{en ? 'Official' : '官方'}</strong><b>$3.00</b><em>{en ? 'Reference' : '参考'}</em></div>
              </div>
            </article>
            <article className='frontier-card'>
              <div className='frontier-card-copy'>
                <h3>{en ? 'Automatic scheduling for every endpoint' : '自动调度，每个端点都无需操心'}</h3>
                <p>{en ? 'Messages and completions requests are both scheduled automatically across available providers.' : 'Messages 与 Completions 端点都会由系统自动调度到可用渠道。'}</p>
                <Link to='/console/log'>{en ? 'View request logs' : '查看调用日志'} <ArrowRight size={14} /></Link>
              </div>
              <div className='frontier-visual frontier-route-flow' aria-hidden='true'>
                <div className='frontier-request'><small>POST</small><span>/v1/messages</span></div><div className='frontier-request frontier-request-secondary'><small>POST</small><span>/v1/chat/completions</span></div><div className='frontier-route-line'><i /><span>{en ? 'Scheduled automatically' : '系统自动调度'}</span><b>38 ms</b></div><div className='frontier-route-line'><i /><span>{en ? 'Provider responded' : '渠道响应成功'}</span><b>200</b></div><div className='frontier-route-total'><span>{en ? 'Requests completed' : '请求均已完成'}</span><strong>1.24 s</strong></div>
              </div>
            </article>
          </div>
        </section>

        <section ref={brandSectionRef} className='studio-closing giant-brand-section' aria-label='Routify'>
          <div className='giant-brand-word'>Rout<span>ify</span></div>
        </section>
      </main>

      <footer className='site-footer'>
        <div className='site-footer-links'>
          <div><span>{en ? 'Product' : '产品'}</span><Link to='/pricing'>{en ? 'Model marketplace' : '模型广场'}</Link><Link to='/console'>{en ? 'Console' : '控制台'}</Link><Link to='/console/token'>API {en ? 'keys' : '密钥'}</Link><Link to='/console/log'>{en ? 'Request logs' : '调用日志'}</Link></div>
          <div><span>{en ? 'Contact' : '联系'}</span><a href='https://github.com/huey1in' target='_blank' rel='noopener noreferrer'>GitHub</a><a href='mailto:1in@yxh.me'>{en ? 'Email' : '邮箱'}</a></div>
          <div><span>{en ? 'Legal' : '法律'}</span>{agreementEnabled ? <button type='button' onClick={() => openLegal('terms')}>{en ? 'Terms of Service' : '服务条款'}</button> : <span className='footer-link-disabled'>{en ? 'Terms of Service' : '服务条款'}</span>}{privacyEnabled ? <button type='button' onClick={() => openLegal('privacy')}>{en ? 'Privacy Policy' : '隐私政策'}</button> : <span className='footer-link-disabled'>{en ? 'Privacy Policy' : '隐私政策'}</span>}</div>
        </div>
        <div className='site-footer-bottom'>
          <span className='footer-copyright'>© 2026 Routify</span>
          <span className='footer-status'>{en ? 'Compute services provided by ' : '计算服务由'}<a href='https://www.xunduyun.com/' target='_blank' rel='noopener noreferrer'>{en ? 'Xunduyun' : '迅度云'}</a>{en ? '' : '提供'}</span>
          <div className='footer-controls'>
            <div className='footer-theme-switch' aria-label='主题'>
              <button className={theme === 'auto' ? 'is-active' : ''} onClick={() => setTheme('auto')} title='跟随系统' aria-label='跟随系统主题'><Monitor size={14} /></button>
              <button className={theme === 'light' ? 'is-active' : ''} onClick={() => setTheme('light')} title='亮色' aria-label='使用亮色主题'><Sun size={14} /></button>
              <button className={theme === 'dark' ? 'is-active' : ''} onClick={() => setTheme('dark')} title='暗色' aria-label='使用暗色主题'><Moon size={14} /></button>
            </div>
            <div className='footer-language-wrap' ref={languageRef}>
              <button className='footer-language' onClick={() => setLanguageOpen((open) => !open)} aria-expanded={languageOpen} aria-haspopup='menu'>
                <Globe2 size={14} /><span>{currentLanguage === 'zh-CN' ? '简体中文' : 'English'}</span><ChevronDown size={13} />
              </button>
              {languageOpen && <div className='footer-language-menu' role='menu'>
                <button className={currentLanguage === 'zh-CN' ? 'is-active' : ''} onClick={() => switchLanguage('zh-CN')} role='menuitem'>简体中文</button>
                <button className={currentLanguage === 'en' ? 'is-active' : ''} onClick={() => switchLanguage('en')} role='menuitem'>English</button>
              </div>}
            </div>
          </div>
        </div>
      </footer>
      {legal && <div className='cursor-auth-legal-overlay' role='presentation' onMouseDown={() => setLegal(null)}>
        <section className='cursor-auth-legal-dialog' role='dialog' aria-modal='true' aria-labelledby='home-legal-title' onMouseDown={(event) => event.stopPropagation()}>
          <header><h2 id='home-legal-title'>{legal.type === 'terms' ? (en ? 'Terms of Service' : '服务条款') : (en ? 'Privacy Policy' : '隐私政策')}</h2><button type='button' onClick={() => setLegal(null)} aria-label={en ? 'Close' : '关闭'}>×</button></header>
          <div className='cursor-auth-legal-content'>{legal.loading ? (en ? 'Loading...' : '加载中...') : <MarkdownRenderer content={legal.content} />}</div>
        </section>
      </div>}
    </div>
  );
};

export default Home;
