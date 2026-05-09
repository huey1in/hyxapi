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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChevronDown, Loader2 } from 'lucide-react';
import ModalDialog from '../../../common/ModalDialog';
import { API, showError } from '../../../../helpers';
import { MOBILE_BREAKPOINT } from '../../../../hooks/common/useIsMobile';

const clampPercent = (value) => {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
};

const pickStrokeColor = (percent) => {
  const p = clampPercent(percent);
  if (p >= 95) return '#ef4444';
  if (p >= 80) return '#f59e0b';
  return '#3b82f6';
};

const normalizePlanType = (value) => {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
};

const getWindowDurationSeconds = (windowData) => {
  const value = Number(windowData?.limit_window_seconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
};

const classifyWindowByDuration = (windowData) => {
  const seconds = getWindowDurationSeconds(windowData);
  if (seconds == null) return null;
  return seconds >= 24 * 60 * 60 ? 'weekly' : 'fiveHour';
};

const resolveRateLimitWindows = (data) => {
  const rateLimit = data?.rate_limit ?? {};
  const primary = rateLimit?.primary_window ?? null;
  const secondary = rateLimit?.secondary_window ?? null;
  const windows = [primary, secondary].filter(Boolean);
  const planType = normalizePlanType(data?.plan_type ?? rateLimit?.plan_type);

  let fiveHourWindow = null;
  let weeklyWindow = null;

  for (const windowData of windows) {
    const bucket = classifyWindowByDuration(windowData);
    if (bucket === 'fiveHour' && !fiveHourWindow) {
      fiveHourWindow = windowData;
      continue;
    }
    if (bucket === 'weekly' && !weeklyWindow) {
      weeklyWindow = windowData;
    }
  }

  if (planType === 'free') {
    if (!weeklyWindow) {
      weeklyWindow = primary ?? secondary ?? null;
    }
    return { fiveHourWindow: null, weeklyWindow };
  }

  if (!fiveHourWindow && !weeklyWindow) {
    return {
      fiveHourWindow: primary ?? null,
      weeklyWindow: secondary ?? null,
    };
  }

  if (!fiveHourWindow) {
    fiveHourWindow =
      windows.find((windowData) => windowData !== weeklyWindow) ?? null;
  }
  if (!weeklyWindow) {
    weeklyWindow =
      windows.find((windowData) => windowData !== fiveHourWindow) ?? null;
  }

  return { fiveHourWindow, weeklyWindow };
};

const formatDurationSeconds = (seconds, t) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return '-';
  const total = Math.floor(s);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}${tt('小时')} ${minutes}${tt('分钟')}`;
  if (minutes > 0) return `${minutes}${tt('分钟')} ${secs}${tt('秒')}`;
  return `${secs}${tt('秒')}`;
};

const formatUnixSeconds = (unixSeconds) => {
  const v = Number(unixSeconds);
  if (!Number.isFinite(v) || v <= 0) return '-';
  try {
    return new Date(v * 1000).toLocaleString();
  } catch (error) {
    return String(unixSeconds);
  }
};

const getDisplayText = (value) => {
  if (value == null) return '';
  return String(value).trim();
};

const isMobileViewport = () =>
  typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;

const getCodexUsageModalWidth = () => {
  if (isMobileViewport()) return 'calc(100vw - 16px)';
  return 900;
};

const formatAccountTypeLabel = (value, t) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const normalized = normalizePlanType(value);
  switch (normalized) {
    case 'free':
      return 'Free';
    case 'plus':
      return 'Plus';
    case 'pro':
      return 'Pro';
    case 'team':
      return 'Team';
    case 'enterprise':
      return 'Enterprise';
    default:
      return getDisplayText(value) || tt('未识别');
  }
};

const TAG_COLOR_CLASSES = {
  green:
    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  cyan:
    'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  blue:
    'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  violet:
    'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  amber:
    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  grey:
    'bg-ui-bg-subtle text-ui-text-2 border-ui-border',
};

const Tag = ({ color = 'grey', children, className = '' }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-xl font-medium border ${
      TAG_COLOR_CLASSES[color] || TAG_COLOR_CLASSES.grey
    } ${className}`}
  >
    {children}
  </span>
);

const getAccountTypeTagColor = (value) => {
  const normalized = normalizePlanType(value);
  switch (normalized) {
    case 'enterprise':
      return 'green';
    case 'team':
      return 'cyan';
    case 'pro':
      return 'blue';
    case 'plus':
      return 'violet';
    case 'free':
      return 'amber';
    default:
      return 'grey';
  }
};

