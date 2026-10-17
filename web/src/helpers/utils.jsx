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
import { showToast } from '../components/ui';
import { TABLE_COMPACT_MODES_KEY } from '../constants';

const HTMLToastContent = ({ htmlContent }) => {
  return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};
export default HTMLToastContent;
export function isAdmin() {
  let user = localStorage.getItem('user');
  if (!user) return false;
  user = JSON.parse(user);
  return user.role >= 10;
}

export function isRoot() {
  let user = localStorage.getItem('user');
  if (!user) return false;
  user = JSON.parse(user);
  return user.role >= 100;
}

export function getSystemName() {
  // Brand is hardcoded for the Routify build — do not read from server-side
  // Option/SystemName, which other operators may have set to "New API" etc.
  return 'Routify';
}

export function getLogo() {
  return '/logo.png';
}

export function getUserIdFromLocalStorage() {
  let user = localStorage.getItem('user');
  if (!user) return -1;
  user = JSON.parse(user);
  return user.id;
}

export function getFooterHTML() {
  // Brand is hardcoded for the TokenC build — fall through to the default
  // "基于 New API" footer rendered in components/layout/Footer.jsx.
  return null;
}

export async function copy(text) {
  // 优先使用异步剪贴板 API（需安全上下文 https/localhost）
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // 落回 execCommand 兼容方案（移动端 http 局域网 / 手势失效场景）
  }

  // iOS Safari 兼容：元素需在视口内、可编辑、非 readonly，并用 Range 选区
  try {
    const textarea = window.document.createElement('textarea');
    textarea.value = text;
    textarea.contentEditable = 'true';
    textarea.readOnly = false;
    Object.assign(textarea.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '1px',
      height: '1px',
      padding: '0',
      border: 'none',
      outline: 'none',
      boxShadow: 'none',
      background: 'transparent',
      fontSize: '16px', // 防止 iOS 聚焦时自动缩放
    });
    window.document.body.appendChild(textarea);
    textarea.focus();
    const range = window.document.createRange();
    range.selectNodeContents(textarea);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    textarea.setSelectionRange(0, text.length);
    const ok = window.document.execCommand('copy');
    window.document.body.removeChild(textarea);
    return ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export function showError(error) {
  console.error(error);
  if (error.message) {
    if (error.name === 'AxiosError') {
      switch (error.response.status) {
        case 401:
          // 由 api.js 的 handleUnauthorized 触发事件并统一跳转认证页。
          return;
        case 429:
          showToast({ type: 'error', message: '错误：请求次数过多，请稍后再试！' });
          break;
        case 500:
          showToast({ type: 'error', message: '错误：服务器内部错误，请联系管理员！' });
          break;
        case 405:
          showToast({ type: 'info', message: '本站仅作演示之用，无服务端！' });
          break;
        default:
          showToast({ type: 'error', message: '错误：' + error.message });
      }
      return;
    }
    showToast({ type: 'error', message: '错误：' + error.message });
  } else {
    showToast({ type: 'error', message: '错误：' + error });
  }
}

export function showWarning(message) {
  showToast({ type: 'warning', message });
}

export function showSuccess(message) {
  showToast({ type: 'success', message });
}

export function showInfo(message) {
  showToast({ type: 'info', message });
}

export function showNotice(message) {
  showToast({ type: 'info', message });
}

export function openPage(url) {
  window.open(url);
}

export function removeTrailingSlash(url) {
  if (!url) return '';
  if (url.endsWith('/')) {
    return url.slice(0, -1);
  } else {
    return url;
  }
}

export function getTodayStartTimestamp() {
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor(now.getTime() / 1000);
}

export function timestamp2string(timestamp) {
  let date = new Date(timestamp * 1000);
  let year = date.getFullYear().toString();
  let month = (date.getMonth() + 1).toString();
  let day = date.getDate().toString();
  let hour = date.getHours().toString();
  let minute = date.getMinutes().toString();
  let second = date.getSeconds().toString();
  if (month.length === 1) {
    month = '0' + month;
  }
  if (day.length === 1) {
    day = '0' + day;
  }
  if (hour.length === 1) {
    hour = '0' + hour;
  }
  if (minute.length === 1) {
    minute = '0' + minute;
  }
  if (second.length === 1) {
    second = '0' + second;
  }
  return (
    year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second
  );
}

