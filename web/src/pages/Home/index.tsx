import { useContext, useEffect, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { ArrowRight, ChevronDown, Globe2, LockKeyhole, Menu, Monitor, Moon, RotateCw, Sun, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { interfaceLanguages, normalizeLanguage } from '../../i18n/language';
import Dashboard from '../Dashboard';
import Pricing from '../Pricing';
import Token from '../Token';
import Log from '../Log/LogPreview';
import SiderBar from '../../components/layout/SiderBar';
import { useSetTheme, useTheme } from '../../context/Theme';
import { StatusContext } from '../../context/Status';
import PublicNavLinks from '../../components/layout/PublicNavLinks';
import LegalDocumentDialog from '../../components/layout/LegalDocumentDialog';
import { API, updateAPI, logoutAuthentication } from '../../helpers';
import { extractSupportedModelBrands } from './modelBrands';
import type { ModelBrand } from './modelBrands';
import { useAuthStore } from '../../stores/auth-store';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { parseHeaderNavModules, publicModuleAccess } from '../../lib/nav-modules';

const MODEL_ICON_CDN = 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/light';

const ICON_SLUGS: Record<string, string> = {
  openai: 'openai', claude: 'claude', gemini: 'gemini', deepseek: 'deepseek',
  xai: 'xai', mistral: 'mistral', qwen: 'qwen', moonshot: 'moonshot',
  zhipu: 'zhipu', meta: 'meta', cohere: 'cohere', doubao: 'doubao',
  anthropic: 'claude-color', google: 'gemini-color', mistralai: 'mistral-color',
};

const iconSource = (icon: string) => {
  if (/^https?:\/\//i.test(icon || '')) return icon;
  const [name, variant] = String(icon || '').split('.');
  const normalized = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const slug = ICON_SLUGS[normalized] || normalized;
  const colorSuffix = String(variant || '').toLowerCase() === 'color' && !slug.endsWith('-color') ? '-color' : '';
  return `${MODEL_ICON_CDN}/${slug}${colorSuffix}.png`;
};

const ProviderIcon = ({ icon, name }: ModelBrand) => (
  <span className='model-provider-image'>
    <img
      src={iconSource(icon)}
      alt=''
      width='44'
      height='44'
      loading='lazy'
      onError={(event) => { event.currentTarget.hidden = true; const fallback = event.currentTarget.nextElementSibling; if (fallback instanceof HTMLElement) fallback.hidden = false; }}
    />
    <span hidden>{name?.charAt(0)?.toUpperCase() || '?'}</span>
  </span>
);

const BrowserAddress = ({ children }: { children: ReactNode }) => (
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

const moveModelSpotlight = (event: PointerEvent<HTMLDivElement>) => {
  event.currentTarget.querySelectorAll<HTMLElement>('.model-card').forEach((card) => {
    const icon = card.querySelector<HTMLElement>('.model-icon-stack'); if (!icon) return;
    const rect = icon.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
    card.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
    card.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
    card.style.setProperty('--spot-opacity', inside ? '1' : '0');
  });
};

const hideModelSpotlight = (event: PointerEvent<HTMLDivElement>) => {
  event.currentTarget.querySelectorAll<HTMLElement>('.model-card').forEach((card) => {
    card.style.setProperty('--spot-opacity', '0');
  });
};

const HomeContent = () => {
  const navigate = useNavigate();
  const [statusState] = useContext(StatusContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [supportedBrands, setSupportedBrands] = useState<ModelBrand[]>(modelProviders);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);
  const brandSectionRef = useRef<HTMLElement>(null);
  const languageRef = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const languageButton = useRef<HTMLButtonElement>(null);
  const { t, i18n } = useTranslation();
  const { busy, run } = useOwnedOperation();
  const user = useAuthStore((state) => state.auth.user);
  const theme = useTheme();
  const setTheme = useSetTheme();
  const currentLanguage = normalizeLanguage(i18n.language) || 'en';
  const isLoggedIn = Boolean(user);
  const status = statusState?.status || {};
  const modules = parseHeaderNavModules(status.HeaderNavModules);
  const pricingAccess = statusState.status ? publicModuleAccess(modules, 'pricing', isLoggedIn) : 'loading';
  const registerEnabled = status.register_enabled !== false;
  const startLink = isLoggedIn ? '/console' : registerEnabled ? '/auth?mode=register' : '/auth?mode=login';
  const agreementEnabled = Boolean(status.user_agreement_enabled);
  const privacyEnabled = Boolean(status.privacy_policy_enabled);

  const logout = () => void run(async (signal) => {
    if (!await logoutAuthentication(signal)) return;
    updateAPI(); setMenuOpen(false); navigate('/');
  });

  const switchLanguage = (language: string) => {
    i18n.changeLanguage(language);
    try { localStorage.setItem('i18nextLng', language); } catch {}
    setLanguageOpen(false); languageButton.current?.focus();
  };

  useEffect(() => {
    if (pricingAccess !== 'allowed') return;
    const owner = new AbortController();
    API.get('/api/pricing', { signal: owner.signal, skipErrorHandler: true, skipAuthRefresh: true, disableDuplicate: true }).then((response) => {
      const payload = response?.data;
      if (owner.signal.aborted || !payload?.success) return;
      const brands = extractSupportedModelBrands(payload.data, payload.vendors);
      if (brands.length > 0) setSupportedBrands(brands);
    }).catch(() => {});
    return () => owner.abort();
  }, [pricingAccess]);

  useEffect(() => {
    const closeLanguageMenu = (event: MouseEvent) => {
      if (!languageRef.current?.contains(event.target as Node)) setLanguageOpen(false);
    };
    document.addEventListener('mousedown', closeLanguageMenu);
    return () => document.removeEventListener('mousedown', closeLanguageMenu);
  }, []);

  useEffect(() => {
    if (menuOpen) document.getElementById('home-navigation')?.querySelector<HTMLElement>('a,button')?.focus();
  }, [menuOpen]);
  useEffect(() => {
    if (languageOpen) (languageRef.current?.querySelector<HTMLButtonElement>('[role=menuitem].is-active') ?? languageRef.current?.querySelector<HTMLButtonElement>('[role=menuitem]'))?.focus();
  }, [languageOpen]);

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
        <Link to='/' className='home-brand'>Hyxware</Link>
        <nav id='home-navigation' aria-label={t('Main navigation')} className={`home-nav-links public-site-navigation${menuOpen ? ' is-open' : ''}`} onKeyDown={(event) => { if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); } }}>
          <PublicNavLinks status={statusState.status} includeHome={false} onNavigate={() => setMenuOpen(false)} />
          {isLoggedIn ? (
            <button type='button' className='home-nav-start' onClick={logout} disabled={busy}>
              {t('Sign out')}
            </button>
          ) : (
            <>
              <Link to='/auth?mode=login'>{t('Sign in')}</Link>
              {registerEnabled && <Link className='home-nav-start' to='/auth?mode=register'>{t('Create account')}</Link>}
            </>
          )}
        </nav>
        <button ref={menuButton} type='button' className='home-menu-button' onClick={() => setMenuOpen(!menuOpen)} aria-label={t('Toggle navigation menu')} aria-expanded={menuOpen} aria-controls='home-navigation'>
          {menuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
      </header>

      <main>
        <section className='studio-hero'>
          <div className='studio-hero-copy'>
            <h1>{t('Hyxware is the unified model gateway for AI applications.')}</h1>
            <div className='studio-actions'>
              <Link to={startLink}>{t(isLoggedIn ? 'Go to Console' : registerEnabled ? 'Get started with Hyxware' : 'Sign in')} <ArrowRight size={16} /></Link>
            </div>
          </div>
          <div className='hero-side-note'><span>OPENAI COMPATIBLE</span><code>{`${window.location.origin}/v1`}</code></div>
        </section>

        <section id='inside' className='product-frame' aria-label={t('Hyxware console preview')}>
          <div className='product-frame-bar'>
            <div className='mac-window-controls' aria-hidden='true'><i /><i /><i /></div>
            <BrowserAddress>{`${window.location.host}/console`}</BrowserAddress>
            <span aria-hidden='true' />
          </div>
          <div className='product-shell'>
            <SiderBar preview />
            <div className='dashboard-preview-content'><Dashboard preview /></div>
          </div>
        </section>

        <section className='model-trust'>
          <h2>{t('Works with the models you already use')}</h2>
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
            <h2 id='marketplace-title'>{t('More providers, transparent pricing')}</h2>
            <p>{t('Compare every provider for the same model. Choose lower-cost routes with prices below official rates.')}</p>
            <Link to='/pricing'>{t('View model pricing')} <ArrowRight size={15} /></Link>
          </div>
          <div className='marketplace-stage' aria-label={t('Hyxware models preview')}>
            <div className='marketplace-preview-mat'>
              <div className='product-frame marketplace-frame'>
                <div className='product-frame-bar'>
                  <div className='mac-window-controls' aria-hidden='true'><i /><i /><i /></div>
                  <BrowserAddress>{`${window.location.host}/pricing`}</BrowserAddress>
                  <span aria-hidden='true' />
                </div>
                <div className='product-shell'>
                  <SiderBar preview previewActive='/pricing' />
                  <div className='marketplace-preview-content'>{pricingAccess === 'allowed' ? <Pricing preview /> : <div className='p-8 text-sm text-ui-text-2'>{t(pricingAccess === 'loading' ? 'Loading...' : pricingAccess === 'disabled' ? 'Model pricing is unavailable' : 'Sign in to view model pricing')}</div>}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className='feature-showcase-stack'>
        <section className='feature-showcase api-showcase' aria-labelledby='api-showcase-title'>
          <div className='feature-stage feature-stage-right' aria-label={t('Hyxware API keys preview')}>
            <div className='feature-preview-mat'>
              <div className='product-frame console-feature-frame api-feature-frame'>
                <div className='product-frame-bar'>
                  <div className='mac-window-controls' aria-hidden='true'><i /><i /><i /></div>
                  <BrowserAddress>{`${window.location.host}/token`}</BrowserAddress>
                  <span aria-hidden='true' />
                </div>
                <div className='product-shell'>
                  <SiderBar preview previewActive='/token' />
                  <div className='console-feature-content'><Token preview /></div>
                </div>
              </div>
            </div>
          </div>
          <div className='feature-showcase-copy'>
            <h2 id='api-showcase-title'>{t('One key for every model')}</h2>
            <p>{t('Create keys by project and manage quotas, groups, and model access from one place.')}</p>
            <Link to='/token'>{t('Manage API keys')} <ArrowRight size={15} /></Link>
          </div>
        </section>

        <section className='feature-showcase log-showcase' aria-labelledby='log-showcase-title'>
          <div className='feature-showcase-copy'>
            <h2 id='log-showcase-title'>{t('Every request, fully traceable')}</h2>
            <p>{t('Track model, provider, tokens, latency, and actual cost in one complete request log.')}</p>
            <Link to='/log'>{t('View request logs')} <ArrowRight size={15} /></Link>
          </div>
          <div className='feature-stage feature-stage-left' aria-label={t('Hyxware request logs preview')}>
            <div className='feature-preview-mat'>
              <div className='product-frame console-feature-frame log-feature-frame'>
                <div className='product-frame-bar'>
                  <div className='mac-window-controls' aria-hidden='true'><i /><i /><i /></div>
                  <BrowserAddress>{`${window.location.host}/log`}</BrowserAddress>
                  <span aria-hidden='true' />
                </div>
                <div className='product-shell'>
                  <SiderBar preview previewActive='/log' />
                  <div className='console-feature-content'><Log /></div>
                </div>
              </div>
            </div>
          </div>
        </section>
        </div>

        <section className='frontier-section' aria-labelledby='frontier-title'>
          <h2 id='frontier-title'>{t('Always at the frontier')}</h2>
          <div className='frontier-grid'>
            <article className='frontier-card'>
              <div className='frontier-card-copy'>
                <h3>{t('The latest models, ready when you are')}</h3>
                <p>{t('Access new releases from leading providers through the same OpenAI-compatible API.')}</p>
                <Link to='/pricing'>{t('Explore models')} <ArrowRight size={14} /></Link>
              </div>
              <div className='frontier-visual frontier-model-menu' aria-hidden='true'>
                <div className='frontier-composer'><span>{t('Choose the best model for this request')}</span><b>{t('Auto')}</b></div>
                <div className='frontier-model-list'>{['GPT-5.6', 'Claude Opus 5', 'Gemini 3.1 Pro', 'DeepSeek V4'].map((model, index) => <span key={model}><i />{model}{index === 0 && <b>{t('New')}</b>}</span>)}</div>
              </div>
            </article>
            <article className='frontier-card'>
              <div className='frontier-card-copy'>
                <h3>{t('Every provider, one clear price')}</h3>
                <p>{t('Compare routes for the same model and use prices below official rates without changing your SDK.')}</p>
                <Link to='/pricing'>{t('Compare pricing')} <ArrowRight size={14} /></Link>
              </div>
              <div className='frontier-visual frontier-price-list' aria-hidden='true'>
                <div><span>{t('Provider')}</span><span>{t('Input / 1M')}</span><span>{t('Status')}</span></div>
                <div><strong>Hyxware A</strong><b>$1.82</b><em>{t('Best price')}</em></div><div><strong>Hyxware B</strong><b>$2.06</b><em>{t('Available')}</em></div><div><strong>{t('Official')}</strong><b>$3.00</b><em>{t('Reference')}</em></div>
              </div>
            </article>
            <article className='frontier-card'>
              <div className='frontier-card-copy'>
                <h3>{t('Automatic scheduling for every endpoint')}</h3>
                <p>{t('Messages and completions requests are both scheduled automatically across available providers.')}</p>
                <Link to='/log'>{t('View request logs')} <ArrowRight size={14} /></Link>
              </div>
              <div className='frontier-visual frontier-route-flow' aria-hidden='true'>
                <div className='frontier-request'><small>POST</small><span>/v1/messages</span></div><div className='frontier-request frontier-request-secondary'><small>POST</small><span>/v1/chat/completions</span></div><div className='frontier-route-line'><i /><span>{t('Scheduled automatically')}</span><b>38 ms</b></div><div className='frontier-route-line'><i /><span>{t('Provider responded')}</span><b>200</b></div><div className='frontier-route-total'><span>{t('Requests completed')}</span><strong>1.24 s</strong></div>
              </div>
            </article>
          </div>
        </section>

        <section ref={brandSectionRef} className='studio-closing giant-brand-section' aria-label='Hyxware'>
          <div className='giant-brand-word'>Hyx<span>ware</span></div>
        </section>
      </main>

      <footer className='site-footer'>
        <div className='site-footer-links'>
          <div><span>{t('Product')}</span><Link to='/pricing'>{t('Models')}</Link><Link to='/console'>{t('Console')}</Link><Link to='/token'>{t('API keys')}</Link><Link to='/log'>{t('Request logs')}</Link></div>
          <div><span>{t('Contact')}</span><a href='https://github.com/huey1in' target='_blank' rel='noopener noreferrer'>GitHub</a><a href='mailto:1in@yxh.me'>{t('Email')}</a></div>
          <div><span>{t('Legal')}</span>{agreementEnabled ? <button type='button' onClick={() => setLegal('terms')}>{t('Terms of Service')}</button> : <span className='footer-link-disabled'>{t('Terms of Service')}</span>}{privacyEnabled ? <button type='button' onClick={() => setLegal('privacy')}>{t('Privacy Policy')}</button> : <span className='footer-link-disabled'>{t('Privacy Policy')}</span>}</div>
        </div>
        <div className='site-footer-bottom'>
          <span className='footer-copyright'>© {new Date().getFullYear()} Hyxware</span>
          <span className='footer-status'><Trans i18nKey='Compute services provided by <provider>Xunduyun</provider>' components={{ provider: <a href='https://www.xunduyun.com/' target='_blank' rel='noopener noreferrer' /> }} /></span>
          <div className='footer-controls'>
            <div className='footer-theme-switch' aria-label={t('Theme')}>
              <button type='button' aria-pressed={theme === 'auto'} className={theme === 'auto' ? 'is-active' : ''} onClick={() => setTheme('auto')} title={t('System theme')} aria-label={t('Use system theme')}><Monitor size={14} /></button>
              <button type='button' aria-pressed={theme === 'light'} className={theme === 'light' ? 'is-active' : ''} onClick={() => setTheme('light')} title={t('Light theme')} aria-label={t('Use light theme')}><Sun size={14} /></button>
              <button type='button' aria-pressed={theme === 'dark'} className={theme === 'dark' ? 'is-active' : ''} onClick={() => setTheme('dark')} title={t('Dark theme')} aria-label={t('Use dark theme')}><Moon size={14} /></button>
            </div>
            <div className='footer-language-wrap' ref={languageRef} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setLanguageOpen(false); languageButton.current?.focus(); } if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); setLanguageOpen(true); const buttons = [...(languageRef.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]') ?? [])]; const index = buttons.indexOf(document.activeElement as HTMLButtonElement); const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length; buttons[next]?.focus(); } }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setLanguageOpen(false); }}>
              <button ref={languageButton} type='button' aria-label={t('Language')} className='footer-language' onClick={() => setLanguageOpen((open) => !open)} aria-expanded={languageOpen} aria-haspopup='menu'>
                <Globe2 size={14} /><span>{interfaceLanguages.find(({ value }) => value === currentLanguage)?.label}</span><ChevronDown size={13} />
              </button>
              {languageOpen && <div className='footer-language-menu' role='menu'>
                {interfaceLanguages.map(({ value, label }) => <button key={value} className={currentLanguage === value ? 'is-active' : ''} onClick={() => switchLanguage(value)} role='menuitem'>{label}</button>)}
              </div>}
            </div>
          </div>
        </div>
      </footer>
      {legal && <LegalDocumentDialog key={legal} type={legal} onClose={() => setLegal(null)} />}
    </div>
  );
};

export default function Home() {
  const user = useAuthStore((state) => state.auth.user);
  const sessionId = useAuthStore((state) => state.auth.session?.sid);
  return <HomeContent key={`${user?.id || 'anonymous'}:${sessionId}`} />;
}
