import React, { useContext, useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Globe2, Menu, Monitor, Moon, Sun, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Dashboard from '../Dashboard';
import Pricing from '../Pricing';
import Token from '../Token';
import Log from '../Log';
import SiderBar from '../../components/layout/SiderBar';
import { useSetTheme, useTheme } from '../../context/Theme';
import { UserContext } from '../../context/User';
import { API, showError, updateAPI } from '../../helpers';

const MODEL_ICON_CDN = 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/light';

const ProviderIcon = ({ slug }) => (
  <img src={`${MODEL_ICON_CDN}/${slug}.png`} alt='' width='44' height='44' loading='lazy' />
);

const modelProviders = [
  { name: 'OpenAI', slug: 'openai' },
  { name: 'Anthropic', slug: 'claude-color' },
  { name: 'Google', slug: 'gemini-color' },
  { name: 'DeepSeek', slug: 'deepseek-color' },
  { name: 'xAI', slug: 'xai' },
  { name: 'Mistral AI', slug: 'mistral-color' },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const brandSectionRef = useRef(null);
  const languageRef = useRef(null);
  const { i18n } = useTranslation();
  const theme = useTheme();
  const setTheme = useSetTheme();
  const currentLanguage = i18n.language?.startsWith('zh') ? 'zh-CN' : 'en';
  const en = currentLanguage === 'en';
  const isLoggedIn = Boolean(userState?.user);

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
            <span className='mac-window-address'>routifyapi.com</span>
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
            <div className='model-track'>
              {[0, 1].map((group) => (
                <div className='model-card-group' key={group} aria-hidden={group === 1 ? 'true' : undefined}>
                  {modelProviders.map(({ name, slug }) => (
                    <article key={name} className='model-card' aria-label={group === 0 ? name : undefined}>
                      <span className='model-icon-stack'>
                        <span className='model-icon-gray'><ProviderIcon slug={slug} /></span>
                        <span className='model-icon-color'><ProviderIcon slug={slug} /></span>
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
                  <span className='mac-window-address'>routifyapi.com/models</span>
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
                  <span className='mac-window-address'>routifyapi.com/api-keys</span>
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
                  <span className='mac-window-address'>routifyapi.com/logs</span>
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

        <section ref={brandSectionRef} className='studio-closing giant-brand-section' aria-label='Routify'>
          <div className='giant-brand-word'>Rout<span>ify</span></div>
        </section>
      </main>

      <footer className='site-footer'>
        <div className='site-footer-links'>
          <div><span>{en ? 'Product' : '产品'}</span><Link to='/pricing'>{en ? 'Model marketplace' : '模型广场'}</Link><Link to='/console'>{en ? 'Console' : '控制台'}</Link><Link to='/console/token'>API {en ? 'keys' : '密钥'}</Link><Link to='/console/log'>{en ? 'Request logs' : '调用日志'}</Link><Link to='/console/channel'>{en ? 'Providers' : '渠道管理'}</Link></div>
          <div><span>{en ? 'Manage' : '管理'}</span><Link to='/console/subscription'>{en ? 'Subscriptions' : '订阅'}</Link><Link to='/console/topup'>{en ? 'Top up' : '充值'}</Link><Link to='/console/redemption'>{en ? 'Redeem' : '兑换'}</Link><Link to='/console/system-status'>{en ? 'Service status' : '服务状态'}</Link></div>
          <div><span>{en ? 'Account' : '账户'}</span><Link to='/auth?mode=login'>{en ? 'Sign in' : '登录'}</Link><Link to='/auth?mode=register'>{en ? 'Create account' : '创建账户'}</Link><Link to='/console/personal'>{en ? 'Profile' : '个人设置'}</Link><Link to='/console/my-subscription'>{en ? 'My subscription' : '我的订阅'}</Link></div>
          <div><span>{en ? 'Resources' : '资源'}</span><Link to='/console/notices'>{en ? 'Notices' : '公告'}</Link><Link to='/console/operations'>{en ? 'Operations' : '运营信息'}</Link><Link to='/console/audit'>{en ? 'Audit logs' : '审计日志'}</Link><Link to='/console/setting'>{en ? 'Settings' : '系统设置'}</Link></div>
          <div><span>{en ? 'Connect' : '连接'}</span><a href='mailto:support@routifyapi.com'>{en ? 'Contact us' : '联系我们'}</a><Link to='/console/system-status'>{en ? 'System status' : '运行状态'}</Link><a href='https://routifyapi.com'>routifyapi.com</a></div>
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
    </div>
  );
};

export default Home;