const resolveUsageStatusTag = (t, rateLimit) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  if (!rateLimit || Object.keys(rateLimit).length === 0) {
    return <Tag color='grey'>{tt('待确认')}</Tag>;
  }
  if (rateLimit?.allowed && !rateLimit?.limit_reached) {
    return <Tag color='green'>{tt('可用')}</Tag>;
  }
  return <Tag color='red'>{tt('受限')}</Tag>;
};

const Progress = ({ percent, stroke }) => {
  const p = clampPercent(percent);
  return (
    <div className='flex items-center gap-2'>
      <div className='flex-1 h-2 rounded-full bg-ui-bg-subtle overflow-hidden'>
        <div
          className='h-full rounded-full transition-all'
          style={{ width: `${p}%`, background: stroke || '#3b82f6' }}
        />
      </div>
      <span className='text-xs tabular-nums text-ui-text-2 min-w-[36px] text-right'>
        {p}%
      </span>
    </div>
  );
};

const AccountInfoValue = ({ t, label, value, onCopy, monospace = false }) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const text = getDisplayText(value);
  const hasValue = text !== '';

  return (
    <div className='flex min-w-0 items-start justify-between gap-2'>
      <div className='min-w-0 flex-shrink-0'>
        <div className='text-[11px] text-ui-text-3'>{label}</div>
      </div>
      <div className='flex items-start gap-2 min-w-0 flex-1 justify-end'>
        <div
          className={`min-w-0 break-all text-xs leading-5 text-ui-text ${
            monospace ? 'font-mono' : ''
          }`}
        >
          {hasValue ? text : '-'}
        </div>
        <button
          onClick={() => hasValue && onCopy?.(text)}
          disabled={!hasValue}
          className='shrink-0 px-2 py-0.5 text-[11px] rounded-xl border border-ui-border text-ui-text-2 hover:bg-ui-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
        >
          {tt('复制')}
        </button>
      </div>
    </div>
  );
};

const RateLimitWindowCard = ({ t, title, windowData }) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const hasWindowData =
    !!windowData &&
    typeof windowData === 'object' &&
    Object.keys(windowData).length > 0;
  const percent = clampPercent(windowData?.used_percent ?? 0);
  const resetAt = windowData?.reset_at;
  const resetAfterSeconds = windowData?.reset_after_seconds;
  const limitWindowSeconds = windowData?.limit_window_seconds;

  return (
    <div className='rounded-xl border border-ui-border bg-ui-bg-elevated p-3'>
      <div className='flex flex-wrap items-start justify-between gap-x-3 gap-y-1'>
        <div className='font-medium text-sm text-ui-text'>{title}</div>
        <span className='text-xs text-ui-text-3'>
          {tt('重置时间：')}
          {formatUnixSeconds(resetAt)}
        </span>
      </div>

      {hasWindowData ? (
        <div className='mt-2'>
          <Progress percent={percent} stroke={pickStrokeColor(percent)} />
        </div>
      ) : (
        <div className='mt-3 text-sm text-ui-text-2'>-</div>
      )}

      <div className='mt-1 flex flex-wrap items-center gap-2 text-xs text-ui-text-2'>
        <div>
          {tt('已使用：')}
          {hasWindowData ? `${percent}%` : '-'}
        </div>
        <div>
          {tt('距离重置：')}
          {hasWindowData ? formatDurationSeconds(resetAfterSeconds, tt) : '-'}
        </div>
        <div>
          {tt('窗口：')}
          {hasWindowData ? formatDurationSeconds(limitWindowSeconds, tt) : '-'}
        </div>
      </div>
    </div>
  );
};

const RateLimitWindowGrid = ({ t, fiveHourWindow, weeklyWindow }) => {
  const tt = typeof t === 'function' ? t : (v) => v;

  return (
    <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
      <RateLimitWindowCard
        t={tt}
        title={tt('5小时窗口')}
        windowData={fiveHourWindow}
      />
      <RateLimitWindowCard
        t={tt}
        title={tt('每周窗口')}
        windowData={weeklyWindow}
      />
    </div>
  );
};

