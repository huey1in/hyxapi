import { useContext, useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { ArrowRight, ChevronDown, Globe2, Monitor, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { interfaceLanguages, normalizeLanguage } from '../../i18n/language';
import { useSetTheme, useTheme } from '../../context/Theme';
import { StatusContext } from '../../context/Status';
import HeaderBar from '../../components/layout/HeaderBar';
import LegalDocumentDialog from '../../components/layout/LegalDocumentDialog';
import GrainBanner from './GrainBanner';
import { API } from '../../helpers';
import { extractSupportedModelBrands } from './modelBrands';
import type { ModelBrand } from './modelBrands';
import { useAuthStore } from '../../stores/auth-store';
import { parseHeaderNavModules, publicModuleAccess } from '../../lib/nav-modules';

const MODEL_ICON_CDN = 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/light';

const ICON_SLUGS: Record<string, string> = {
  openai: 'openai', claude: 'claude', gemini: 'gemini', deepseek: 'deepseek',
  xai: 'xai', mistral: 'mistral', qwen: 'qwen', moonshot: 'moonshot',
  zhipu: 'zhipu', meta: 'meta', cohere: 'cohere', doubao: 'doubao', minimax: 'minimax',
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

const modelProviders = [
  { name: 'OpenAI', icon: 'OpenAI' },
  { name: 'Anthropic', icon: 'Claude.Color' },
  { name: 'Google', icon: 'Gemini.Color' },
  { name: 'DeepSeek', icon: 'DeepSeek.Color' },
  { name: 'MiniMax', icon: 'Minimax.Color' },
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
  const [statusState] = useContext(StatusContext);
  const [supportedBrands, setSupportedBrands] = useState<ModelBrand[]>(modelProviders);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);
  const brandSectionRef = useRef<HTMLElement>(null);
  const languageRef = useRef<HTMLDivElement>(null);
  const languageButton = useRef<HTMLButtonElement>(null);
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.auth.user);
  const theme = useTheme();
  const setTheme = useSetTheme();
  const currentLanguage = normalizeLanguage(i18n.language) || 'en';
  const isLoggedIn = Boolean(user);
  const status = statusState?.status || {};
  const modules = parseHeaderNavModules(status.HeaderNavModules);
  const showPublicModels = Boolean(statusState.status) && modules.pricing.enabled && !modules.pricing.requireAuth;
  const pricingAccess = statusState.status ? publicModuleAccess(modules, 'pricing', isLoggedIn) : 'loading';
  const registerEnabled = status.register_enabled !== false;
  const startLink = isLoggedIn ? '/console' : registerEnabled ? '/auth?mode=register' : '/auth?mode=login';
  const agreementEnabled = Boolean(status.user_agreement_enabled);
  const privacyEnabled = Boolean(status.privacy_policy_enabled);

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
      <HeaderBar />

      <main>
        <GrainBanner>
          <div className='studio-hero-copy'>
            <h1 id='home-title'>{t('HyxAPI is the unified model gateway for AI applications.')}</h1>
            <div className='studio-actions'>
              <Link to={startLink}>{t(isLoggedIn ? 'Go to Console' : registerEnabled ? 'Get started with HyxAPI' : 'Sign in')} <ArrowRight size={16} /></Link>
            </div>
          </div>
        </GrainBanner>

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

        <section ref={brandSectionRef} className='studio-closing giant-brand-section' aria-label='HyxAPI'>
          <div className='giant-brand-word'>HyxAPI</div>
        </section>
      </main>

      <footer className='site-footer'>
        <div className='site-footer-links'>
          <div>
            <span>{t('Product')}</span>
            {showPublicModels && <Link to='/pricing'>{t('Models')}</Link>}
            <Link to='/token'>{t('API')}</Link>
            <Link to='/subscription'>{t('订阅')}</Link>
            <Link to='/log'>{t('日志')}</Link>
          </div>
          <div><span>{t('Contact')}</span><a href='https://github.com/huey1in' target='_blank' rel='noopener noreferrer'>GitHub</a><a href='mailto:1in@yxh.me'>{t('Email')}</a></div>
          <div><span>{t('Legal')}</span>{agreementEnabled ? <button type='button' onClick={() => setLegal('terms')}>{t('Terms of Service')}</button> : <span className='footer-link-disabled'>{t('Terms of Service')}</span>}{privacyEnabled ? <button type='button' onClick={() => setLegal('privacy')}>{t('Privacy Policy')}</button> : <span className='footer-link-disabled'>{t('Privacy Policy')}</span>}</div>
        </div>
        <div className='site-footer-bottom'>
          <span className='footer-copyright'>© {new Date().getFullYear()} HyxAPI</span>
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
