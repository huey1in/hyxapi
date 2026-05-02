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

import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { useHeaderBar } from '../../../hooks/common/useHeaderBar';
import { useNotifications } from '../../../hooks/common/useNotifications';
import { useNavigation } from '../../../hooks/common/useNavigation';
import NoticeModal from '../NoticeModal';
import MobileMenuButton from './MobileMenuButton';
import MobileNavDrawer from './MobileNavDrawer';
import HeaderLogo from './HeaderLogo';
import Navigation from './Navigation';
import ActionButtons from './ActionButtons';

const HeaderBar = ({ onMobileMenuToggle, drawerOpen }) => {
  const {
    userState,
    statusState,
    isMobile,
    collapsed,
    logoLoaded,
    currentLang,
    isLoading,
    systemName,
    logo,
    isNewYear,
    isSelfUseMode,
    docsLink,
    isDemoSiteMode,
    isConsoleRoute,
    theme,
    headerNavModules,
    pricingRequireAuth,
    logout,
    handleLanguageChange,
    handleThemeToggle,
    handleMobileMenuToggle,
    navigate,
    t,
  } = useHeaderBar({ onMobileMenuToggle, drawerOpen });

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const {
    noticeVisible,
    unreadCount,
    handleNoticeOpen,
    handleNoticeClose,
    getUnreadKeys,
  } = useNotifications(statusState);

  const { mainNavLinks } = useNavigation(t, docsLink, headerNavModules);

  return (
    <header className='text-ui-text sticky top-0 z-50 transition-colors duration-300 bg-ui-header-bg backdrop-blur-lg border-b border-ui-border'>
      <NoticeModal
        visible={noticeVisible}
        onClose={handleNoticeClose}
        isMobile={isMobile}
        defaultTab={unreadCount > 0 ? 'system' : 'inApp'}
        unreadKeys={getUnreadKeys()}
      />

      {!isConsoleRoute && (
        <MobileNavDrawer
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          mainNavLinks={mainNavLinks}
          userState={userState}
          pricingRequireAuth={pricingRequireAuth}
        />
      )}

      <div className='w-full px-4'>
        <div className='flex items-center h-16 gap-4'>
          <div className='flex items-center gap-3 min-w-0'>
            <MobileMenuButton
              isConsoleRoute={isConsoleRoute}
              isMobile={isMobile}
              drawerOpen={drawerOpen}
              collapsed={collapsed}
              onToggle={handleMobileMenuToggle}
              t={t}
            />

            {/* Public mobile nav hamburger (only on non-console routes) */}
            {!isConsoleRoute && (
              <button
                onClick={() => setMobileNavOpen(true)}
                aria-label='open navigation'
                className='md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle active:scale-90 transition-all duration-150'
              >
                <Menu size={20} />
              </button>
            )}

            <HeaderLogo
              isMobile={isMobile}
              isConsoleRoute={isConsoleRoute}
              logo={logo}
              logoLoaded={logoLoaded}
              isLoading={isLoading}
              systemName={systemName}
              isSelfUseMode={isSelfUseMode}
              isDemoSiteMode={isDemoSiteMode}
              t={t}
            />
          </div>

          <div className='ml-auto flex items-center gap-3'>
            <div className='hidden md:block'>
              <Navigation
                mainNavLinks={mainNavLinks}
                isMobile={isMobile}
                isLoading={isLoading}
                userState={userState}
                pricingRequireAuth={pricingRequireAuth}
              />
            </div>

            <ActionButtons
              isNewYear={isNewYear}
              unreadCount={unreadCount}
              onNoticeOpen={handleNoticeOpen}
              theme={theme}
              onThemeToggle={handleThemeToggle}
              currentLang={currentLang}
              onLanguageChange={handleLanguageChange}
              userState={userState}
              isLoading={isLoading}
              isMobile={isMobile}
              isSelfUseMode={isSelfUseMode}
              logout={logout}
              navigate={navigate}
              t={t}
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default HeaderBar;
