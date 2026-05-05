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

  if (!isConsoleRoute) {
    return (
      <header className='fixed top-0 left-0 right-0 z-50 py-4 md:py-6 px-[16px] md:px-[26px] transition-colors duration-300 bg-transparent' style={{ fontFamily: "Season-Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif" }}>
        <NoticeModal
          visible={noticeVisible}
          onClose={handleNoticeClose}
          isMobile={isMobile}
          defaultTab={unreadCount > 0 ? 'system' : 'inApp'}
          unreadKeys={getUnreadKeys()}
        />
        <MobileNavDrawer
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          mainNavLinks={mainNavLinks}
          userState={userState}
          pricingRequireAuth={pricingRequireAuth}
          systemName={systemName}
        />
        <div className='max-w-[1420px] mx-auto flex items-center justify-between'>
          <div className='flex items-center gap-4'>
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
            <div className='hidden lg:flex items-center gap-1'>
              <Navigation
                mainNavLinks={mainNavLinks}
                isMobile={false}
                isLoading={isLoading}
                userState={userState}
                pricingRequireAuth={pricingRequireAuth}
                variant='flat'
              />
            </div>
          </div>

          <div className='hidden lg:flex items-center gap-2'>
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
              isMobile={false}
              isSelfUseMode={isSelfUseMode}
              logout={logout}
              navigate={navigate}
              t={t}
            />
          </div>

          <div className='flex lg:hidden items-center gap-2'>
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
              isMobile={true}
              isSelfUseMode={isSelfUseMode}
              logout={logout}
              navigate={navigate}
              t={t}
            />
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label='open menu'
              className='w-[40px] h-[40px] rounded-full bg-black flex items-center justify-center cursor-pointer flex-shrink-0'
            >
              <Menu size={18} color='white' />
            </button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className='text-ui-text sticky top-0 z-50 transition-colors duration-300 bg-ui-header-bg backdrop-blur-lg border-b border-ui-border'>
      <NoticeModal
        visible={noticeVisible}
        onClose={handleNoticeClose}
        isMobile={isMobile}
        defaultTab={unreadCount > 0 ? 'system' : 'inApp'}
        unreadKeys={getUnreadKeys()}
      />

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
