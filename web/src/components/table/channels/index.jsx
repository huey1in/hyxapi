/*
 * Channels page — minimalist token-system shell wrapping the existing table.
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import ChannelsTable from './ChannelsTable';
import ChannelsActions from './ChannelsActions';
import ChannelsFilters from './ChannelsFilters';
import ChannelsTabs from './ChannelsTabs';
import { useChannelsData } from '../../../hooks/channels/useChannelsData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import Pagination from '../../common/table/Pagination';
import BatchTagModal from './modals/BatchTagModal';
import ModelTestModal from './modals/ModelTestModal';
import ColumnSelectorModal from './modals/ColumnSelectorModal';
import EditChannelModal from './modals/EditChannelModal';
import EditTagModal from './modals/EditTagModal';
import MultiKeyManageModal from './modals/MultiKeyManageModal';
import ChannelUpstreamUpdateModal from './modals/ChannelUpstreamUpdateModal';

const ChannelsPage = () => {
  const channelsData = useChannelsData();
  const isMobile = useIsMobile();
  const t = channelsData.t;

  return (
    <div className='min-h-[calc(100vh-4rem)] mt-16 px-4 py-5 md:px-6 md:py-6 bg-ui-bg'>
      <div className='max-w-[1400px] mx-auto'>
        {/* Header */}
        <div className='flex items-center justify-between gap-3 mb-5'>
          <h1
            className='text-2xl md:text-3xl font-medium text-ui-text'
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
          >
            {t('渠道管理')}
          </h1>
        </div>

        {channelsData.globalPassThroughEnabled && (
          <div className='flex items-start gap-2 px-4 py-3 rounded-lg border border-amber-500/30 bg-amber-500/10 mb-3'>
            <AlertTriangle size={16} className='text-amber-500 flex-shrink-0 mt-0.5' />
            <div className='text-xs text-ui-text-2 leading-relaxed'>
              {t('已开启全局请求透传：参数覆写、模型重定向、渠道适配等 NewAPI 内置功能将失效，非最佳实践；如因此产生问题，请勿提交 issue 反馈。')}
            </div>
          </div>
        )}

        {/* Filters card (top) */}
        <div className='bg-ui-bg-elevated border border-ui-border rounded-xl p-3 mb-3 space-y-2.5'>
          <ChannelsFilters {...channelsData} />
          <div className='border-t border-ui-divider pt-2.5'>
            <ChannelsActions {...channelsData} />
          </div>
        </div>

        {/* Tabs */}
        {!channelsData.enableTagMode && (
          <div className='mb-3'>
            <ChannelsTabs {...channelsData} />
          </div>
        )}

        {/* Table card */}
        <div className='bg-ui-bg-elevated border border-ui-border rounded-xl overflow-hidden'>
          <ChannelsTable {...channelsData} />
          <div className='border-t border-ui-divider'>
            <Pagination
              page={channelsData.activePage}
              pageSize={channelsData.pageSize}
              total={channelsData.channelCount}
              pageSizeOpts={[10, 20, 50, 100]}
              onChange={channelsData.handlePageChange}
              onPageSizeChange={channelsData.handlePageSizeChange}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <ColumnSelectorModal {...channelsData} />
      <EditTagModal
        visible={channelsData.showEditTag}
        tag={channelsData.editingTag}
        handleClose={() => channelsData.setShowEditTag(false)}
        refresh={channelsData.refresh}
      />
      <EditChannelModal
        refresh={channelsData.refresh}
        visible={channelsData.showEdit}
        handleClose={channelsData.closeEdit}
        editingChannel={channelsData.editingChannel}
      />
      <BatchTagModal {...channelsData} />
      <ModelTestModal {...channelsData} />
      <MultiKeyManageModal
        visible={channelsData.showMultiKeyManageModal}
        onCancel={() => channelsData.setShowMultiKeyManageModal(false)}
        channel={channelsData.currentMultiKeyChannel}
        onRefresh={channelsData.refresh}
      />
      <ChannelUpstreamUpdateModal
        visible={channelsData.showUpstreamUpdateModal}
        addModels={channelsData.upstreamUpdateAddModels}
        removeModels={channelsData.upstreamUpdateRemoveModels}
        preferredTab={channelsData.upstreamUpdatePreferredTab}
        confirmLoading={channelsData.upstreamApplyLoading}
        onConfirm={channelsData.applyUpstreamUpdates}
        onCancel={channelsData.closeUpstreamUpdateModal}
      />
    </div>
  );
};

export default ChannelsPage;
