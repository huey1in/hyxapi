import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Github, Mail } from 'lucide-react';
import { getFooterHTML, getSystemName } from '../../helpers';
import { StatusContext } from '../../context/Status';

const FooterBar = () => {
  const { t } = useTranslation();
  const [customHtml, setCustomHtml] = useState(getFooterHTML());
  const [isMobile, setIsMobile] = useState(false);
  const [statusState] = useContext(StatusContext);
  const status = statusState?.status || {};
  const systemName = getSystemName() || 'Hyxware';
  const docsLink = status?.docs_link || '';
  const year = new Date().getFullYear();

  useEffect(() => {
    const html = localStorage.getItem('footer_html');
    if (html) setCustomHtml(html);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const SECTIONS = [
    {
      title: t('产品'),
      links: [
        { label: t('控制台'),    to: '/console' },
        { label: t('API Keys'),  to: '/console/token' },
        ...(docsLink ? [{ label: t('文档'), href: docsLink, external: true }] : []),
      ],
    },
    {
      title: t('联系'),
      links: [
        { label: t('联系我们'), href: `mailto:${status.support_email || '2926957031@qq.com'}`, external: true },
        { label: 'GitHub',      href: 'https://github.com/huey1in', external: true },
      ],
    },
  ];

  const linkStyle = {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textDecoration: 'none',
    transition: 'color 0.15s',
  };
  const onHover = (e) => (e.currentTarget.style.color = '#fff');
  const onLeave = (e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)');

  return (
    <footer
      className='w-full mt-auto'
      style={{ background: '#14130F', color: '#fff' }}
    >
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: isMobile ? '48px 20px 32px' : '64px 32px 40px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'minmax(220px, 1.6fr) repeat(2, 1fr)',
            gap: isMobile ? '32px 16px' : 40,
            marginBottom: isMobile ? 36 : 48,
          }}
        >
          {/* Brand column */}
          <div style={isMobile ? { gridColumn: '1 / -1' } : undefined}>
            <Link
              to='/'
              style={{
                display: 'inline-block', fontFamily: "'Kefaiii', 'Gilroy', sans-serif",
                fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em',
                color: '#fff', textDecoration: 'none', marginBottom: 14,
              }}
            >
              {systemName}
            </Link>
            <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.6)', maxWidth: 280 }}>
              {t('原生体验，远低于官方的价格。一个入口，稳定连通每一个模型。')}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { Icon: Github, href: 'https://github.com/huey1in', label: 'GitHub' },
                { Icon: Mail, href: `mailto:${status.support_email || '2926957031@qq.com'}`, label: 'Email' },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target='_blank'
                  rel='noopener noreferrer'
                  aria-label={label}
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.16)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(255,255,255,0.6)', transition: 'color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h4
                style={{
                  margin: '0 0 16px', fontSize: 13, fontWeight: 600,
                  letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)',
                }}
              >
                {section.title}
              </h4>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                {section.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a href={link.href} target='_blank' rel='noopener noreferrer' style={linkStyle} onMouseEnter={onHover} onMouseLeave={onLeave}>
                        {link.label}
                      </a>
                    ) : (
                      <Link to={link.to} style={linkStyle} onMouseEnter={onHover} onMouseLeave={onLeave}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            paddingTop: 28,
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}
        >
          {customHtml ? (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }} dangerouslySetInnerHTML={{ __html: customHtml }} />
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              © {year} {systemName}. {t('版权所有')}
              {status.icp_no ? <span style={{ marginLeft: 12 }}>{status.icp_no}</span> : null}
            </p>
          )}
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            {t('基于')}{' '}
            <a
              href='https://github.com/QuantumNous/new-api'
              target='_blank'
              rel='noopener noreferrer'
              style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, textDecoration: 'none' }}
              onMouseEnter={onHover}
              onMouseLeave={onLeave}
            >
              New API
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default FooterBar;
