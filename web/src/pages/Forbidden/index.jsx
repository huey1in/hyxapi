/*
 * Forbidden — 403 页面
 *
 * 与 web-backup 同构：垂直居中 + 一个大号 ShieldX + 一行说明文字。
 */

import React from 'react';
import { ShieldX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Forbidden = () => {
  const { t } = useTranslation();
  return (
    <div
      className='flex flex-col justify-center items-center h-screen p-8 gap-4'
      style={{ backgroundColor: 'var(--page-bg)' }}
    >
      <ShieldX size={80} className='text-ui-text-2 opacity-60' />
      <p className='text-ui-text-2 text-base'>
        {t('您无权访问此页面，请联系管理员')}
      </p>
    </div>
  );
};

export default Forbidden;
