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

import { showToast } from '../components/ui';

export function getSystemName() {
  // Brand is hardcoded for the HyxAPI build — do not read from server-side
  // Option/SystemName, which other operators may have set to "New API" etc.
  return 'HyxAPI';
}

export function getUserIdFromLocalStorage() {
  let user = localStorage.getItem('user');
  if (!user) return -1;
  user = JSON.parse(user);
  return user.id;
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

export function showSuccess(message) {
  showToast({ type: 'success', message });
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

  if (record?.billing_mode === 'tiered_expr' || billingType === 'expression' || record?.billing_plugin_variants?.length) {
    return {
      price: '表达式计费', isPerToken: false, isExpression: true,
      expression: record.billing_expr || '', usedGroup, usedGroupRatio,
      configured: record?.configured !== false,
    };
  }

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
  if (priceData.configured === false) return [];
  const hasConfiguredPrice = (value, allowFree = false) => {
    if (value === null || value === undefined || value === '') return false;
    const numeric = Number(value);
    return Number.isFinite(numeric) && (allowFree ? numeric >= 0 : numeric > 0);
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
    ].filter((item) => hasConfiguredPrice(item.configuredValue, item.key === 'input' || item.key === 'completion'));
  }

  return [
    {
      key: 'fixed',
      label: t('模型价格'),
      value: priceData.price,
      configuredValue: priceData.priceUSD,
      suffix: ` / ${t('次')}`,
    },
  ].filter((item) => hasConfiguredPrice(item.configuredValue, true));
};
