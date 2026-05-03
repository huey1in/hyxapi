/*
 * 模型定价编辑器（可视化 / 手动模式切换） — token-system rewrite.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ModelPricingEditor from './components/ModelPricingEditor';
import ModelRatioSettings from './ModelRatioSettings';
import { RadioChipGroup } from '../../../components/common/form/Primitives';

export default function ModelPricingCombined({ options, refresh }) {
  const { t } = useTranslation();
  const [editMode, setEditMode] = useState('visual');

  return (
    <div className='space-y-4'>
      <RadioChipGroup
        value={editMode}
        onChange={setEditMode}
        options={[
          { value: 'visual', label: t('可视化编辑') },
          { value: 'manual', label: t('手动编辑') },
        ]}
      />
      {editMode === 'visual' ? (
        <ModelPricingEditor options={options} refresh={refresh} />
      ) : (
        <ModelRatioSettings options={options} refresh={refresh} />
      )}
    </div>
  );
}
