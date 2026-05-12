import React from 'react';
import { ShieldX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Forbidden = () => {
  const { t } = useTranslation();
  return (
    <div
      className='flex flex-col justify-center items-center min-h-[calc(100vh-64px)] p-8 gap-4'
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