export function timestamp2string1(
  timestamp,
  dataExportDefaultTime = 'hour',
  showYear = false,
) {
  let date = new Date(timestamp * 1000);
  let year = date.getFullYear();
  let month = (date.getMonth() + 1).toString();
  let day = date.getDate().toString();
  let hour = date.getHours().toString();
  if (month.length === 1) {
    month = '0' + month;
  }
  if (day.length === 1) {
    day = '0' + day;
  }
  if (hour.length === 1) {
    hour = '0' + hour;
  }
  // 仅在跨年时显示年份
  let str = showYear ? year + '-' + month + '-' + day : month + '-' + day;
  if (dataExportDefaultTime === 'hour') {
    str += ' ' + hour + ':00';
  } else if (dataExportDefaultTime === 'week') {
    let nextWeek = new Date(timestamp * 1000 + 6 * 24 * 60 * 60 * 1000);
    let nextWeekYear = nextWeek.getFullYear();
    let nextMonth = (nextWeek.getMonth() + 1).toString();
    let nextDay = nextWeek.getDate().toString();
    if (nextMonth.length === 1) {
      nextMonth = '0' + nextMonth;
    }
    if (nextDay.length === 1) {
      nextDay = '0' + nextDay;
    }
    // 周视图结束日期也仅在跨年时显示年份
    let nextStr = showYear
      ? nextWeekYear + '-' + nextMonth + '-' + nextDay
      : nextMonth + '-' + nextDay;
    str += ' - ' + nextStr;
  }
  return str;
}

// 检查时间戳数组是否跨年
export function isDataCrossYear(timestamps) {
  if (!timestamps || timestamps.length === 0) return false;
  const years = new Set(
    timestamps.map((ts) => new Date(ts * 1000).getFullYear()),
  );
  return years.size > 1;
}

export function downloadTextAsFile(text, filename) {
  let blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

export const verifyJSON = (str) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};

export function verifyJSONPromise(value) {
  try {
    JSON.parse(value);
    return Promise.resolve();
  } catch (e) {
    return Promise.reject('不是合法的 JSON 字符串');
  }
}

export function shouldShowPrompt(id) {
  let prompt = localStorage.getItem(`prompt-${id}`);
  return !prompt;
}

export function setPromptShown(id) {
  localStorage.setItem(`prompt-${id}`, 'true');
}

/**
 * 比较两个对象的属性，找出有变化的属性，并返回包含变化属性信息的数组
 * @param {Object} oldObject - 旧对象
 * @param {Object} newObject - 新对象
 * @return {Array} 包含变化属性信息的数组，每个元素是一个对象，包含 key, oldValue 和 newValue
 */
export function compareObjects(oldObject, newObject) {
  const changedProperties = [];

  // 比较两个对象的属性
  for (const key in oldObject) {
    if (oldObject.hasOwnProperty(key) && newObject.hasOwnProperty(key)) {
      if (oldObject[key] !== newObject[key]) {
        changedProperties.push({
          key: key,
          oldValue: oldObject[key],
          newValue: newObject[key],
        });
      }
    }
  }

  return changedProperties;
}

// 计算相对时间（几天前、几小时前等）
export const getRelativeTime = (publishDate) => {
  if (!publishDate) return '';

  const now = new Date();
  const pubDate = new Date(publishDate);

  // 如果日期无效，返回原始字符串
  if (isNaN(pubDate.getTime())) return publishDate;

  const diffMs = now.getTime() - pubDate.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  // 如果是未来时间，显示具体日期
  if (diffMs < 0) {
    return formatDateString(pubDate);
  }

  // 根据时间差返回相应的描述
  if (diffSeconds < 60) {
    return '刚刚';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours} 小时前`;
  } else if (diffDays < 7) {
    return `${diffDays} 天前`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks} 周前`;
  } else if (diffMonths < 12) {
    return `${diffMonths} 个月前`;
  } else if (diffYears < 2) {
    return '1 年前';
  } else {
    // 超过2年显示具体日期
    return formatDateString(pubDate);
  }
};

// 格式化日期字符串
export const formatDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 格式化日期时间字符串（包含时间）
export const formatDateTimeString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

