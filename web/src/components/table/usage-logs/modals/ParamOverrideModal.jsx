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

import React, { useMemo } from 'react';
import ModalDialog from '../../../common/ModalDialog';
import { Copy } from 'lucide-react';
import { copy, showError, showSuccess } from '../../../../helpers';
import { Button } from '../../../ui';

const parseAuditLine = (line) => {
  if (typeof line !== 'string') {
    return null;
  }
  const firstSpaceIndex = line.indexOf(' ');
  if (firstSpaceIndex <= 0) {
    return { action: line, content: line };
  }
  return {
    action: line.slice(0, firstSpaceIndex),
    content: line.slice(firstSpaceIndex + 1),
  };
};

const getActionLabel = (action, t) => {
  switch ((action || '').toLowerCase()) {
    case 'set':
      return t('设置');
    case 'delete':
      return t('删除');
    case 'copy':
      return t('复制');
    case 'move':
      return t('移动');
    case 'append':
      return t('追加');
    case 'prepend':
      return t('前置');
    case 'trim_prefix':
      return t('去前缀');
    case 'trim_suffix':
      return t('去后缀');
    case 'ensure_prefix':
      return t('保前缀');
    case 'ensure_suffix':
      return t('保后缀');
    case 'trim_space':
      return t('去空格');
    case 'to_lower':
      return t('转小写');
    case 'to_upper':
      return t('转大写');
    case 'replace':
      return t('替换');
    case 'regex_replace':
      return t('正则替换');
    case 'set_header':
      return t('设请求头');
    case 'delete_header':
      return t('删请求头');
    case 'copy_header':
      return t('复制请求头');
    case 'move_header':
      return t('移动请求头');
    case 'pass_headers':
      return t('透传请求头');
    case 'sync_fields':
      return t('同步字段');
    case 'return_error':
      return t('返回错误');
    default:
      return action;
  }
};

const ParamOverrideModal = ({
  showParamOverrideModal,
  setShowParamOverrideModal,
  paramOverrideTarget,
  t,
}) => {
  const lines = Array.isArray(paramOverrideTarget?.lines)
    ? paramOverrideTarget.lines
    : [];

  const parsedLines = useMemo(() => {
    return lines.map(parseAuditLine);
  }, [lines]);

  const copyAll = async () => {
    const content = lines.join('\n');
    if (!content) {
      return;
    }
    if (await copy(content)) {
      showSuccess(t('参数覆盖已复制'));
      return;
    }
    showError(t('无法复制到剪贴板，请手动复制'));
  };

  return (
    <ModalDialog
      open={showParamOverrideModal}
      onClose={() => setShowParamOverrideModal(false)}
      title={t('参数覆盖详情')}
      width={640}
      hideFooter
    >
      <div style={{ padding: '8px 20px 20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ marginBottom: 4 }}>
              <span className='text-sm font-semibold text-ui-text'>
                {t('{{count}} 项操作', { count: lines.length })}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                fontSize: 12,
              }}
            >
              {paramOverrideTarget?.modelName ? (
                <span className='text-xs text-ui-text-3'>
                  {paramOverrideTarget.modelName}
                </span>
              ) : null}
              {paramOverrideTarget?.requestId ? (
                <span className='text-xs text-ui-text-3'>
                  {t('Request ID')}: {paramOverrideTarget.requestId}
                </span>
              ) : null}
              {paramOverrideTarget?.requestPath ? (
                <span className='text-xs text-ui-text-3'>
                  {t('请求路径')}: {paramOverrideTarget.requestPath}
                </span>
              ) : null}
            </div>
          </div>

          <Button
            variant='ghost'
            size='sm'
            icon={Copy}
            onClick={copyAll}
            disabled={lines.length === 0}
          >
            {t('复制')}
          </Button>
        </div>

        <hr className='border-ui-divider my-3' />

        {lines.length === 0 ? (
          <div className='flex items-center justify-center py-6 text-sm text-ui-text-3'>
            {t('暂无参数覆盖记录')}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              maxHeight: '56vh',
              overflowY: 'auto',
              paddingRight: 2,
            }}
          >
            {parsedLines.map((item, index) => {
              if (!item) {
                return null;
              }

              return (
                <div
                  key={`${item.action}-${index}`}
                  className='flex gap-3 items-start p-3 rounded-xl border border-ui-border bg-ui-bg-subtle/30'
                >
                  <div className='flex-shrink-0 min-w-[74px]'>
                    <span className='inline-block text-[11px] font-bold leading-5 px-2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400'>
                      {getActionLabel(item.action, t)}
                    </span>
                  </div>
                  <span
                    className='flex-1 min-w-0 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-ui-text'
                  >
                    {item.content}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModalDialog>
  );
};

export default ParamOverrideModal;
