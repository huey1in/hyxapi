/*
 * Subscription plans admin page — token-system rewrite.
 */
import React, { useState } from 'react';
import { Plus, RefreshCw, Info } from 'lucide-react';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { useSubscriptionsData } from '../../../hooks/subscriptions/useSubscriptionsData';
import Pagination from '../../common/table/Pagination';
import { Notice } from '../../common/form/Primitives';
import SubscriptionsTable from './SubscriptionsTable';
import AddEditSubscriptionModal from './modals/AddEditSubscriptionModal';
import SubscriptionCodesModal from './modals/SubscriptionCodesModal';

const SubscriptionsPage = () => {
  const data = useSubscriptionsData();
  const isMobile = useIsMobile();
  const [codesPlan, setCodesPlan] = useState(null);

  const {
    showEdit,
    editingPlan,
    sheetPlacement,
    closeEdit,
    refresh,
    openCreate,
    plans,
    planCount,
    activePage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    loading,
    t,
  } = data;

  return (
    <div className='min-h-[calc(100vh-4rem)] mt-16 px-4 py-5 md:px-6 md:py-6 bg-ui-bg'>
      <div className='max-w-[1400px] mx-auto'>
        {/* Header */}
        <div className='flex items-center justify-between gap-3 mb-5'>
          <h1
            className='text-2xl md:text-3xl font-medium text-ui-text'
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
          >
            {t('订阅管理')}
          </h1>
        </div>

        {/* Actions card */}
        <div className='bg-ui-bg-elevated border border-ui-border rounded-xl p-3 mb-3 flex flex-col md:flex-row md:items-center justify-between gap-2'>
          <div className='flex items-center gap-1.5'>
            <button
              onClick={openCreate}
              className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover active:scale-95 transition-all whitespace-nowrap'
            >
              <Plus size={12} />
              {t('新建套餐')}
            </button>
            <button
              onClick={refresh}
              disabled={loading}
              className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors whitespace-nowrap disabled:opacity-50'
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              {t('刷新')}
            </button>
          </div>
          <Notice kind='info' icon={<Info size={14} className='text-blue-500' />}>
            {t('用户在「钱包管理」中输入兑换码即可激活对应订阅')}
          </Notice>
        </div>

        {/* Table card */}
        <div className='bg-ui-bg-elevated border border-ui-border rounded-xl overflow-hidden'>
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

      <SubscriptionCodesModal
        visible={!!codesPlan}
        plan={codesPlan}
        onClose={() => setCodesPlan(null)}
        t={t}
      />
    </div>
  );
};

export default SubscriptionsPage;