function readTableCompactModes() {
  try {
    const json = localStorage.getItem(TABLE_COMPACT_MODES_KEY);
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

function writeTableCompactModes(modes) {
  try {
    localStorage.setItem(TABLE_COMPACT_MODES_KEY, JSON.stringify(modes));
  } catch {
    // ignore
  }
}

export function getTableCompactMode(tableKey = 'global') {
  const modes = readTableCompactModes();
  return !!modes[tableKey];
}

export function setTableCompactMode(compact, tableKey = 'global') {
  const modes = readTableCompactModes();
  modes[tableKey] = compact;
  writeTableCompactModes(modes);
}

// -------------------------------
// Select 组件统一过滤逻辑
// 使用方式： <Select filter={selectFilter} ... />
// 统一的 Select 搜索过滤逻辑 -- 支持同时匹配 option.value 与 option.label
export const selectFilter = (input, option) => {
  if (!input) return true;

  const keyword = input.trim().toLowerCase();
  const valueText = (option?.value ?? '').toString().toLowerCase();
  const labelText = (option?.label ?? '').toString().toLowerCase();

  return valueText.includes(keyword) || labelText.includes(keyword);
};

// -------------------------------
// Direct model prices are stored in USD. Token prices are per 1M tokens;
// request prices are per request. The selected group multiplier is applied
// exactly once here and nowhere in the presentation layer.
export const calculateModelPrice = ({
  record,
  selectedGroup,
  groupRatio = {},
  tokenUnit = 'M',
  displayPrice = (value) => `$${Number(value || 0).toFixed(4)}`,
}) => {
  groupRatio = groupRatio || {};
  let usedGroup = selectedGroup;
  let usedGroupRatio = groupRatio[selectedGroup];

  if (selectedGroup === 'all' || usedGroupRatio === undefined) {
    let minRatio = Number.POSITIVE_INFINITY;
    (Array.isArray(record?.enable_groups) ? record.enable_groups : []).forEach((group) => {
      const ratio = Number(groupRatio[group]);
      if (Number.isFinite(ratio) && ratio < minRatio) {
        minRatio = ratio;
        usedGroup = group;
        usedGroupRatio = ratio;
      }
    });
  }
  usedGroupRatio = Number(usedGroupRatio);
  if (!Number.isFinite(usedGroupRatio)) usedGroupRatio = 1;

  const numeric = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const billingTypeValue = record?.billing_type;
  const billingType = billingTypeValue === 0
    ? 'tokens'
    : billingTypeValue === 1
      ? 'request'
      : String(billingTypeValue || '').toLowerCase();
  const isPerToken = billingType === 'tokens';
  const isPerRequest = billingType === 'request';
  const scaled = (value) => {
    const parsed = numeric(value);
    return parsed === null ? null : parsed * usedGroupRatio;
  };
  const format = (value) => {
    if (value === null || value === undefined) return null;
    return displayPrice(value);
  };
  const unitLabel = tokenUnit === 'K' ? 'K' : 'M';
  const unitDivisor = tokenUnit === 'K' ? 1000 : 1;

  if (isPerToken) {
    const input = scaled(record.input_price);
    const output = scaled(record.output_price);
    const cacheRead = scaled(record.cache_read_price);
    const cacheWrite = scaled(record.cache_write_price);
    const image = scaled(record.image_price);
    const audioInput = scaled(record.audio_input_price);
    const audioOutput = scaled(record.audio_output_price);
    const perUnit = (value) => (value === null ? null : format(value / unitDivisor));
    return {
      inputPrice: perUnit(input),
      completionPrice: perUnit(output),
      cachePrice: perUnit(cacheRead),
      createCachePrice: perUnit(cacheWrite),
      imagePrice: perUnit(image),
      audioInputPrice: perUnit(audioInput),
      audioOutputPrice: perUnit(audioOutput),
      inputPriceUSD: input,
      outputPriceUSD: output,
      cacheReadPriceUSD: cacheRead,
      cacheWritePriceUSD: cacheWrite,
      imagePriceUSD: image,
      audioInputPriceUSD: audioInput,
      audioOutputPriceUSD: audioOutput,
      unitLabel,
      isPerToken: true,
      usedGroup,
      usedGroupRatio,
      configured: record?.configured !== false,
    };
  }

  if (isPerRequest) {
    const request = scaled(record.request_price);
    return {
      price: format(request),
      priceUSD: request,
      isPerToken: false,
      usedGroup,
      usedGroupRatio,
      configured: record?.configured !== false,
    };
  }

  return {
    price: '-',
    isPerToken: false,
    usedGroup,
    usedGroupRatio,
    configured: record?.configured !== false,
  };
};

export const getModelPriceItems = (priceData, t) => {
  const hasConfiguredPrice = (value) => {
    if (value === null || value === undefined || value === '') return false;
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0;
  };
  if (priceData.isPerToken) {

    const unitSuffix = ` / 1${priceData.unitLabel} Tokens`;
    return [
      {
        key: 'input',
        label: t('输入价格'),
        value: priceData.inputPrice,
        configuredValue: priceData.inputPriceUSD,
        suffix: unitSuffix,
      },
      {
        key: 'completion',
        label: t('补全价格'),
        value: priceData.completionPrice,
        configuredValue: priceData.outputPriceUSD,
        suffix: unitSuffix,
      },
      {
        key: 'cache',
        label: t('缓存读取价格'),
        value: priceData.cachePrice,
        configuredValue: priceData.cacheReadPriceUSD,
        suffix: unitSuffix,
      },
      {
        key: 'create-cache',
        label: t('缓存创建价格'),
        value: priceData.createCachePrice,
        configuredValue: priceData.cacheWritePriceUSD,
        suffix: unitSuffix,
      },
      {
        key: 'image',
        label: t('图片输入价格'),
        value: priceData.imagePrice,
        configuredValue: priceData.imagePriceUSD,
        suffix: unitSuffix,
      },
      {
        key: 'audio-input',
        label: t('音频输入价格'),
        value: priceData.audioInputPrice,
        configuredValue: priceData.audioInputPriceUSD,
        suffix: unitSuffix,
      },
      {
        key: 'audio-output',
        label: t('音频补全价格'),
        value: priceData.audioOutputPrice,
        configuredValue: priceData.audioOutputPriceUSD,
        suffix: unitSuffix,
      },
    ].filter((item) => hasConfiguredPrice(item.configuredValue));
  }

  return [
    {
      key: 'fixed',
      label: t('模型价格'),
      value: priceData.price,
      configuredValue: priceData.priceUSD,
      suffix: ` / ${t('次')}`,
    },
  ].filter((item) => hasConfiguredPrice(item.configuredValue));
};

// -------------------------------
// CardPro 分页配置函数
// 用于创建 CardPro 的 paginationArea 配置
export const createCardProPagination = ({
  currentPage,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  isMobile = false,
  pageSizeOpts = [10, 20, 50, 100],
  showSizeChanger = true,
  t = (key) => key,
}) => {
  if (!total || total <= 0) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  const totalPages = Math.ceil(total / pageSize);
  const totalText = `${t('显示第')} ${start} ${t('条 - 第')} ${end} ${t('条，共')} ${total} ${t('条')}`;

  return (
    <>
      {/* 桌面端左侧总数信息 */}
      {!isMobile && (
        <span
          className='text-sm select-none'
          style={{ color: 'var(--semi-color-text-2)' }}
        >
          {totalText}
        </span>
      )}

      {/* 右侧分页控件 */}
      <div className='flex items-center gap-2'>
        {showSizeChanger && (
          <select
            className='text-sm border rounded px-2 py-1'
            style={{ borderColor: 'var(--semi-color-border)' }}
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {pageSizeOpts.map((opt) => (
              <option key={opt} value={opt}>
                {opt} {t('条')}/{t('页')}
              </option>
            ))}
          </select>
        )}
        <button
          className='px-2 py-1 text-sm border rounded disabled:opacity-40'
          style={{ borderColor: 'var(--semi-color-border)' }}
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          ‹
        </button>
        <span className='text-sm select-none' style={{ color: 'var(--semi-color-text-1)' }}>
          {currentPage} / {totalPages}
        </span>
        <button
          className='px-2 py-1 text-sm border rounded disabled:opacity-40'
          style={{ borderColor: 'var(--semi-color-border)' }}
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          ›
        </button>
      </div>
    </>
  );
};

// 模型定价筛选条件默认值
const DEFAULT_PRICING_FILTERS = {
  search: '',
  showWithRecharge: false,
  currency: 'USD',
  showRatio: false,
  viewMode: 'card',
  tokenUnit: 'M',
  filterGroup: 'all',
  filterQuotaType: 'all',
  filterEndpointType: 'all',
  filterVendor: 'all',
  filterTag: 'all',
  currentPage: 1,
};

// 重置模型定价筛选条件
export const resetPricingFilters = ({
  handleChange,
  setShowWithRecharge,
  setCurrency,
  setShowRatio,
  setViewMode,
  setFilterGroup,
  setFilterQuotaType,
  setFilterEndpointType,
  setFilterVendor,
  setFilterTag,
  setCurrentPage,
  setTokenUnit,
}) => {
  handleChange?.(DEFAULT_PRICING_FILTERS.search);
  setShowWithRecharge?.(DEFAULT_PRICING_FILTERS.showWithRecharge);
  setCurrency?.(DEFAULT_PRICING_FILTERS.currency);
  setShowRatio?.(DEFAULT_PRICING_FILTERS.showRatio);
  setViewMode?.(DEFAULT_PRICING_FILTERS.viewMode);
  setTokenUnit?.(DEFAULT_PRICING_FILTERS.tokenUnit);
  setFilterGroup?.(DEFAULT_PRICING_FILTERS.filterGroup);
  setFilterQuotaType?.(DEFAULT_PRICING_FILTERS.filterQuotaType);
  setFilterEndpointType?.(DEFAULT_PRICING_FILTERS.filterEndpointType);
  setFilterVendor?.(DEFAULT_PRICING_FILTERS.filterVendor);
  setFilterTag?.(DEFAULT_PRICING_FILTERS.filterTag);
  setCurrentPage?.(DEFAULT_PRICING_FILTERS.currentPage);
};
