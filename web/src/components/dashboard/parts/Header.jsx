/*
 * Dashboard header — greeting + search + refresh.
 */
import React from 'react';
import { Search, RefreshCw } from 'lucide-react';

const Header = ({ greeting, greetingVisible, onSearch, onRefresh, loading, t }) => (
  <div className='flex items-center justify-between mb-6 gap-3'>
    <h1
      className='text-2xl md:text-3xl font-medium text-ui-text transition-opacity duration-700 truncate'
      style={{
        opacity: greetingVisible ? 1 : 0,
        fontFamily: "'Space Grotesk', sans-serif",
        letterSpacing: '-0.02em',
      }}
    >
      {greeting}
    </h1>
    <div className='flex items-center gap-1 flex-shrink-0'>
      <button
        onClick={onSearch}
        title={t('搜索')}
        aria-label={t('搜索')}
        className='inline-flex items-center justify-center w-9 h-9 rounded-lg text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle active:scale-90 transition-all duration-150'
      >
        <Search size={16} />
      </button>
      <button
        onClick={onRefresh}
        disabled={loading}
        title={t('刷新')}
        aria-label={t('刷新')}
        className='inline-flex items-center justify-center w-9 h-9 rounded-lg text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle active:scale-90 transition-all duration-150 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ui-text-2'
      >
        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
      </button>
    </div>
  </div>
);

export default Header;
