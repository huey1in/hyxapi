/*
Copyright (C) 2025 QuantumNous

Mobile slide-in drawer with public navigation links.
*/

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';

const MobileNavDrawer = ({
  open,
  onClose,
  mainNavLinks,
  userState,
  pricingRequireAuth,
}) => {
  const location = useLocation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-[80] transition-opacity duration-200 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.4)' }}
      />

      {/* Panel */}
      <aside
        role='dialog'
        aria-label='navigation'
        className={`fixed top-0 left-0 bottom-0 z-[90] w-64 bg-ui-bg-elevated border-r border-ui-border shadow-2xl transition-transform duration-250 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className='flex items-center justify-between px-5 h-16 border-b border-ui-border'>
          <span className='text-sm font-semibold text-ui-text-2 uppercase tracking-widest'>
            导航
          </span>
          <button
            onClick={onClose}
            aria-label='close'
            className='inline-flex items-center justify-center w-9 h-9 rounded-lg text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle active:scale-90 transition-all duration-150'
          >
            <X size={20} />
          </button>
        </div>

        <nav className='py-3'>
          {mainNavLinks.map((link) => {
            const isActive =
              !link.isExternal &&
              (link.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(link.to));

            const cls = `block px-5 py-3 text-sm font-medium transition-colors ${
              isActive
                ? 'text-ui-brand bg-ui-bg-subtle'
                : 'text-ui-text hover:bg-ui-bg-subtle'
            }`;

            if (link.isExternal) {
              return (
                <a
                  key={link.itemKey}
                  href={link.externalLink}
                  target='_blank'
                  rel='noopener noreferrer'
                  className={cls}
                  onClick={onClose}
                >
                  {link.text}
                </a>
              );
            }

            let targetPath = link.to;
            if (link.itemKey === 'console' && !userState.user) targetPath = '/login';
            if (link.itemKey === 'pricing' && pricingRequireAuth && !userState.user)
              targetPath = '/login';

            return (
              <Link
                key={link.itemKey}
                to={targetPath}
                className={cls}
                onClick={onClose}
              >
                {link.text}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>,
    document.body,
  );
};

export default MobileNavDrawer;
