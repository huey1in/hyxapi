import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Github, Mail, Twitter } from 'lucide-react';
import { getFooterHTML, getSystemName } from '../../helpers';
import { StatusContext } from '../../context/Status';

const FooterBar = () => {
  const { t } = useTranslation();
  const [customHtml, setCustomHtml] = useState(getFooterHTML());
  const [statusState] = useContext(StatusContext);
  const status = statusState?.status || {};
  const systemName = getSystemName();
  const docsLink = status?.docs_link || 'https://docs.newapi.pro';
  const year = new Date().getFullYear();

  useEffect(() => {
    const html = localStorage.getItem('footer_html');
    if (html) setCustomHtml(html);
  }, []);

  const SECTIONS = [
    {
      title: t('产品'),
      links: [
        { label: t('控制台'),   to: '/console' },
        { label: t('模型广场'), to: '/pricing' },
        { label: t('API Keys'), to: '/console/token' },
      ],
    },
    {
      title: t('资源'),
      links: [
        { label: t('文档'),       href: docsLink, external: true },
        { label: t('GitHub'),     href: 'https://github.com/QuantumNous/new-api', external: true },
        { label: t('系统状态'),   to: '/console' },
        { label: t('更新日志'),   href: 'https://github.com/QuantumNous/new-api/releases', external: true },
      ],
    },
    {
      title: t('法律'),
      links: [
        { label: t('用户协议'), to: '/agreement' },
        { label: t('隐私政策'), to: '/privacy' },
      ],
    },
  ];

  const SOCIALS = [
    { Icon: Github,  href: 'https://github.com/QuantumNous/new-api', label: 'GitHub' },
    { Icon: Twitter, href: status.twitter_url || '#', label: 'Twitter' },
    { Icon: Mail,    href: `mailto:${status.support_email || 'support@example.com'}`, label: 'Email' },
  ];

  return (
    <footer
      className='w-full text-neutral-300 mt-auto'
      style={{ backgroundColor: '#0a0a0a' }}
    >
      <div className='max-w-[1200px] mx-auto px-6 md:px-10 py-14'>
        <div className='grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-10 mb-12'>
          {/* Brand column */}
          <div className='col-span-2'>
            <Link to='/' className='inline-block text-white font-semibold mb-3'
              style={{ letterSpacing: '-0.02em', fontSize: 24 }}>
              {systemName}
            </Link>
            <p className='text-sm text-neutral-400 leading-relaxed max-w-xs mb-5'>
              {t('企业级 AI API 网关 · 智能路由 · 统一计费 · 协议兼容')}
            </p>
            <div className='flex items-center gap-2'>
              {SOCIALS.filter((s) => s.href && s.href !== '#').map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target='_blank'
                  rel='noopener noreferrer'
                  aria-label={label}
                  className='w-9 h-9 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/5 transition-colors'
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h4 className='text-xs font-semibold text-neutral-200 uppercase tracking-wider mb-4'>
                {section.title}
              </h4>
              <ul className='space-y-2.5'>
                {section.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-sm text-neutral-400 hover:text-white transition-colors'
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link to={link.to} className='text-sm text-neutral-400 hover:text-white transition-colors'>
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
        <div className='pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3'>
          {customHtml ? (
            <div className='text-sm text-neutral-500' dangerouslySetInnerHTML={{ __html: customHtml }} />
          ) : (
            <p className='text-sm text-neutral-500'>
              © {year} {systemName}. {t('版权所有')}
            </p>
          )}
          <p className='text-sm text-neutral-500'>
            {t('基于')}{' '}
            <a
              href='https://github.com/QuantumNous/new-api'
              target='_blank'
              rel='noopener noreferrer'
              className='text-neutral-300 hover:text-white font-medium'
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
