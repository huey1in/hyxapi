/*
 * SubscriptionsPage — 与 web-backup 同构。
 */

import React, { useState } from 'react';
import { Plus, RefreshCw, Info } from 'lucide-react';
import { useSubscriptionsData } from '../../../hooks/subscriptions/useSubscriptionsData';
import { Button, IconButton, Pagination } from '../../ui';
import SubscriptionsTable from './SubscriptionsTable';
import AddEditSubscriptionModal from './modals/AddEditSubscriptionModal';
import SubscriptionCodesModal from './modals/SubscriptionCodesModal';

const SubscriptionsPage = () => {
  const data = useSubscriptionsData();
  const [codesPlan, setCodesPlan] = useState(null);
  const {
    showEdit, editingPlan, sheetPlacement, closeEdit, refresh, openCreate,
    plans, planCount, activePage, pageSize,
    handlePageChange, handlePageSizeChange,
    loading, t,
  } = data;

  return (
    <div className='px-4 pt-8 pb-6 md:px-6 md:pt-10 md:pb-8' style={{ backgroundColor: 'var(--page-bg)' }}>
      <div className='max-w-[1280px] mx-auto'>
        <div className='flex items-center justify-between gap-3 mb-5'>
          <h1 className='text-2xl md:text-3xl font-medium text-ui-text' style={{ letterSpacing: '-0.02em' }}>{t('订阅管理')}</h1>
          <div className='flex items-center gap-1'>
            <IconButton icon={RefreshCw} onClick={refresh} disabled={loading} title={t('刷新')} />
            <Button icon={Plus} onClick={openCreate}>{t('新建套餐')}</Button>
          </div>
        </div>

        <div className='flex items-start gap-2 px-4 py-3 rounded-[20px] border border-ui-border mb-4' style={{ backgroundColor: 'var(--page-bg)' }}>
          <Info size={14} className='text-ui-text-3 flex-shrink-0 mt-0.5' />
          <p className='text-xs text-ui-text-2 leading-relaxed'>{t('用户在「钱包管理」中输入兑换码即可激活对应订阅')}</p>
        </div>

        <div className='border border-ui-border rounded-[20px] overflow-hidden' style={{ backgroundColor: 'var(--page-bg)' }}>
          <SubscriptionsTable {...data} openCodes={(record) => setCodesPlan(record)} />
          {planCount > 0 && (
            <div className='border-t border-ui-divider'>
              <Pagination
                page={activePage}
                pageSize={pageSize}
                total={planCount}
                pageSizeOpts={[10, 20, 50, 100]}
                onChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          )}
        </div>
      </div>

      <AddEditSubscriptionModal
        visible={showEdit}
        handleClose={closeEdit}
        editingPlan={editingPlan}
        placement={sheetPlacement}
        refresh={refresh}
        t={t}
      />
      <SubscriptionCodesModal visible={!!codesPlan} plan={codesPlan} onClose={() => setCodesPlan(null)} t={t} />
    </div>
  );
};

export default SubscriptionsPage;