const RateLimitGroupSection = ({
  t,
  title,
  description,
  rateLimitSource,
  statusTag,
  meteredFeature,
}) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const { fiveHourWindow, weeklyWindow } =
    resolveRateLimitWindows(rateLimitSource);
  const featureText = getDisplayText(meteredFeature);

  return (
    <section className='space-y-3'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0 space-y-2'>
          <div className='flex flex-wrap items-center gap-2'>
            <div className='text-sm font-semibold text-ui-text'>{title}</div>
            {statusTag}
          </div>
          {(description || featureText) && (
            <div className='flex flex-wrap items-center gap-2 text-xs text-ui-text-2'>
              {description ? <span>{description}</span> : null}
              {featureText ? (
                <div className='inline-flex max-w-full items-center gap-2 rounded-full bg-ui-bg-subtle px-2 py-1'>
                  <span className='text-[11px] text-ui-text-3'>
                    metered_feature
                  </span>
                  <span className='min-w-0 break-all font-mono text-xs text-ui-text'>
                    {featureText}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <RateLimitWindowGrid
        t={tt}
        fiveHourWindow={fiveHourWindow}
        weeklyWindow={weeklyWindow}
      />
    </section>
  );
};

const CodexUsageView = ({ t, record, payload, onCopy, onRefresh }) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const [showRawJson, setShowRawJson] = useState(false);
  const data = payload?.data ?? null;
  const rateLimit = data?.rate_limit ?? {};
  const additionalRateLimits = Array.isArray(data?.additional_rate_limits)
    ? data.additional_rate_limits.filter(
        (item) =>
          item && typeof item === 'object' && Object.keys(item).length > 0,
      )
    : [];
  const upstreamStatus = payload?.upstream_status;
  const accountType = data?.plan_type ?? rateLimit?.plan_type;
  const accountTypeLabel = formatAccountTypeLabel(accountType, tt);
  const accountTypeTagColor = getAccountTypeTagColor(accountType);
  const statusTag = resolveUsageStatusTag(tt, rateLimit);
  const userId = data?.user_id;
  const email = data?.email;
  const accountId = data?.account_id;
  const errorMessage =
    payload?.success === false
      ? getDisplayText(payload?.message) || tt('获取用量失败')
      : '';

  const rawText =
    typeof data === 'string' ? data : JSON.stringify(data ?? payload, null, 2);

  return (
    <div className='flex flex-col gap-4'>
      {errorMessage && (
        <div className='rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400'>
          {errorMessage}
        </div>
      )}

      <div className='rounded-xl border border-ui-border bg-ui-bg-elevated p-3'>
        <div className='flex flex-wrap items-start justify-between gap-2'>
          <div className='min-w-0'>
            <div className='text-xs font-medium text-ui-text-2'>
              {tt('Codex 帐号')}
            </div>
            <div className='mt-2 flex flex-wrap items-center gap-2'>
              <Tag color={accountTypeTagColor} className='font-semibold'>
                {accountTypeLabel}
              </Tag>
              {statusTag}
              <Tag color='grey'>
                {tt('上游状态码：')}
                {upstreamStatus ?? '-'}
              </Tag>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className='inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            {tt('刷新')}
          </button>
        </div>

        <div className='mt-2 rounded-lg bg-ui-bg-subtle px-3 py-2 space-y-2'>
          <AccountInfoValue
            t={tt}
            label='User ID'
            value={userId}
            onCopy={onCopy}
            monospace={true}
          />
          <AccountInfoValue
            t={tt}
            label={tt('邮箱')}
            value={email}
            onCopy={onCopy}
          />
          <AccountInfoValue
            t={tt}
            label='Account ID'
            value={accountId}
            onCopy={onCopy}
            monospace={true}
          />
        </div>

        <div className='mt-2 text-xs text-ui-text-2'>
          {tt('渠道：')}
          {record?.name || '-'} ({tt('编号：')}
          {record?.id || '-'})
        </div>
      </div>

      <div>
        <div className='mb-2'>
          <div className='text-sm font-semibold text-ui-text'>
            {tt('额度窗口')}
          </div>
          <span className='text-xs text-ui-text-3'>
            {tt(
              '用于观察当前帐号在 Codex 上游的基础限额与附加计费能力使用情况',
            )}
          </span>
        </div>
      </div>

      <div className='space-y-5'>
        <RateLimitGroupSection
          t={tt}
          title={tt('基础额度')}
          description={tt('当前帐号的基础额度窗口')}
          rateLimitSource={data}
          statusTag={statusTag}
        />

        {additionalRateLimits.length > 0 ? (
          <div className='space-y-4 border-t border-ui-border pt-4'>
            <div>
              <div className='text-sm font-semibold text-ui-text'>
                {tt('附加额度')}
              </div>
              <span className='text-xs text-ui-text-3'>
                {tt('按模型或能力拆分的附加计费能力窗口')}
              </span>
            </div>

            <div className='space-y-4'>
              {additionalRateLimits.map((item, index) => {
                const limitName =
                  getDisplayText(item?.limit_name) ||
                  getDisplayText(item?.metered_feature) ||
                  `${tt('附加额度')} ${index + 1}`;

                return (
                  <div
                    key={`${limitName}-${getDisplayText(item?.metered_feature)}-${index}`}
                    className={
                      index > 0 ? 'border-t border-ui-border pt-4' : ''
                    }
                  >
                    <RateLimitGroupSection
                      t={tt}
                      title={limitName}
                      description={tt('附加计费能力')}
                      rateLimitSource={item}
                      statusTag={resolveUsageStatusTag(tt, item?.rate_limit)}
                      meteredFeature={item?.metered_feature}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* Collapsible raw JSON */}
      <div className='border border-ui-border rounded-xl overflow-hidden'>
        <button
          onClick={() => setShowRawJson((p) => !p)}
          className='flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-ui-text hover:bg-ui-bg-subtle transition-colors'
        >
          <span>{tt('原始 JSON')}</span>
          <ChevronDown
            size={14}
            className={`text-ui-text-3 transition-transform ${
              showRawJson ? 'rotate-180' : ''
            }`}
          />
        </button>
        {showRawJson && (
          <div className='border-t border-ui-border p-3'>
            <div className='mb-2 flex justify-end'>
              <button
                onClick={() => onCopy?.(rawText)}
                disabled={!rawText}
                className='inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                {tt('复制')}
              </button>
            </div>
            <pre className='max-h-[50vh] overflow-y-auto rounded-lg bg-ui-bg-subtle p-3 text-xs text-ui-text'>
              {rawText}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

const CodexUsageLoader = ({ t, record, initialPayload, onCopy }) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const [loading, setLoading] = useState(!initialPayload);
  const [payload, setPayload] = useState(initialPayload ?? null);
  const hasShownErrorRef = useRef(false);
  const mountedRef = useRef(true);
  const recordId = record?.id;

  const fetchUsage = useCallback(async () => {
    if (!recordId) {
      if (mountedRef.current) setPayload(null);
      return;
    }

    if (mountedRef.current) setLoading(true);
    try {
      const res = await API.get(`/api/channel/${recordId}/codex/usage`, {
        skipErrorHandler: true,
      });
      if (!mountedRef.current) return;
      setPayload(res?.data ?? null);
      if (!res?.data?.success && !hasShownErrorRef.current) {
        hasShownErrorRef.current = true;
        showError(tt('获取用量失败'));
      }
    } catch (error) {
      if (!mountedRef.current) return;
      if (!hasShownErrorRef.current) {
        hasShownErrorRef.current = true;
        showError(tt('获取用量失败'));
      }
      setPayload({ success: false, message: String(error) });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [recordId, tt]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (initialPayload) return;
    fetchUsage().catch(() => {});
  }, [fetchUsage, initialPayload]);

  if (loading) {
    return (
      <div className='flex items-center justify-center py-10 gap-2 text-ui-text-2'>
        <Loader2 size={20} className='animate-spin' />
        <span>{tt('加载中...')}</span>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className='flex flex-col gap-3'>
        <span className='text-sm text-ui-danger'>{tt('获取用量失败')}</span>
        <div className='flex justify-end'>
          <button
            onClick={fetchUsage}
            className='inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            {tt('刷新')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <CodexUsageView
      t={tt}
      record={record}
      payload={payload}
      onCopy={onCopy}
      onRefresh={fetchUsage}
    />
  );
};

const CodexUsageHost = ({ t, record, payload, onCopy, onClose }) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const [open, setOpen] = useState(true);
  const handleClose = () => {
    setOpen(false);
    setTimeout(() => onClose?.(), 0);
  };
  return (
    <ModalDialog
      open={open}
      onClose={handleClose}
      title={tt('Codex 帐号与用量')}
      width={getCodexUsageModalWidth()}
      footer={
        <button
          onClick={handleClose}
          className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors'
        >
          {tt('关闭')}
        </button>
      }
    >
      <CodexUsageLoader
        t={tt}
        record={record}
        initialPayload={payload}
        onCopy={onCopy}
      />
    </ModalDialog>
  );
};

export const openCodexUsageModal = ({ t, record, payload, onCopy }) => {
  if (typeof document === 'undefined') return;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onClose = () => {
    root.unmount();
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  };
  root.render(
    <CodexUsageHost
      t={t}
      record={record}
      payload={payload}
      onCopy={onCopy}
      onClose={onClose}
    />,
  );
};
