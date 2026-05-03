/*
 * 模型定价可视化编辑器 — token-system rewrite.
 */
import React from 'react';
import ModelPricingEditor from './components/ModelPricingEditor';

export default function ModelSettingsVisualEditor(props) {
  return <ModelPricingEditor options={props.options} refresh={props.refresh} />;
}
