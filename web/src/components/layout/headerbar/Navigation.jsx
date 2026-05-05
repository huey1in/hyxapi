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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import SkeletonWrapper from '../components/SkeletonWrapper';
import { useLoginModal } from '../../../context/LoginModal';

const Navigation = ({
  mainNavLinks,
  isMobile,
  isLoading,
  userState,
  pricingRequireAuth,
  variant = 'pill',
}) => {
  const location = useLocation();
  const containerRef = useRef(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });
  const { openLoginModal } = useLoginModal();

  const activeKey = useMemo(() => {
    const link = mainNavLinks.find((l) => {
      if (l.isExternal) return false;
      if (l.to === '/') return location.pathname === '/';
      return location.pathname.startsWith(l.to);
    });
    return link?.itemKey ?? null;
  }, [location.pathname, mainNavLinks]);

  useEffect(() => {
    if (!activeKey || !containerRef.current) {
      setIndicator((prev) => ({ ...prev, opacity: 0 }));
      return;
    }
    const el = containerRef.current.querySelector(`[data-key="${activeKey}"]`);
    if (el) {
      setIndicator({
        left: el.offsetLeft,
        width: el.offsetWidth,
        opacity: 1,
      });
    }
  }, [activeKey, mainNavLinks, isMobile]);

  const linkClass = (isActive) => {
    if (variant === 'flat') {
      return `group flex items-center gap-1 text-[15px] font-medium text-black transition-colors py-2 px-1 whitespace-nowrap cursor-pointer font-['Season-Sans','-apple-system','BlinkMacSystemFont','Segoe_UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira_Sans','Droid_Sans','Helvetica_Neue',sans-serif] ${
        isActive ? 'underline underline-offset-[5px] decoration-black' : ''
      }`;
    }
    return `relative z-10 ${isMobile ? 'px-2.5 py-1' : 'px-3.5 py-1.5'} text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
      isActive ? 'text-ui-text' : 'text-ui-text-2 hover:text-ui-text'
    }`;
  };

  const renderLabel = (text) => {
    if (variant === 'flat') {
      return <span className='underline-offset-[5px] decoration-black group-hover:underline'>{text}</span>;
    }
    return text;
  };

  const renderLinks = () =>
    mainNavLinks.map((link) => {
      const isActive = link.itemKey === activeKey;

      if (link.isExternal) {
        return (
          <a
            key={link.itemKey}
            data-key={link.itemKey}
            href={link.externalLink}
            target='_blank'
            rel='noopener noreferrer'
            className={linkClass(isActive)}
          >
            {renderLabel(link.text)}
          </a>
        );
      }

      let targetPath = link.to;
      const needsLogin =
        (link.itemKey === 'console' && !userState.user) ||
        (link.itemKey === 'pricing' && pricingRequireAuth && !userState.user);

      if (needsLogin) {
        return (
          <button
            key={link.itemKey}
            data-key={link.itemKey}
            type='button'
            onClick={openLoginModal}
            className={`${linkClass(isActive)} bg-transparent border-0`}
          >
            {renderLabel(link.text)}
          </button>
        );
      }

      return (
        <Link
          key={link.itemKey}
          data-key={link.itemKey}
          to={targetPath}
          className={linkClass(isActive)}
        >
          {renderLabel(link.text)}
        </Link>
      );
    });

  return (
    <nav className='flex items-center overflow-x-auto scrollbar-hide'>
      <SkeletonWrapper
        loading={isLoading}
        type='navigation'
        count={4}
        width={60}
        height={16}
        isMobile={isMobile}
      >
        {variant === 'flat' ? (
          <div ref={containerRef} className='inline-flex items-center gap-4'>
            {renderLinks()}
          </div>
        ) : (
        <div
          ref={containerRef}
          className='relative inline-flex items-center bg-ui-bg-subtle rounded-full p-1'
        >
          <span
            aria-hidden
            className='absolute top-1 bottom-1 bg-ui-bg-elevated rounded-full shadow-sm transition-all duration-300 ease-out'
            style={{
              left: indicator.left,
              width: indicator.width,
              opacity: indicator.opacity,
            }}
          />
          {renderLinks()}
        </div>
        )}
      </SkeletonWrapper>
    </nav>
  );
};

export default Navigation;
