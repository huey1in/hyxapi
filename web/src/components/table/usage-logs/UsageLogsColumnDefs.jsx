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
import {
  renderGroup,
  renderQuota,
  stringToColor,
  getLogOther,
  renderModelTag,
  renderModelPriceSimple,
} from '../../../helpers';
import { CircleAlert, Route, Sparkles, HelpCircle } from 'lucide-react';

const colors = [
  'amber',
  'blue',
  'cyan',
  'green',
  'grey',
  'indigo',
  'light-blue',
  'lime',
  'orange',
  'pink',
  'purple',
  'red',
  'teal',
  'violet',
  'yellow',
];

function formatRatio(ratio) {
  if (ratio === undefined || ratio === null) {
    return '-';
  }
  if (typeof ratio === 'number') {
    return ratio.toFixed(4);
  }
  return String(ratio);
}

function buildChannelAffinityTooltip(affinity, t) {
  if (!affinity) {
    return null;
  }

  const keySource = affinity.key_source || '-';
  const keyPath = affinity.key_path || affinity.key_key || '-';
  const keyHint = affinity.key_hint || '';
  const keyFp = affinity.key_fp ? `#${affinity.key_fp}` : '';
  const keyText = `${keySource}:${keyPath}${keyFp}`;

  const lines = [
    t('渠道亲和性'),
    `${t('规则')}：${affinity.rule_name || '-'}`,
    `${t('分组')}：${affinity.selected_group || '-'}`,
    `${t('Key')}：${keyText}`,
    ...(keyHint ? [`${t('Key 摘要')}：${keyHint}`] : []),
  ];

  return (
    <div style={{ lineHeight: 1.6, display: 'flex', flexDirection: 'column' }}>
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

// Render functions
function renderType(type, t) {
  const tagMap = {
    1: { cls: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20', text: t('充值') },
    2: { cls: 'bg-lime-500/10 text-lime-600 dark:text-lime-400 border-lime-500/20', text: t('消费') },
    3: { cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20', text: t('管理') },
    4: { cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', text: t('系统') },
    5: { cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', text: t('错误') },
    6: { cls: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20', text: t('退款') },
  };
  const tag = tagMap[type] || { cls: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20', text: t('未知') };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium border ${tag.cls}`}>
      {tag.text}
    </span>
  );
}

function buildStreamStatusTooltipText(ss, t) {
  if (!ss) return null;
  const lines = [
    t('流状态') + '：' + t('异常'),
    (ss.end_reason || 'unknown'),
  ];
  if (ss.error_count > 0) {
    lines.push(`${t('软错误')}: ${ss.error_count}`);
  }
  if (ss.end_error) {
    lines.push(ss.end_error);
  }
  return lines.join('\n');
}

function renderIsStream(bool, t, streamStatus) {
  const isError = streamStatus && streamStatus.status !== 'ok';

  if (bool) {
    return (
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400'>
          {t('流')}
        </span>
        {isError && (
          <span
            title={buildStreamStatusTooltipText(streamStatus, t)}
            style={{
              position: 'absolute',
              right: -4,
              top: -4,
              lineHeight: 1,
              color: '#ef4444',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <CircleAlert
              size={14}
              strokeWidth={2.5}
              color='currentColor'
            />
          </span>
        )}
      </span>
    );
  } else {
    return (
      <span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'>
        {t('非流')}
      </span>
    );
  }
}

function renderUseTime(type, t) {
  const time = parseInt(type);
  let cls = 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
  if (time >= 300) {
    cls = 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
  } else if (time >= 101) {
    cls = 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium border ${cls}`}>
      {time} s
    </span>
  );
}

function renderFirstUseTime(type, t) {
  let time = parseFloat(type) / 1000.0;
  time = time.toFixed(1);
  let cls = 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
  if (time >= 10) {
    cls = 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
  } else if (time >= 3) {
    cls = 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium border ${cls}`}>
      {time} s
    </span>
  );
}

function renderBillingTag(record, t) {
  const other = getLogOther(record.other);
  if (other?.billing_source === 'subscription') {
    return (
      <span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'>
        {t('订阅抵扣')}
      </span>
    );
  }
  return null;
}

function renderModelName(record, copyText, t) {
  let other = getLogOther(record.other);
  let modelMapped =
    other?.is_model_mapped &&
    other?.upstream_model_name &&
    other?.upstream_model_name !== '';
  if (!modelMapped) {
    return renderModelTag(record.model_name, {
      onClick: (event) => {
        copyText(event, record.model_name).then((r) => {});
      },
    });
  } else {
    return (
      <span
        title={`${t('请求并计费模型')}: ${record.model_name}\n${t('实际模型')}: ${other.upstream_model_name}`}
      >
        {renderModelTag(record.model_name, {
          onClick: (event) => {
            copyText(event, record.model_name).then((r) => {});
          },
          suffixIcon: (
            <Route
              style={{ width: '0.9em', height: '0.9em', opacity: 0.75 }}
            />
          ),
        })}
      </span>
    );
  }
}

function toTokenNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed;
}

function formatTokenCount(value) {
  return toTokenNumber(value).toLocaleString();
}

function getPromptCacheSummary(other) {
  if (!other || typeof other !== 'object') {
    return null;
  }

  const cacheReadTokens = toTokenNumber(other.cache_tokens);
  const cacheCreationTokens = toTokenNumber(other.cache_creation_tokens);
  const cacheCreationTokens5m = toTokenNumber(other.cache_creation_tokens_5m);
  const cacheCreationTokens1h = toTokenNumber(other.cache_creation_tokens_1h);

  const hasSplitCacheCreation =
    cacheCreationTokens5m > 0 || cacheCreationTokens1h > 0;
  const cacheWriteTokens = hasSplitCacheCreation
    ? cacheCreationTokens5m + cacheCreationTokens1h
    : cacheCreationTokens;

  if (cacheReadTokens <= 0 && cacheWriteTokens <= 0) {
    return null;
  }

  return {
    cacheReadTokens,
    cacheWriteTokens,
  };
}

function normalizeDetailText(detail) {
  return String(detail || '')
    .replace(/\n\r/g, '\n')
    .replace(/\r\n/g, '\n');
}

function getUsageLogGroupSummary(groupRatio, userGroupRatio, t) {
  const parsedUserGroupRatio = Number(userGroupRatio);
  const useUserGroupRatio =
    Number.isFinite(parsedUserGroupRatio) && parsedUserGroupRatio !== -1;
  const ratio = useUserGroupRatio ? userGroupRatio : groupRatio;
  if (ratio === undefined || ratio === null || ratio === '') {
    return '';
  }
  return `${useUserGroupRatio ? t('专属倍率') : t('分组')} ${formatRatio(ratio)}x`;
}

function renderCompactDetailSummary(summarySegments) {
  const segments = Array.isArray(summarySegments)
    ? summarySegments.filter((segment) => segment?.text)
    : [];
  if (!segments.length) {
    return null;
  }

  return (
    <div
      style={{
        maxWidth: 180,
        lineHeight: 1.35,
      }}
    >
      {segments.map((segment, index) => (
        <span
          key={`${segment.text}-${index}`}
          className={segment.tone === 'secondary' ? 'text-ui-text-3' : 'text-ui-text-2'}
          style={{
            display: 'block',
            maxWidth: '100%',
            fontSize: segment.tone === 'secondary' ? 11 : 12,
            marginTop: index === 0 ? 0 : 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {segment.text}
        </span>
      ))}
    </div>
  );
}

function getUsageLogDetailSummary(record, text, billingDisplayMode, t) {
  const other = getLogOther(record.other);

  if (record.type === 6) {
    return {
      segments: [{ text: t('异步任务退款'), tone: 'primary' }],
    };
  }

  if (other == null || record.type !== 2) {
    return null;
  }

  if (
    other?.violation_fee === true ||
    Boolean(other?.violation_fee_code) ||
    Boolean(other?.violation_fee_marker)
  ) {
    const feeQuota = other?.fee_quota ?? record?.quota;
    const groupText = getUsageLogGroupSummary(
      other?.group_ratio,
      other?.user_group_ratio,
      t,
    );
    return {
      segments: [
        groupText ? { text: groupText, tone: 'primary' } : null,
        { text: t('违规扣费'), tone: 'primary' },
        {
          text: `${t('扣费')}：${renderQuota(feeQuota, 6)}`,
          tone: 'secondary',
        },
        text ? { text: `${t('详情')}：${text}`, tone: 'secondary' } : null,
      ].filter(Boolean),
    };
  }

  return {
    segments: other?.claude
      ? renderModelPriceSimple(
          other.model_ratio,
          other.model_price,
          other.group_ratio,
          other?.user_group_ratio,
          other.cache_tokens || 0,
          other.cache_ratio || 1.0,
          other.cache_creation_tokens || 0,
          other.cache_creation_ratio || 1.0,
          other.cache_creation_tokens_5m || 0,
          other.cache_creation_ratio_5m || other.cache_creation_ratio || 1.0,
          other.cache_creation_tokens_1h || 0,
          other.cache_creation_ratio_1h || other.cache_creation_ratio || 1.0,
          false,
          1.0,
          other?.is_system_prompt_overwritten,
          'claude',
          billingDisplayMode,
          'segments',
        )
      : renderModelPriceSimple(
          other.model_ratio,
          other.model_price,
          other.group_ratio,
          other?.user_group_ratio,
          other.cache_tokens || 0,
          other.cache_ratio || 1.0,
          0,
          1.0,
          0,
          1.0,
          0,
          1.0,
          false,
          1.0,
          other?.is_system_prompt_overwritten,
          'openai',
          billingDisplayMode,
          'segments',
        ),
  };
}

export const getLogsColumns = ({
  t,
  COLUMN_KEYS,
  copyText,
  showUserInfoFunc,
  openChannelAffinityUsageCacheModal,
  isAdminUser,
  billingDisplayMode = 'price',
}) => {
  return [
    {
      key: COLUMN_KEYS.TIME,
      title: t('时间'),
      dataIndex: 'timestamp2string',
    },
    {
      key: COLUMN_KEYS.CHANNEL,
      title: t('渠道'),
      dataIndex: 'channel',
      render: (text, record, index) => {
        let isMultiKey = false;
        let multiKeyIndex = -1;
        let content = t('渠道') + `：${record.channel}`;
        let affinity = null;
        let showMarker = false;
        let other = getLogOther(record.other);
        if (other?.admin_info) {
          let adminInfo = other.admin_info;
          if (adminInfo?.is_multi_key) {
            isMultiKey = true;
            multiKeyIndex = adminInfo.multi_key_index;
          }
          if (
            Array.isArray(adminInfo.use_channel) &&
            adminInfo.use_channel.length > 0
          ) {
            content = t('渠道') + `：${adminInfo.use_channel.join('->')}`;
          }
          if (adminInfo.channel_affinity) {
            affinity = adminInfo.channel_affinity;
            showMarker = true;
          }
        }

        return isAdminUser &&
          (record.type === 0 ||
            record.type === 2 ||
            record.type === 5 ||
            record.type === 6) ? (
          <div className='flex items-center gap-1'>
            <span style={{ position: 'relative', display: 'inline-block' }}>
              <span
                title={record.channel_name || t('未知渠道')}
                className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium border bg-${colors[parseInt(text) % colors.length]}-500/10 text-${colors[parseInt(text) % colors.length]}-600 dark:text-${colors[parseInt(text) % colors.length]}-400 border-${colors[parseInt(text) % colors.length]}-500/20`}
                style={{ cursor: 'default' }}
              >
                {text}
              </span>
              {showMarker && (
                <span
                  title={content}
                  style={{
                    position: 'absolute',
                    right: -4,
                    top: -4,
                    lineHeight: 1,
                    fontWeight: 600,
                    color: '#f59e0b',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    openChannelAffinityUsageCacheModal?.(affinity);
                  }}
                >
                  <Sparkles
                    size={14}
                    strokeWidth={2}
                    color='currentColor'
                    fill='currentColor'
                  />
                </span>
              )}
            </span>
            {isMultiKey && (
              <span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20'>
                {multiKeyIndex}
              </span>
            )}
          </div>
        ) : null;
      },
    },
    {
      key: COLUMN_KEYS.USERNAME,
      title: t('用户'),
      dataIndex: 'username',
      render: (text, record, index) => {
        return isAdminUser ? (
          <div className='flex items-center gap-1'>
            <span
              className='inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-medium text-white cursor-pointer'
              style={{ backgroundColor: stringToColor(text), marginRight: 4 }}
              onClick={(event) => {
                event.stopPropagation();
                showUserInfoFunc(record.user_id);
              }}
            >
              {typeof text === 'string' && text.slice(0, 1)}
            </span>
            {text}
          </div>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.TOKEN,
      title: t('令牌'),
      dataIndex: 'token_name',
      render: (text, record, index) => {
        return record.type === 0 ||
          record.type === 2 ||
          record.type === 5 ||
          record.type === 6 ? (
          <div>
            <span
              className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20 cursor-pointer'
              onClick={(event) => {
                copyText(event, text);
              }}
            >
              {t(text)}
            </span>
          </div>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.GROUP,
      title: t('分组'),
      dataIndex: 'group',
      render: (text, record, index) => {
        if (
          record.type === 0 ||
          record.type === 2 ||
          record.type === 5 ||
          record.type === 6
        ) {
          if (record.group) {
            return <>{renderGroup(record.group)}</>;
          } else {
            let other = null;
            try {
              other = JSON.parse(record.other);
            } catch (e) {
              console.error(
                `Failed to parse record.other: "${record.other}".`,
                e,
              );
            }
            if (other === null) {
              return <></>;
            }
            if (other.group !== undefined) {
              return <>{renderGroup(other.group)}</>;
            } else {
              return <></>;
            }
          }
        } else {
          return <></>;
        }
      },
    },
    {
      key: COLUMN_KEYS.TYPE,
      title: t('类型'),
      dataIndex: 'type',
      render: (text, record, index) => {
        return <>{renderType(text, t)}</>;
      },
    },
    {
      key: COLUMN_KEYS.MODEL,
      title: t('模型'),
      dataIndex: 'model_name',
      render: (text, record, index) => {
        return record.type === 0 ||
          record.type === 2 ||
          record.type === 5 ||
          record.type === 6 ? (
          <>{renderModelName(record, copyText, t)}</>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.USE_TIME,
      title: t('用时/首字'),
      dataIndex: 'use_time',
      render: (text, record, index) => {
        if (!(record.type === 2 || record.type === 5)) {
          return <></>;
        }
        if (record.is_stream) {
          let other = getLogOther(record.other);
          return (
            <div className='flex items-center gap-1 flex-wrap'>
              {renderUseTime(text, t)}
              {renderFirstUseTime(other?.frt, t)}
              {renderIsStream(record.is_stream, t, other?.stream_status)}
            </div>
          );
        } else {
          return (
            <div className='flex items-center gap-1 flex-wrap'>
              {renderUseTime(text, t)}
              {renderIsStream(record.is_stream, t)}
            </div>
          );
        }
      },
    },
    {
      key: COLUMN_KEYS.PROMPT,
      title: (
        <div className='flex items-center gap-1'>
          {t('输入')}
          <span
            title={t(
              '根据 Anthropic 协定，/v1/messages 的输入 tokens 仅统计非缓存输入，不包含缓存读取与缓存写入 tokens。',
            )}
          >
            <HelpCircle size={12} className='text-ui-text-3 cursor-help' />
          </span>
        </div>
      ),
      dataIndex: 'prompt_tokens',
      render: (text, record, index) => {
        const other = getLogOther(record.other);
        const cacheSummary = getPromptCacheSummary(other);
        const hasCacheRead = (cacheSummary?.cacheReadTokens || 0) > 0;
        const hasCacheWrite = (cacheSummary?.cacheWriteTokens || 0) > 0;
        let cacheText = '';
        if (hasCacheRead && hasCacheWrite) {
          cacheText = `${t('缓存读')} ${formatTokenCount(cacheSummary.cacheReadTokens)} · ${t('写')} ${formatTokenCount(cacheSummary.cacheWriteTokens)}`;
        } else if (hasCacheRead) {
          cacheText = `${t('缓存读')} ${formatTokenCount(cacheSummary.cacheReadTokens)}`;
        } else if (hasCacheWrite) {
          cacheText = `${t('缓存写')} ${formatTokenCount(cacheSummary.cacheWriteTokens)}`;
        }

        return record.type === 0 ||
          record.type === 2 ||
          record.type === 5 ||
          record.type === 6 ? (
          <div
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              lineHeight: 1.2,
            }}
          >
            <span>{text}</span>
            {cacheText ? (
              <span
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  color: 'var(--color-ui-text-3, #888)',
                  whiteSpace: 'nowrap',
                }}
              >
                {cacheText}
              </span>
            ) : null}
          </div>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.COMPLETION,
      title: t('输出'),
      dataIndex: 'completion_tokens',
      render: (text, record, index) => {
        return parseInt(text) > 0 &&
          (record.type === 0 ||
            record.type === 2 ||
            record.type === 5 ||
            record.type === 6) ? (
          <>{<span> {text} </span>}</>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.COST,
      title: t('花费'),
      dataIndex: 'quota',
      render: (text, record, index) => {
        if (
          !(
            record.type === 0 ||
            record.type === 2 ||
            record.type === 5 ||
            record.type === 6
          )
        ) {
          return <></>;
        }
        const other = getLogOther(record.other);
        const isSubscription = other?.billing_source === 'subscription';
        if (isSubscription) {
          // Subscription billed: show only tag (no $0), but keep tooltip for equivalent cost.
          return (
            <span title={`${t('由订阅抵扣')}：${renderQuota(text, 6)}`}>
              {renderBillingTag(record, t)}
            </span>
          );
        }
        return <>{renderQuota(text, 6)}</>;
      },
    },
    {
      key: COLUMN_KEYS.IP,
      title: (
        <div className='flex items-center gap-1'>
          {t('IP')}
          <span
            title={t(
              '只有当用户设置开启IP记录时，才会进行请求和错误类型日志的IP记录',
            )}
          >
            <HelpCircle size={12} className='text-ui-text-3 cursor-help' />
          </span>
        </div>
      ),
      dataIndex: 'ip',
      render: (text, record, index) => {
        const showIp =
          (record.type === 2 ||
            record.type === 5 ||
            (isAdminUser && record.type === 1)) &&
          text;
        return showIp ? (
          <span
            title={text}
            className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 cursor-pointer'
            onClick={(event) => {
              copyText(event, text);
            }}
          >
            {text}
          </span>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.RETRY,
      title: t('重试'),
      dataIndex: 'retry',
      render: (text, record, index) => {
        if (!(record.type === 2 || record.type === 5)) {
          return <></>;
        }
        let content = t('渠道') + `：${record.channel}`;
        if (record.other !== '') {
          let other = JSON.parse(record.other);
          if (other === null) {
            return <></>;
          }
          if (other.admin_info !== undefined) {
            if (
              other.admin_info.use_channel !== null &&
              other.admin_info.use_channel !== undefined &&
              other.admin_info.use_channel !== ''
            ) {
              let useChannel = other.admin_info.use_channel;
              let useChannelStr = useChannel.join('->');
              content = t('渠道') + `：${useChannelStr}`;
            }
          }
        }
        return isAdminUser ? <div>{content}</div> : <></>;
      },
    },
    {
      key: COLUMN_KEYS.DETAILS,
      title: t('详情'),
      dataIndex: 'content',
      fixed: 'right',
      width: 200,
      render: (text, record, index) => {
        const detailSummary = getUsageLogDetailSummary(
          record,
          text,
          billingDisplayMode,
          t,
        );

        if (!detailSummary) {
          return (
            <div
              className='text-sm text-ui-text-2'
              style={{
                maxWidth: 200,
                marginBottom: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
              title={text}
            >
              {text}
            </div>
          );
        }

        return renderCompactDetailSummary(detailSummary.segments);
      },
    },
  ];
};
