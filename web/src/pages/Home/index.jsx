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

import React, { useContext, useEffect, useState } from 'react';
import { API, showError, copy, showSuccess } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { API_ENDPOINTS } from '../../constants/common.constant';
import { StatusContext } from '../../context/Status';
import { useActualTheme } from '../../context/Theme';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import NoticeModal from '../../components/layout/NoticeModal';

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;
  const docsLink = statusState?.status?.docs_link || '';
  const serverAddress = statusState?.status?.server_address || `${window.location.origin}`;
  const endpointItems = API_ENDPOINTS.map((e) => ({ value: e }));
  const [endpointIndex, setEndpointIndex] = useState(0);
  const isChinese = i18n.language.startsWith('zh');

  const displayHomePageContent = async () => {
    setHomePageContent(localStorage.getItem('home_page_content') || '');
    const res = await API.get('/api/home_page_content');
    const { success, message, data } = res.data;
    if (success) {
      let content = data;
      if (!data.startsWith('https://')) {
        content = marked.parse(data);
      }
      setHomePageContent(content);
      localStorage.setItem('home_page_content', content);
      if (data.startsWith('https://')) {
        const iframe = document.querySelector('iframe');
        if (iframe) {
          iframe.onload = () => {
            iframe.contentWindow.postMessage({ themeMode: actualTheme }, '*');
            iframe.contentWindow.postMessage({ lang: i18n.language }, '*');
          };
        }
      }
    } else {
      showError(message);
      setHomePageContent('加载首页内容失败...');
    }
    setHomePageContentLoaded(true);
  };

  const handleCopyBaseURL = async () => {
    const ok = await copy(serverAddress);
    if (ok) showSuccess(t('已复制到剪切板'));
  };

  useEffect(() => {
    const checkNoticeAndShow = async () => {
      const lastCloseDate = localStorage.getItem('notice_close_date');
      const today = new Date().toDateString();
      if (lastCloseDate !== today) {
        try {
          const res = await API.get('/api/notice');
          const { success, data } = res.data;
          if (success && data && data.trim() !== '') setNoticeVisible(true);
        } catch (error) {
          console.error('获取公告失败:', error);
        }
      }
    };
    checkNoticeAndShow();
  }, []);

  useEffect(() => { displayHomePageContent(); }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setEndpointIndex((prev) => (prev + 1) % endpointItems.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [endpointItems.length]);

  const providers = [];

  return (
    <div className='w-full overflow-x-hidden'>
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />

      {homePageContentLoaded && homePageContent === '' ? (
        <div className='w-full min-h-screen flex flex-col items-center justify-center px-6 py-24'>
          {/* 主标题 */}
          <div className='text-center max-w-3xl mx-auto mb-12'>
            <h1 className={`text-5xl md:text-6xl lg:text-7xl font-semibold text-ui-text leading-tight mb-6 ${isChinese ? 'tracking-wide' : ''}`}>
              {t('统一的')}<br />
              <span className='shine-text'>{t('大模型接口网关')}</span>
            </h1>
            <p className='text-ui-text-2 text-lg md:text-xl'>
              {t('更好的价格，更好的稳定性，只需要将模型基址替换为：')}
            </p>
          </div>

          {/* Base URL 输入框 */}
          <div className='w-full max-w-lg mb-10'>
            <div className='flex items-center border border-ui-border rounded-xl overflow-hidden bg-ui-bg'>
              <span className='flex-1 px-4 py-3 text-sm text-ui-text truncate select-all'>
                {serverAddress}
              </span>
              <div className='px-3 py-3 text-xs text-ui-text-3 border-l border-ui-border min-w-[80px] text-center overflow-hidden'>
                <span key={endpointIndex} className='block truncate'>
                  {endpointItems[endpointIndex]?.value}
                </span>
              </div>
              <button
                onClick={handleCopyBaseURL}
                className='px-4 py-3 bg-ui-accent text-ui-accent-fg text-sm font-medium hover:bg-ui-accent-hover transition-colors whitespace-nowrap'
              >
                {t('复制')}
              </button>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className='flex flex-row gap-3'>
            <Link to='/console'>
              <button className='px-6 py-3 text-sm font-medium rounded-lg transition-colors bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover'>
                {t('获取密钥')}
              </button>
            </Link>
            {isDemoSiteMode && statusState?.status?.version ? (
              <button
                onClick={() => window.open('https://github.com/QuantumNous/new-api', '_blank')}
                className='px-6 py-3 text-sm font-medium rounded-lg border border-ui-border text-ui-text-2 bg-ui-bg hover:bg-ui-bg-subtle transition-colors'
              >
                {statusState.status.version}
              </button>
            ) : null}
          </div>

        </div>
      ) : (
        <div className='overflow-x-hidden w-full'>
          {homePageContent.startsWith('https://') ? (
            <iframe src={homePageContent} className='w-full h-screen border-none' />
          ) : (
            <div className='mt-[60px]' dangerouslySetInnerHTML={{ __html: homePageContent }} />
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
