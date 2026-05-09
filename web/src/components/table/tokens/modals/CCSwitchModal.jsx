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
import React, { useState, useEffect, useMemo } from 'react';
import ModalDialog from '../../../common/ModalDialog';
import { useTranslation } from 'react-i18next';
import { showError } from '../../../../helpers';

const APP_CONFIGS = {
  claude: {
    label: 'Claude',
    defaultName: 'My Claude',
    modelFields: [
      { key: 'model', label: '主模型' },
      { key: 'haikuModel', label: 'Haiku 模型' },
      { key: 'sonnetModel', label: 'Sonnet 模型' },
      { key: 'opusModel', label: 'Opus 模型' },
    ],
  },
  codex: {
    label: 'Codex',
    defaultName: 'My Codex',
    modelFields: [{ key: 'model', label: '主模型' }],
  },
  gemini: {
    label: 'Gemini',
    defaultName: 'My Gemini',
    modelFields: [{ key: 'model', label: '主模型' }],
  },
};

function getServerAddress() {
  try {
    const raw = localStorage.getItem('status');
    if (raw) {
      const status = JSON.parse(raw);
      if (status.server_address) return status.server_address;
    }
  } catch (_) {}
  return window.location.origin;
}

function buildCCSwitchURL(app, name, models, apiKey) {
  const serverAddress = getServerAddress();
  const endpoint = app === 'codex' ? serverAddress + '/v1' : serverAddress;
  const params = new URLSearchParams();
  params.set('resource', 'provider');
  params.set('app', app);
  params.set('name', name);
  params.set('endpoint', endpoint);
  params.set('apiKey', apiKey);
  for (const [k, v] of Object.entries(models)) {
    if (v) params.set(k, v);
  }
  params.set('homepage', serverAddress);
  params.set('enabled', 'true');
  return `ccswitch://v1/import?${params.toString()}`;
}

export default function CCSwitchModal({
  visible,
  onClose,
  tokenKey,
  modelOptions,
}) {
  const { t } = useTranslation();
  const [app, setApp] = useState('claude');
  const [name, setName] = useState(APP_CONFIGS.claude.defaultName);
  const [models, setModels] = useState({});

  const currentConfig = APP_CONFIGS[app];

  useEffect(() => {
    if (visible) {
      setModels({});
      setApp('claude');
      setName(APP_CONFIGS.claude.defaultName);
    }
  }, [visible]);

  const handleAppChange = (val) => {
    setApp(val);
    setName(APP_CONFIGS[val].defaultName);
    setModels({});
  };

  const handleModelChange = (field, value) => {
    setModels((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!models.model) {
      showError(t('请选择主模型'));
      return;
    }
    const url = buildCCSwitchURL(app, name, models, 'sk-' + tokenKey);
    window.open(url, '_blank');
    onClose();
  };

  const fieldLabelStyle = useMemo(
    () => ({
      marginBottom: 4,
      fontSize: 13,
    }),
    [],
  );

  return (
    <ModalDialog
      open={visible}
      onClose={onClose}
      title={t('填入 CC Switch')}
      width={480}
      footer={
        <>
          <button
            onClick={onClose}
            className='px-4 py-2 text-sm font-medium rounded-xl border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            {t('取消')}
          </button>
          <button
            onClick={handleSubmit}
            className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors'
          >
            {t('打开 CC Switch')}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={fieldLabelStyle} className='text-ui-text'>{t('应用')}</div>
          <div className='flex gap-1 p-1 bg-ui-bg-subtle rounded-xl'>
            {Object.entries(APP_CONFIGS).map(([key, cfg]) => (
              <button
                key={key}
                type='button'
                onClick={() => handleAppChange(key)}
                className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  app === key
                    ? 'bg-ui-bg-elevated text-ui-text font-medium shadow-sm'
                    : 'text-ui-text-2 hover:text-ui-text'
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={fieldLabelStyle} className='text-ui-text'>{t('名称')}</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={currentConfig.defaultName}
            className='w-full px-3.5 py-2 text-sm bg-transparent border border-ui-border rounded-xl text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3 transition-colors'
          />
        </div>

        {currentConfig.modelFields.map((field) => (
          <div key={field.key}>
            <div style={fieldLabelStyle} className='text-ui-text'>
              {t(field.label)}
              {field.key === 'model' && (
                <span className='text-ui-danger ml-1'>*</span>
              )}
            </div>
            <select
              value={models[field.key] || ''}
              onChange={(e) => handleModelChange(field.key, e.target.value || undefined)}
              className='w-full px-3.5 py-2 text-sm bg-transparent border border-ui-border rounded-xl text-ui-text outline-none focus:border-ui-text-3 transition-colors'
            >
              <option value=''>{t('请选择模型')}</option>
              {(modelOptions || []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {typeof opt.label === 'string' ? opt.label : opt.value}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </ModalDialog>
  );
}
