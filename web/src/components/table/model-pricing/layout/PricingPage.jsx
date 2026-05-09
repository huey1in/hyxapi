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

import React from 'react';
import PricingSidebar from './PricingSidebar';
import PricingContent from './content/PricingContent';
import ModelDetailSideSheet from '../modal/ModelDetailSideSheet';
import { useModelPricingData } from '../../../../hooks/model-pricing/useModelPricingData';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const PricingPage = () => {
  const pricingData = useModelPricingData();
  const isMobile = useIsMobile();
  const [showRatio, setShowRatio] = React.useState(false);
  const [viewMode, setViewMode] = React.useState('card');
  const allProps = {
    ...pricingData,
    showRatio,
    setShowRatio,
    viewMode,
    setViewMode,
  };

  return (
    <div className='bg-ui-bg-elevated'>
      <div className='pricing-layout flex'>
        {!isMobile && (
          <aside className='pricing-scroll-hide pricing-sidebar'>
            <PricingSidebar {...allProps} />
          </aside>
        )}

        <main className='pricing-scroll-hide pricing-content flex-1'>
          <PricingContent
            {...allProps}
            isMobile={isMobile}
            sidebarProps={allProps}
          />
        </main>
      </div>

      {pricingData.isModalOpenurl && pricingData.modalImageUrl && (
        <div
          className='fixed inset-0 z-[300] flex items-center justify-center bg-black/70'
          onClick={() => pricingData.setIsModalOpenurl(false)}
        >
          <img
            src={pricingData.modalImageUrl}
            alt=''
            className='max-w-[90vw] max-h-[90vh] object-contain rounded-lg'
          />
        </div>
      )}

      <ModelDetailSideSheet
        visible={pricingData.showModelDetail}
        onClose={pricingData.closeModelDetail}
        modelData={pricingData.selectedModel}
        groupRatio={pricingData.groupRatio}
        usableGroup={pricingData.usableGroup}
        currency={pricingData.currency}
        siteDisplayType={pricingData.siteDisplayType}
        tokenUnit={pricingData.tokenUnit}
        displayPrice={pricingData.displayPrice}
        showRatio={allProps.showRatio}
        vendorsMap={pricingData.vendorsMap}
        endpointMap={pricingData.endpointMap}
        autoGroups={pricingData.autoGroups}
        t={pricingData.t}
      />
    </div>
  );
};

export default PricingPage;
