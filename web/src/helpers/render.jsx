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

import i18next from 'i18next';
// Simple Tag replacement for Semi UI Tag
const TAG_COLOR_MAP = {
  amber: '#f59e0b', blue: '#3b82f6', cyan: '#06b6d4', green: '#10b981',
  grey: '#6b7280', indigo: '#6366f1', 'light-blue': '#0ea5e9', lime: '#84cc16',
  orange: '#f97316', pink: '#ec4899', purple: '#8b5cf6', red: '#ef4444',
  teal: '#14b8a6', violet: '#7c3aed', yellow: '#eab308', white: '#9ca3af',
};

function Tag({ color, children, prefixIcon, suffixIcon, onClick, size, shape }) {
  const bgColor = TAG_COLOR_MAP[color] || TAG_COLOR_MAP.grey;
  return (
    <span
      onClick={onClick}
      className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-default'
      style={{
        backgroundColor: `${bgColor}20`,
        color: bgColor,
        border: `1px solid ${bgColor}40`,
      }}
    >
      {prefixIcon && <span className='inline-flex'>{prefixIcon}</span>}
      {children}
      {suffixIcon && <span className='inline-flex'>{suffixIcon}</span>}
    </span>
  );
}
import { copy, showSuccess, showError } from './utils';
import { MOBILE_BREAKPOINT } from '../hooks/common/useIsMobile';
import { visit } from 'unist-util-visit';
import { Layers, Package, Server } from 'lucide-react';

// 获取侧边栏Lucide图标组件
const MODEL_ICON_CDN = 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/light';

const MODEL_ICON_SLUGS = {
  openai: 'openai',
  claude: 'claude',
  gemini: 'gemini',
  deepseek: 'deepseek',
  mistral: 'mistral',
  xai: 'xai',
  openrouter: 'openrouter',
};

const normalizeModelIconSlug = (iconName) => String(iconName || '')
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
  .replace(/[^a-zA-Z0-9-]/g, '')
  .toLowerCase();

export function getLobeHubIcon(iconName, size = 14) {
  const raw = String(iconName || '').trim();
  if (!raw || raw.toLowerCase() === 'layers') return <Layers size={size} />;
  if (/^https?:\/\//i.test(raw)) {
    return <img src={raw} alt='' width={size} height={size} style={{ display: 'inline-block', objectFit: 'contain' }} />;
  }
  const [baseName, variant] = raw.split('.');
  const normalizedBase = normalizeModelIconSlug(baseName).replaceAll('-', '');
  const baseSlug = MODEL_ICON_SLUGS[normalizedBase] || normalizeModelIconSlug(baseName);
  const slug = `${baseSlug}${String(variant || '').toLowerCase() === 'color' ? '-color' : ''}`;
  return (
    <span className='inline-flex items-center justify-center' style={{ width: size, height: size }}>
      <img
        src={`${MODEL_ICON_CDN}/${slug}.png`}
        alt=''
        width={size}
        height={size}
        loading='lazy'
        style={{ display: 'block', objectFit: 'contain' }}
        onError={(event) => {
          event.currentTarget.hidden = true;
          event.currentTarget.nextElementSibling.hidden = false;
        }}
      />
      <span hidden style={{ fontSize: Math.max(10, Math.floor(size * 0.55)), fontWeight: 600 }}>
        {raw.charAt(0).toUpperCase() || '?'}
      </span>
    </span>
  );
}

export function getModelIcon(modelName, vendorIcon) {
  const name = String(modelName || '').toLowerCase();
  if (name.includes('claude')) return 'claude-color';
  return vendorIcon || 'layers';
}

const TAG_COLORS = Object.keys(TAG_COLOR_MAP);

export function stringToColor(value) {
  const text = String(value || '');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export function renderText(text, limit) {
  if (text.length > limit) {
    return text.slice(0, limit - 3) + '...';
  }
  return text;
}

/**
 * Render group tags based on the input group string
 * @param {string} group - The input group string
 * @returns {JSX.Element} - The rendered group tags
 */
export function renderGroup(group) {
  if (group === '') {
    return (
      <Tag key='default' color='white' shape='circle'>
        {i18next.t('用户分组')}
      </Tag>
    );
  }

  const tagColors = {
    vip: 'yellow',
    pro: 'yellow',
    svip: 'red',
    premium: 'red',
  };

  const groups = group.split(',').sort();

  return (
    <span key={group}>
      {groups.map((group) => (
        <Tag
          color={tagColors[group] || stringToColor(group)}
          key={group}
          shape='circle'
          onClick={async (event) => {
            event.stopPropagation();
            if (await copy(group)) {
              showSuccess(i18next.t('已复制：') + group);
            } else {
              showError(i18next.t('无法复制到剪贴板，请手动复制') + ': ' + group);
            }
          }}
        >
          {group}
        </Tag>
      ))}
    </span>
  );
}

export function renderRatio(ratio) {
  let color = 'green';
  if (ratio > 5) {
    color = 'red';
  } else if (ratio > 3) {
    color = 'orange';
  } else if (ratio > 1) {
    color = 'blue';
  }
  return (
    <Tag color={color}>
      {ratio}x {i18next.t('倍率')}
    </Tag>
  );
}

const measureTextWidth = (
  text,
  style = {
    fontSize: '14px',
    fontFamily:
      "'Space Grotesk', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  containerWidth,
) => {
  const span = document.createElement('span');

  span.style.visibility = 'hidden';
  span.style.position = 'absolute';
  span.style.whiteSpace = 'nowrap';
  span.style.fontSize = style.fontSize;
  span.style.fontFamily = style.fontFamily;

  span.textContent = text;

  document.body.appendChild(span);
  const width = span.offsetWidth;

  document.body.removeChild(span);

  return width;
};

export function truncateText(text, maxWidth = 200) {
  const isMobileScreen = window.matchMedia(
    `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
  ).matches;
  if (!isMobileScreen) {
    return text;
  }
  if (!text) return text;

  try {
    // Handle percentage-based maxWidth
    let actualMaxWidth = maxWidth;
    if (typeof maxWidth === 'string' && maxWidth.endsWith('%')) {
      const percentage = parseFloat(maxWidth) / 100;
      // Use window width as fallback container width
      actualMaxWidth = window.innerWidth * percentage;
    }

    const width = measureTextWidth(text);
    if (width <= actualMaxWidth) return text;

    let left = 0;
    let right = text.length;
    let result = text;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const truncated = text.slice(0, mid) + '...';
      const currentWidth = measureTextWidth(truncated);

      if (currentWidth <= actualMaxWidth) {
        result = truncated;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return result;
  } catch (error) {
    console.warn(
      'Text measurement failed, falling back to character count',
      error,
    );
    if (text.length > 20) {
      return text.slice(0, 17) + '...';
    }
    return text;
  }
}

export const renderGroupOption = (item) => {
  const {
    disabled,
    selected,
    label,
    value,
    focused,
    className,
    style,
    onMouseEnter,
    onClick,
    empty,
    emptyContent,
    ...rest
  } = item;

  const baseStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    backgroundColor: focused ? 'var(--semi-color-fill-0)' : 'transparent',
    opacity: disabled ? 0.5 : 1,
    ...(selected && {
      backgroundColor: 'var(--semi-color-primary-light-default)',
    }),
    '&:hover': {
      backgroundColor: !disabled && 'var(--semi-color-fill-1)',
    },
  };

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  const handleMouseEnter = (e) => {
    if (!disabled && onMouseEnter) {
      onMouseEnter(e);
    }
  };

  return (
    <div
      style={baseStyle}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontWeight: 600, color: disabled ? 'var(--semi-color-text-3)' : undefined }}>
          {value}
        </span>
        <span style={{ color: 'var(--semi-color-text-2)', fontSize: '12px' }}>
          {label}
        </span>
      </div>
      {item.ratio && renderRatio(item.ratio)}
    </div>
  );
};

export function renderNumber(num) {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  } else if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 10000) {
    return (num / 1000).toFixed(1) + 'k';
  } else {
    return num;
  }
}

export function renderQuotaNumberWithDigit(num, digits = 2) {
  if (typeof num !== 'number' || isNaN(num)) {
    return 0;
  }
  const quotaDisplayType = localStorage.getItem('quota_display_type') || 'USD';
  num = num.toFixed(digits);
  if (quotaDisplayType === 'CNY') {
    return '¥' + num;
  } else if (quotaDisplayType === 'USD') {
    return '$' + num;
  } else if (quotaDisplayType === 'CUSTOM') {
    const statusStr = localStorage.getItem('status');
    let symbol = '¤';
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        symbol = s?.custom_currency_symbol || symbol;
      }
    } catch (e) {}
    return symbol + num;
  } else {
    return num;
  }
}

export function renderNumberWithPoint(num) {
  if (num === undefined) return '';
  num = num.toFixed(2);
  if (num >= 100000) {
    // Convert number to string to manipulate it
    let numStr = num.toString();
    // Find the position of the decimal point
    let decimalPointIndex = numStr.indexOf('.');

    let wholePart = numStr;
    let decimalPart = '';

    // If there is a decimal point, split the number into whole and decimal parts
    if (decimalPointIndex !== -1) {
      wholePart = numStr.slice(0, decimalPointIndex);
      decimalPart = numStr.slice(decimalPointIndex);
    }

    // Take the first two and last two digits of the whole number part
    let shortenedWholePart = wholePart.slice(0, 2) + '..' + wholePart.slice(-2);

    // Return the formatted number
    return shortenedWholePart + decimalPart;
  }

  // If the number is less than 100,000, return it unmodified
  return num;
}

export function getQuotaPerUnit() {
  let quotaPerUnit = localStorage.getItem('quota_per_unit');
  quotaPerUnit = parseFloat(quotaPerUnit);
  if (!quotaPerUnit || isNaN(quotaPerUnit)) quotaPerUnit = 500000;
  return quotaPerUnit;
}

export function renderUnitWithQuota(quota) {
  let quotaPerUnit = localStorage.getItem('quota_per_unit');
  quotaPerUnit = parseFloat(quotaPerUnit);
  if (!quotaPerUnit || isNaN(quotaPerUnit)) quotaPerUnit = 500000;
  quota = parseFloat(quota);
  return quotaPerUnit * quota;
}

export function getQuotaWithUnit(quota, digits = 6) {
  let quotaPerUnit = localStorage.getItem('quota_per_unit');
  quotaPerUnit = parseFloat(quotaPerUnit);
  if (!quotaPerUnit || isNaN(quotaPerUnit)) quotaPerUnit = 500000;
  return (quota / quotaPerUnit).toFixed(digits);
}

export function renderQuotaWithAmount(amount) {
  const quotaDisplayType = localStorage.getItem('quota_display_type') || 'USD';
  if (quotaDisplayType === 'TOKENS') {
    return renderNumber(renderUnitWithQuota(amount));
  }

  const numericAmount = Number(amount);
  const formattedAmount = Number.isFinite(numericAmount)
    ? numericAmount.toFixed(2)
    : amount;

  if (quotaDisplayType === 'CNY') {
    return '¥' + formattedAmount;
  } else if (quotaDisplayType === 'CUSTOM') {
    const statusStr = localStorage.getItem('status');
    let symbol = '¤';
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        symbol = s?.custom_currency_symbol || symbol;
      }
    } catch (e) {}
    return symbol + formattedAmount;
  }
  return '$' + formattedAmount;
}

/**
 * 获取当前货币配置信息
 * @returns {Object} - { symbol, rate, type }
 */
export function getCurrencyConfig() {
  const quotaDisplayType = localStorage.getItem('quota_display_type') || 'USD';
  const statusStr = localStorage.getItem('status');

  let symbol = '$';
  let rate = 1;

  if (quotaDisplayType === 'CNY') {
    symbol = '¥';
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        rate = s?.usd_exchange_rate || 7;
      }
    } catch (e) {}
  } else if (quotaDisplayType === 'CUSTOM') {
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        symbol = s?.custom_currency_symbol || '¤';
        rate = s?.custom_currency_exchange_rate || 1;
      }
    } catch (e) {}
  }

  return { symbol, rate, type: quotaDisplayType };
}

/**
 * 将美元金额转换为当前选择的货币
 * @param {number} usdAmount - 美元金额
 * @param {number} digits - 小数位数
 * @returns {string} - 格式化后的货币字符串
 */
export function convertUSDToCurrency(usdAmount, digits = 2) {
  const { symbol, rate } = getCurrencyConfig();
  const convertedAmount = usdAmount * rate;
  return symbol + convertedAmount.toFixed(digits);
}

export function renderQuota(quota, digits = 2) {
  let quotaPerUnit = localStorage.getItem('quota_per_unit');
  const quotaDisplayType = localStorage.getItem('quota_display_type') || 'USD';
  quotaPerUnit = parseFloat(quotaPerUnit);
  if (!quotaPerUnit || isNaN(quotaPerUnit)) quotaPerUnit = 500000;
  if (quotaDisplayType === 'TOKENS') {
    return renderNumber(quota);
  }
  const resultUSD = quota / quotaPerUnit;
  let symbol = '$';
  let value = resultUSD;
  if (quotaDisplayType === 'CNY') {
    const statusStr = localStorage.getItem('status');
    let usdRate = 1;
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        usdRate = s?.usd_exchange_rate || 1;
      }
    } catch (e) {}
    value = resultUSD * usdRate;
    symbol = '¥';
  } else if (quotaDisplayType === 'CUSTOM') {
    const statusStr = localStorage.getItem('status');
    let symbolCustom = '¤';
    let rate = 1;
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        symbolCustom = s?.custom_currency_symbol || symbolCustom;
        rate = s?.custom_currency_exchange_rate || rate;
      }
    } catch (e) {}
    value = resultUSD * rate;
    symbol = symbolCustom;
  }
  const fixedResult = value.toFixed(digits);
  if (parseFloat(fixedResult) === 0 && quota > 0 && value > 0) {
    const minValue = Math.pow(10, -digits);
    return symbol + minValue.toFixed(digits);
  }
  return symbol + fixedResult;
}

function isValidGroupRatio(ratio) {
  return Number.isFinite(ratio) && ratio !== -1;
}

/**
 * Helper function to get effective ratio and label
 * @param {number} groupRatio - The default group ratio
 * @param {number} user_group_ratio - The user-specific group ratio
 * @returns {Object} - Object containing { ratio, label, useUserGroupRatio }
 */
function getEffectiveRatio(groupRatio, user_group_ratio) {
  const useUserGroupRatio = isValidGroupRatio(user_group_ratio);
  const ratioLabel = useUserGroupRatio
    ? i18next.t('专属倍率')
    : i18next.t('分组倍率');
  const effectiveRatio = useUserGroupRatio ? user_group_ratio : groupRatio;

  return {
    ratio: effectiveRatio,
    label: ratioLabel,
    useUserGroupRatio: useUserGroupRatio,
  };
}

function getQuotaDisplayType() {
  return localStorage.getItem('quota_display_type') || 'USD';
}

function resolveBillingDisplayMode(displayMode, modelPrice = -1) {
  if (modelPrice !== -1) {
    return 'price';
  }
  if (getQuotaDisplayType() === 'TOKENS') {
    return 'ratio';
  }
  return displayMode === 'ratio' ? 'ratio' : 'price';
}

function isPriceDisplayMode(displayMode, modelPrice = -1) {
  return resolveBillingDisplayMode(displayMode, modelPrice) === 'price';
}

function shouldUseRatioBillingProcess(modelPrice = -1) {
  return modelPrice === -1 && getQuotaDisplayType() === 'TOKENS';
}

function formatCompactDisplayPrice(usdAmount, digits = 6) {
  const { symbol, rate } = getCurrencyConfig();
  const amount = Number((usdAmount * rate).toFixed(digits));
  return `${symbol}${amount}`;
}

function appendPricePart(parts, condition, key, vars) {
  if (!condition) {
    return;
  }
  parts.push(i18next.t(key, vars));
}

function joinBillingSummary(parts) {
  return parts.filter(Boolean).join('，');
}

function getGroupRatioText(groupRatio, user_group_ratio) {
  const { ratio, label } = getEffectiveRatio(groupRatio, user_group_ratio);
  return i18next.t('{{ratioType}} {{ratio}}x', {
    ratioType: label,
    ratio,
  });
}

function formatRatioValue(value, digits = 6) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Number(num.toFixed(digits));
}

function renderDisplayAmountFromUsd(usdAmount, digits = 6) {
  return renderQuotaWithAmount(Number(Number(usdAmount || 0).toFixed(digits)));
}

function formatBillingDisplayPrice(usdAmount, rate, digits = 6) {
  return (usdAmount * rate).toFixed(digits);
}

function buildBillingText(key, vars) {
  return i18next.t(key, vars);
}

function buildBillingPriceText(
  key,
  { symbol, usdAmount, rate, amountKey = 'price', digits = 6, ...vars },
) {
  return buildBillingText(key, {
    symbol,
    [amountKey]: formatBillingDisplayPrice(usdAmount, rate, digits),
    ...vars,
  });
}

function renderBillingArticle(lines, { showReferenceNote = true } = {}) {
  const articleLines = lines.filter(Boolean);

  if (showReferenceNote) {
    articleLines.push(buildBillingText('仅供参考，以实际扣费为准'));
  }

  return (
    <article>
      {articleLines.map((line, index) => (
        <p key={index}>{line}</p>
      ))}
    </article>
  );
}

// Shared core for simple price rendering (used by OpenAI-like and Claude-like variants)
function renderPriceSimpleCore({
  modelRatio,
  modelPrice = -1,
  groupRatio,
  user_group_ratio,
  cacheTokens = 0,
  cacheRatio = 1.0,
  cacheCreationTokens = 0,
  cacheCreationRatio = 1.0,
  cacheCreationTokens5m = 0,
  cacheCreationRatio5m = 1.0,
  cacheCreationTokens1h = 0,
  cacheCreationRatio1h = 1.0,
  image = false,
  imageRatio = 1.0,
  isSystemPromptOverride = false,
  displayMode = 'price',
  outputMode = 'text',
}) {
  const { ratio: effectiveGroupRatio, label: ratioLabel } = getEffectiveRatio(
    groupRatio,
    user_group_ratio,
  );
  const finalGroupRatio = effectiveGroupRatio;

  const { symbol, rate } = getCurrencyConfig();
  const hasSplitCacheCreation =
    cacheCreationTokens5m > 0 || cacheCreationTokens1h > 0;

  const shouldShowLegacyCacheCreation =
    !hasSplitCacheCreation && cacheCreationTokens !== 0;

  const shouldShowCache = cacheTokens !== 0;
  const shouldShowCacheCreation5m =
    hasSplitCacheCreation && cacheCreationTokens5m > 0;
  const shouldShowCacheCreation1h =
    hasSplitCacheCreation && cacheCreationTokens1h > 0;

  if (outputMode === 'segments') {
    const segments = [
      {
        tone: 'primary',
        text: getGroupRatioText(groupRatio, user_group_ratio),
      },
    ];

    if (modelPrice !== -1) {
      segments.push({
        tone: 'secondary',
        text: isPriceDisplayMode(displayMode, modelPrice)
          ? i18next.t('模型价格 {{price}}', {
              price: formatCompactDisplayPrice(modelPrice),
            })
          : i18next.t('按次'),
      });
    } else if (isPriceDisplayMode(displayMode, modelPrice)) {
      segments.push({
        tone: 'secondary',
        text: i18next.t('输入 {{price}} / 1M tokens', {
          price: formatCompactDisplayPrice(modelRatio * 2.0),
        }),
      });

      if (shouldShowCache) {
        segments.push({
          tone: 'secondary',
          text: i18next.t('缓存读 {{price}} / 1M tokens', {
            price: formatCompactDisplayPrice(modelRatio * 2.0 * cacheRatio),
          }),
        });
      }

      if (hasSplitCacheCreation && shouldShowCacheCreation5m) {
        segments.push({
          tone: 'secondary',
          text: i18next.t('5m缓存创建 {{price}} / 1M tokens', {
            price: formatCompactDisplayPrice(
              modelRatio * 2.0 * cacheCreationRatio5m,
            ),
          }),
        });
      }
      if (hasSplitCacheCreation && shouldShowCacheCreation1h) {
        segments.push({
          tone: 'secondary',
          text: i18next.t('1h缓存创建 {{price}} / 1M tokens', {
            price: formatCompactDisplayPrice(
              modelRatio * 2.0 * cacheCreationRatio1h,
            ),
          }),
        });
      }
      if (!hasSplitCacheCreation && shouldShowLegacyCacheCreation) {
        segments.push({
          tone: 'secondary',
          text: i18next.t('缓存创建 {{price}} / 1M tokens', {
            price: formatCompactDisplayPrice(
              modelRatio * 2.0 * cacheCreationRatio,
            ),
          }),
        });
      }

      if (image) {
        segments.push({
          tone: 'secondary',
          text: i18next.t('图片输入 {{price}} / 1M tokens', {
            price: formatCompactDisplayPrice(modelRatio * 2.0 * imageRatio),
          }),
        });
      }
    } else {
      segments.push({
        tone: 'secondary',
        text: i18next.t('模型: {{ratio}}', {
          ratio: modelRatio,
        }),
      });

      if (shouldShowCache) {
        segments.push({
          tone: 'secondary',
          text: i18next.t('缓存: {{cacheRatio}}', {
            cacheRatio: cacheRatio,
          }),
        });
      }

      if (hasSplitCacheCreation) {
        if (shouldShowCacheCreation5m && shouldShowCacheCreation1h) {
          segments.push({
            tone: 'secondary',
            text: i18next.t(
              '缓存创建: 5m {{cacheCreationRatio5m}} / 1h {{cacheCreationRatio1h}}',
              {
                cacheCreationRatio5m: cacheCreationRatio5m,
                cacheCreationRatio1h: cacheCreationRatio1h,
              },
            ),
          });
        } else if (shouldShowCacheCreation5m) {
          segments.push({
            tone: 'secondary',
            text: i18next.t('缓存创建: 5m {{cacheCreationRatio5m}}', {
              cacheCreationRatio5m: cacheCreationRatio5m,
            }),
          });
        } else if (shouldShowCacheCreation1h) {
          segments.push({
            tone: 'secondary',
            text: i18next.t('缓存创建: 1h {{cacheCreationRatio1h}}', {
              cacheCreationRatio1h: cacheCreationRatio1h,
            }),
          });
        }
      } else if (shouldShowLegacyCacheCreation) {
        segments.push({
          tone: 'secondary',
          text: i18next.t('缓存创建: {{cacheCreationRatio}}', {
            cacheCreationRatio: cacheCreationRatio,
          }),
        });
      }

      if (image) {
        segments.push({
          tone: 'secondary',
          text: i18next.t('图片输入: {{imageRatio}}', {
            imageRatio: imageRatio,
          }),
        });
      }
    }

    if (isSystemPromptOverride) {
      segments.push({
        tone: 'primary',
        text: i18next.t('系统提示覆盖'),
      });
    }

    return segments;
  }

  if (modelPrice !== -1) {
    if (isPriceDisplayMode(displayMode, modelPrice)) {
      return joinBillingSummary([
        i18next.t('模型价格：{{symbol}}{{price}}', {
          symbol: symbol,
          price: (modelPrice * rate).toFixed(6),
        }),
        getGroupRatioText(groupRatio, user_group_ratio),
      ]);
    }
    const displayPrice = (modelPrice * rate).toFixed(6);
    return i18next.t('价格：{{symbol}}{{price}} * {{ratioType}}：{{ratio}}', {
      symbol: symbol,
      price: displayPrice,
      ratioType: ratioLabel,
      ratio: finalGroupRatio,
    });
  }

  if (isPriceDisplayMode(displayMode, modelPrice)) {
    const parts = [];
    if (modelPrice !== -1) {
      parts.push(
        i18next.t('模型价格 {{price}}', {
          price: formatCompactDisplayPrice(modelPrice),
        }),
      );
      parts.push(getGroupRatioText(groupRatio, user_group_ratio));
      return joinBillingSummary(parts);
    }

    parts.push(
      i18next.t('输入 {{price}} / 1M tokens', {
        price: formatCompactDisplayPrice(modelRatio * 2.0),
      }),
    );

    if (shouldShowCache) {
      parts.push(
        i18next.t('缓存读 {{price}} / 1M tokens', {
          price: formatCompactDisplayPrice(modelRatio * 2.0 * cacheRatio),
        }),
      );
    }

    if (hasSplitCacheCreation && shouldShowCacheCreation5m) {
      parts.push(
        i18next.t('5m缓存创建 {{price}} / 1M tokens', {
          price: formatCompactDisplayPrice(
            modelRatio * 2.0 * cacheCreationRatio5m,
          ),
        }),
      );
    }
    if (hasSplitCacheCreation && shouldShowCacheCreation1h) {
      parts.push(
        i18next.t('1h缓存创建 {{price}} / 1M tokens', {
          price: formatCompactDisplayPrice(
            modelRatio * 2.0 * cacheCreationRatio1h,
          ),
        }),
      );
    }
    if (!hasSplitCacheCreation && shouldShowLegacyCacheCreation) {
      parts.push(
        i18next.t('缓存创建 {{price}} / 1M tokens', {
          price: formatCompactDisplayPrice(
            modelRatio * 2.0 * cacheCreationRatio,
          ),
        }),
      );
    }

    if (image) {
      parts.push(
        i18next.t('图片输入 {{price}} / 1M tokens', {
          price: formatCompactDisplayPrice(modelRatio * 2.0 * imageRatio),
        }),
      );
    }

    parts.push(getGroupRatioText(groupRatio, user_group_ratio));

    let result = joinBillingSummary(parts);
    if (isSystemPromptOverride) {
      result += '\n\r' + i18next.t('系统提示覆盖');
    }
    return result;
  }

  const parts = [];
  // base: model ratio
  parts.push(i18next.t('模型: {{ratio}}'));

  // cache part (label differs when with image)
  if (shouldShowCache) {
    parts.push(i18next.t('缓存: {{cacheRatio}}'));
  }

  if (hasSplitCacheCreation) {
    if (shouldShowCacheCreation5m && shouldShowCacheCreation1h) {
      parts.push(
        i18next.t(
          '缓存创建: 5m {{cacheCreationRatio5m}} / 1h {{cacheCreationRatio1h}}',
        ),
      );
    } else if (shouldShowCacheCreation5m) {
      parts.push(i18next.t('缓存创建: 5m {{cacheCreationRatio5m}}'));
    } else if (shouldShowCacheCreation1h) {
      parts.push(i18next.t('缓存创建: 1h {{cacheCreationRatio1h}}'));
    }
  } else if (shouldShowLegacyCacheCreation) {
    parts.push(i18next.t('缓存创建: {{cacheCreationRatio}}'));
  }

  // image part
  if (image) {
    parts.push(i18next.t('图片输入: {{imageRatio}}'));
  }

  parts.push(`{{ratioType}}: {{groupRatio}}`);

  let result = i18next.t(parts.join(' * '), {
    ratio: modelRatio,
    ratioType: ratioLabel,
    groupRatio: finalGroupRatio,
    cacheRatio: cacheRatio,
    cacheCreationRatio: cacheCreationRatio,
    cacheCreationRatio5m: cacheCreationRatio5m,
    cacheCreationRatio1h: cacheCreationRatio1h,
    imageRatio: imageRatio,
  });

  if (isSystemPromptOverride) {
    result += '\n\r' + i18next.t('系统提示覆盖');
  }

  return result;
}

export function renderTaskBillingProcess(other, content) {
  if (other?.task_id != null) {
    return renderBillingArticle(
      [content].filter(Boolean),
      { showReferenceNote: false },
    );
  }
  return renderBillingArticle([
    buildBillingText('任务预扣费（将在任务完成后按实际token重算）'),
  ]);
}

export function renderModelPrice(
  inputTokens,
  completionTokens,
  modelRatio,
  modelPrice = -1,
  completionRatio,
  groupRatio,
  user_group_ratio,
  cacheTokens = 0,
  cacheRatio = 1.0,
  image = false,
  imageRatio = 1.0,
  imageOutputTokens = 0,
  webSearch = false,
  webSearchCallCount = 0,
  webSearchPrice = 0,
  fileSearch = false,
  fileSearchCallCount = 0,
  fileSearchPrice = 0,
  audioInputSeperatePrice = false,
  audioInputTokens = 0,
  audioInputPrice = 0,
  imageGenerationCall = false,
  imageGenerationCallPrice = 0,
  displayMode = 'price',
) {
  const { ratio: effectiveGroupRatio, label: ratioLabel } = getEffectiveRatio(
    groupRatio,
    user_group_ratio,
  );
  groupRatio = effectiveGroupRatio;

  const { symbol, rate } = getCurrencyConfig();

  if (!shouldUseRatioBillingProcess(modelPrice)) {
    if (modelPrice !== -1) {
      return renderBillingArticle([
        buildBillingPriceText('按次：{{symbol}}{{price}}', {
          symbol,
          usdAmount: modelPrice,
          rate,
        }),
        buildBillingPriceText(
          '按次 {{symbol}}{{price}} * {{ratioType}} {{ratio}} = {{symbol}}{{total}}',
          {
            symbol,
            usdAmount: modelPrice,
            rate,
            ratioType: ratioLabel,
            ratio: groupRatio,
            amountKey: 'price',
            total: formatBillingDisplayPrice(modelPrice * groupRatio, rate),
          },
        ),
      ]);
    }

    if (completionRatio === undefined) {
      completionRatio = 0;
    }
    const inputRatioPrice = modelRatio * 2.0;
    const completionRatioPrice = modelRatio * 2.0 * completionRatio;
    const cacheRatioPrice = modelRatio * 2.0 * cacheRatio;
    const imageRatioPrice = modelRatio * 2.0 * imageRatio;
    let effectiveInputTokens =
      inputTokens - cacheTokens + cacheTokens * cacheRatio;
    if (image && imageOutputTokens > 0) {
      effectiveInputTokens =
        inputTokens - imageOutputTokens + imageOutputTokens * imageRatio;
    }
    if (audioInputTokens > 0) {
      effectiveInputTokens -= audioInputTokens;
    }
    const price =
      (effectiveInputTokens / 1000000) * inputRatioPrice * groupRatio +
      (audioInputTokens / 1000000) * audioInputPrice * groupRatio +
      (completionTokens / 1000000) * completionRatioPrice * groupRatio +
      (webSearchCallCount / 1000) * webSearchPrice * groupRatio +
      (fileSearchCallCount / 1000) * fileSearchPrice * groupRatio +
      imageGenerationCallPrice * groupRatio;

    let inputDesc = '';
    if (image && imageOutputTokens > 0) {
      inputDesc = buildBillingPriceText(
        '(输入 {{nonImageInput}} tokens + 图片输入 {{imageInput}} tokens / 1M tokens * {{symbol}}{{price}}',
        {
          nonImageInput: inputTokens - imageOutputTokens,
          imageInput: imageOutputTokens,
          symbol,
          usdAmount: inputRatioPrice,
          rate,
        },
      );
    } else if (cacheTokens > 0) {
      inputDesc = buildBillingText(
        '(输入 {{nonCacheInput}} tokens / 1M tokens * {{symbol}}{{price}} + 缓存 {{cacheInput}} tokens / 1M tokens * {{symbol}}{{cachePrice}}',
        {
          nonCacheInput: inputTokens - cacheTokens,
          cacheInput: cacheTokens,
          symbol,
          price: formatBillingDisplayPrice(inputRatioPrice, rate),
          cachePrice: formatBillingDisplayPrice(cacheRatioPrice, rate),
        },
      );
    } else if (audioInputSeperatePrice && audioInputTokens > 0) {
      inputDesc = buildBillingText(
        '(输入 {{nonAudioInput}} tokens / 1M tokens * {{symbol}}{{price}} + 音频输入 {{audioInput}} tokens / 1M tokens * {{symbol}}{{audioPrice}}',
        {
          nonAudioInput: inputTokens - audioInputTokens,
          audioInput: audioInputTokens,
          symbol,
          price: formatBillingDisplayPrice(inputRatioPrice, rate),
          audioPrice: formatBillingDisplayPrice(audioInputPrice, rate),
        },
      );
    } else {
      inputDesc = buildBillingPriceText(
        '(输入 {{input}} tokens / 1M tokens * {{symbol}}{{price}}',
        {
          input: inputTokens,
          symbol,
          usdAmount: inputRatioPrice,
          rate,
        },
      );
    }

    const outputDesc = buildBillingText(
      '输出 {{completion}} tokens / 1M tokens * {{symbol}}{{compPrice}}) * {{ratioType}} {{ratio}}',
      {
        completion: completionTokens,
        symbol,
        compPrice: formatBillingDisplayPrice(completionRatioPrice, rate),
        ratio: groupRatio,
        ratioType: ratioLabel,
      },
    );

    const extraServices = [
      webSearch && webSearchCallCount > 0
        ? buildBillingPriceText(
            ' + Web搜索 {{count}}次 / 1K 次 * {{symbol}}{{price}} * {{ratioType}} {{ratio}}',
            {
              count: webSearchCallCount,
              symbol,
              usdAmount: webSearchPrice,
              rate,
              ratio: groupRatio,
              ratioType: ratioLabel,
            },
          )
        : '',
      fileSearch && fileSearchCallCount > 0
        ? buildBillingPriceText(
            ' + 文件搜索 {{count}}次 / 1K 次 * {{symbol}}{{price}} * {{ratioType}} {{ratio}}',
            {
              count: fileSearchCallCount,
              symbol,
              usdAmount: fileSearchPrice,
              rate,
              ratio: groupRatio,
              ratioType: ratioLabel,
            },
          )
        : '',
      imageGenerationCall && imageGenerationCallPrice > 0
        ? buildBillingPriceText(
            ' + 图片生成调用 {{symbol}}{{price}} / 1次 * {{ratioType}} {{ratio}}',
            {
              symbol,
              usdAmount: imageGenerationCallPrice,
              rate,
              ratio: groupRatio,
              ratioType: ratioLabel,
            },
          )
        : '',
    ].join('');

    const billingLines = [
      buildBillingPriceText(
        '输入价格：{{symbol}}{{price}} / 1M tokens{{audioPrice}}',
        {
          symbol,
          usdAmount: inputRatioPrice,
          rate,
          audioPrice: audioInputSeperatePrice
            ? `，${i18next.t('音频输入价格')} ${symbol}${formatBillingDisplayPrice(audioInputPrice, rate)} / 1M tokens`
            : '',
        },
      ),
      buildBillingPriceText('输出价格：{{symbol}}{{total}} / 1M tokens', {
        symbol,
        usdAmount: completionRatioPrice,
        rate,
        amountKey: 'total',
      }),
      cacheTokens > 0
        ? buildBillingPriceText(
            '缓存读取价格：{{symbol}}{{total}} / 1M tokens',
            {
              symbol,
              usdAmount: inputRatioPrice * cacheRatio,
              rate,
              amountKey: 'total',
            },
          )
        : null,
      image && imageOutputTokens > 0
        ? buildBillingPriceText(
            '图片输入价格：{{symbol}}{{total}} / 1M tokens',
            {
              symbol,
              usdAmount: imageRatioPrice,
              rate,
              amountKey: 'total',
            },
          )
        : null,
      webSearch && webSearchCallCount > 0
        ? buildBillingPriceText('Web搜索价格：{{symbol}}{{price}} / 1K 次', {
            symbol,
            usdAmount: webSearchPrice,
            rate,
          })
        : null,
      fileSearch && fileSearchCallCount > 0
        ? buildBillingPriceText('文件搜索价格：{{symbol}}{{price}} / 1K 次', {
            symbol,
            usdAmount: fileSearchPrice,
            rate,
          })
        : null,
      imageGenerationCall && imageGenerationCallPrice > 0
        ? buildBillingPriceText('图片生成调用：{{symbol}}{{price}} / 1次', {
            symbol,
            usdAmount: imageGenerationCallPrice,
            rate,
          })
        : null,
      buildBillingText(
        '{{inputDesc}} + {{outputDesc}}{{extraServices}} = {{symbol}}{{total}}',
        {
          inputDesc,
          outputDesc,
          extraServices,
          symbol,
          total: formatBillingDisplayPrice(price, rate),
        },
      ),
    ];

    return renderBillingArticle(billingLines);
  }

  if (modelPrice !== -1) {
    const displayPrice = (modelPrice * rate).toFixed(6);
    const displayTotal = (modelPrice * groupRatio * rate).toFixed(6);
    return i18next.t(
      '按次：{{symbol}}{{price}} * {{ratioType}}：{{ratio}} = {{symbol}}{{total}}',
      {
        symbol: symbol,
        price: displayPrice,
        ratio: groupRatio,
        total: displayTotal,
        ratioType: ratioLabel,
      },
    );
  }

  if (completionRatio === undefined) {
    completionRatio = 0;
  }

  const modelRatioValue = formatRatioValue(modelRatio);
  const completionRatioValue = formatRatioValue(completionRatio);
  const cacheRatioValue = formatRatioValue(cacheRatio);
  const imageRatioValue = formatRatioValue(imageRatio);
  const inputRatioPrice = modelRatio * 2.0;
  const completionRatioPrice = modelRatio * 2.0 * completionRatioValue;
  const audioRatioValue =
    audioInputSeperatePrice && audioInputPrice > 0
      ? formatRatioValue(audioInputPrice / inputRatioPrice)
      : null;

  const textInputTokens = Math.max(
    inputTokens - cacheTokens - audioInputTokens,
    0,
  );
  const imageInputTokens =
    image && imageOutputTokens > 0 ? imageOutputTokens : 0;
  const cacheInputTokens = cacheTokens;

  const textInputAmount =
    (textInputTokens / 1000000) * inputRatioPrice * groupRatio;
  const cacheInputAmount =
    (cacheInputTokens / 1000000) *
    inputRatioPrice *
    cacheRatioValue *
    groupRatio;
  const imageInputAmount =
    (imageInputTokens / 1000000) *
    inputRatioPrice *
    imageRatioValue *
    groupRatio;
  const audioInputAmount =
    (audioInputTokens / 1000000) * audioInputPrice * groupRatio;
  const completionAmount =
    (completionTokens / 1000000) * completionRatioPrice * groupRatio;
  const webSearchAmount =
    (webSearchCallCount / 1000) * webSearchPrice * groupRatio;
  const fileSearchAmount =
    (fileSearchCallCount / 1000) * fileSearchPrice * groupRatio;
  const imageGenerationAmount = imageGenerationCallPrice * groupRatio;

  const totalAmount =
    textInputAmount +
    cacheInputAmount +
    imageInputAmount +
    audioInputAmount +
    completionAmount +
    webSearchAmount +
    fileSearchAmount +
    imageGenerationAmount;

  return renderBillingArticle([
    [
      buildBillingText('模型倍率 {{modelRatio}}', {
        modelRatio: modelRatioValue,
      }),
      buildBillingText('补全倍率 {{completionRatio}}', {
        completionRatio: completionRatioValue,
      }),
      cacheInputTokens > 0
        ? buildBillingText('缓存倍率 {{cacheRatio}}', {
            cacheRatio: cacheRatioValue,
          })
        : null,
      imageInputTokens > 0
        ? buildBillingText('图片倍率 {{imageRatio}}', {
            imageRatio: imageRatioValue,
          })
        : null,
      audioRatioValue !== null
        ? buildBillingText('音频倍率 {{audioRatio}}', {
            audioRatio: audioRatioValue,
          })
        : null,
      buildBillingText('{{ratioType}} {{ratio}}', {
        ratioType: ratioLabel,
        ratio: groupRatio,
      }),
    ]
      .filter(Boolean)
      .join('，'),
    textInputTokens > 0
      ? buildBillingText(
          '普通输入：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * {{ratioType}} {{ratio}} = {{amount}}',
          {
            tokens: textInputTokens,
            modelRatio: modelRatioValue,
            ratioType: ratioLabel,
            ratio: groupRatio,
            amount: renderDisplayAmountFromUsd(textInputAmount),
          },
        )
      : null,
    cacheInputTokens > 0
      ? buildBillingText(
          '缓存输入：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * 缓存倍率 {{cacheRatio}} * {{ratioType}} {{ratio}} = {{amount}}',
          {
            tokens: cacheInputTokens,
            modelRatio: modelRatioValue,
            cacheRatio: cacheRatioValue,
            ratioType: ratioLabel,
            ratio: groupRatio,
            amount: renderDisplayAmountFromUsd(cacheInputAmount),
          },
        )
      : null,
    imageInputTokens > 0
      ? buildBillingText(
          '图片输入：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * 图片倍率 {{imageRatio}} * {{ratioType}} {{ratio}} = {{amount}}',
          {
            tokens: imageInputTokens,
            modelRatio: modelRatioValue,
            imageRatio: imageRatioValue,
            ratioType: ratioLabel,
            ratio: groupRatio,
            amount: renderDisplayAmountFromUsd(imageInputAmount),
          },
        )
      : null,
    audioInputTokens > 0 && audioRatioValue !== null
      ? buildBillingText(
          '音频输入：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * 音频倍率 {{audioRatio}} * {{ratioType}} {{ratio}} = {{amount}}',
          {
            tokens: audioInputTokens,
            modelRatio: modelRatioValue,
            audioRatio: audioRatioValue,
            ratioType: ratioLabel,
            ratio: groupRatio,
            amount: renderDisplayAmountFromUsd(audioInputAmount),
          },
        )
      : null,
    buildBillingText(
      '输出：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * 补全倍率 {{completionRatio}} * {{ratioType}} {{ratio}} = {{amount}}',
      {
        tokens: completionTokens,
        modelRatio: modelRatioValue,
        completionRatio: completionRatioValue,
        ratioType: ratioLabel,
        ratio: groupRatio,
        amount: renderDisplayAmountFromUsd(completionAmount),
      },
    ),
    webSearch && webSearchCallCount > 0
      ? buildBillingText(
          'Web 搜索：{{count}} / 1K * 单价 {{price}} * {{ratioType}} {{ratio}} = {{amount}}',
          {
            count: webSearchCallCount,
            price: renderDisplayAmountFromUsd(webSearchPrice),
            ratioType: ratioLabel,
            ratio: groupRatio,
            amount: renderDisplayAmountFromUsd(webSearchAmount),
          },
        )
      : null,
    fileSearch && fileSearchCallCount > 0
      ? buildBillingText(
          '文件搜索：{{count}} / 1K * 单价 {{price}} * {{ratioType}} {{ratio}} = {{amount}}',
          {
            count: fileSearchCallCount,
            price: renderDisplayAmountFromUsd(fileSearchPrice),
            ratioType: ratioLabel,
            ratio: groupRatio,
            amount: renderDisplayAmountFromUsd(fileSearchAmount),
          },
        )
      : null,
    imageGenerationCall && imageGenerationCallPrice > 0
      ? buildBillingText(
          '图片生成：1 次 * 单价 {{price}} * {{ratioType}} {{ratio}} = {{amount}}',
          {
            price: renderDisplayAmountFromUsd(imageGenerationCallPrice),
            ratioType: ratioLabel,
            ratio: groupRatio,
            amount: renderDisplayAmountFromUsd(imageGenerationAmount),
          },
        )
      : null,
    buildBillingText('合计：{{total}}', {
      total: renderDisplayAmountFromUsd(totalAmount),
    }),
  ]);
}

export function renderLogContent(
  modelRatio,
  completionRatio,
  modelPrice = -1,
  groupRatio,
  user_group_ratio,
  cacheRatio = 1.0,
  image = false,
  imageRatio = 1.0,
  webSearch = false,
  webSearchCallCount = 0,
  fileSearch = false,
  fileSearchCallCount = 0,
  displayMode = 'price',
) {
  const {
    ratio,
    label: ratioLabel,
    useUserGroupRatio: useUserGroupRatio,
  } = getEffectiveRatio(groupRatio, user_group_ratio);

  // 获取货币配置
  const { symbol, rate } = getCurrencyConfig();

  if (isPriceDisplayMode(displayMode, modelPrice)) {
    if (modelPrice !== -1) {
      return joinBillingSummary([
        i18next.t('模型价格 {{symbol}}{{price}} / 次', {
          symbol,
          price: (modelPrice * rate).toFixed(6),
        }),
        getGroupRatioText(groupRatio, user_group_ratio),
      ]);
    }

    const parts = [
      i18next.t('输入价格 {{symbol}}{{price}} / 1M tokens', {
        symbol,
        price: (modelRatio * 2.0 * rate).toFixed(6),
      }),
      i18next.t('输出价格 {{symbol}}{{price}} / 1M tokens', {
        symbol,
        price: (modelRatio * 2.0 * completionRatio * rate).toFixed(6),
      }),
    ];
    appendPricePart(
      parts,
      cacheRatio !== 1.0,
      '缓存读取价格 {{symbol}}{{price}} / 1M tokens',
      {
        symbol,
        price: (modelRatio * 2.0 * cacheRatio * rate).toFixed(6),
      },
    );
    appendPricePart(
      parts,
      image,
      '图片输入价格 {{symbol}}{{price}} / 1M tokens',
      {
        symbol,
        price: (modelRatio * 2.0 * imageRatio * rate).toFixed(6),
      },
    );
    appendPricePart(
      parts,
      webSearch,
      'Web 搜索调用 {{webSearchCallCount}} 次',
      {
        webSearchCallCount,
      },
    );
    appendPricePart(
      parts,
      fileSearch,
      '文件搜索调用 {{fileSearchCallCount}} 次',
      {
        fileSearchCallCount,
      },
    );
    parts.push(getGroupRatioText(groupRatio, user_group_ratio));
    return joinBillingSummary(parts);
  }

  if (modelPrice !== -1) {
    return i18next.t('模型价格 {{symbol}}{{price}}，{{ratioType}} {{ratio}}', {
      symbol: symbol,
      price: (modelPrice * rate).toFixed(6),
      ratioType: ratioLabel,
      ratio,
    });
  } else {
    if (image) {
      return i18next.t(
        '模型倍率 {{modelRatio}}，缓存倍率 {{cacheRatio}}，输出倍率 {{completionRatio}}，图片输入倍率 {{imageRatio}}，{{ratioType}} {{ratio}}',
        {
          modelRatio: modelRatio,
          cacheRatio: cacheRatio,
          completionRatio: completionRatio,
          imageRatio: imageRatio,
          ratioType: ratioLabel,
          ratio,
        },
      );
    } else if (webSearch) {
      return i18next.t(
        '模型倍率 {{modelRatio}}，缓存倍率 {{cacheRatio}}，输出倍率 {{completionRatio}}，{{ratioType}} {{ratio}}，Web 搜索调用 {{webSearchCallCount}} 次',
        {
          modelRatio: modelRatio,
          cacheRatio: cacheRatio,
          completionRatio: completionRatio,
          ratioType: ratioLabel,
          ratio,
          webSearchCallCount,
        },
      );
    } else {
      return i18next.t(
        '模型倍率 {{modelRatio}}，缓存倍率 {{cacheRatio}}，输出倍率 {{completionRatio}}，{{ratioType}} {{ratio}}',
        {
          modelRatio: modelRatio,
          cacheRatio: cacheRatio,
          completionRatio: completionRatio,
          ratioType: ratioLabel,
          ratio,
        },
      );
    }
  }
}

export function renderModelPriceSimple(
  modelRatio,
  modelPrice = -1,
  groupRatio,
  user_group_ratio,
  cacheTokens = 0,
  cacheRatio = 1.0,
  cacheCreationTokens = 0,
  cacheCreationRatio = 1.0,
  cacheCreationTokens5m = 0,
  cacheCreationRatio5m = 1.0,
  cacheCreationTokens1h = 0,
  cacheCreationRatio1h = 1.0,
  image = false,
  imageRatio = 1.0,
  isSystemPromptOverride = false,
  provider = 'openai',
  displayMode = 'price',
  outputMode = 'text',
) {
  return renderPriceSimpleCore({
    modelRatio,
    modelPrice,
    groupRatio,
    user_group_ratio,
    cacheTokens,
    cacheRatio,
    cacheCreationTokens,
    cacheCreationRatio,
    cacheCreationTokens5m,
    cacheCreationRatio5m,
    cacheCreationTokens1h,
    cacheCreationRatio1h,
    image,
    imageRatio,
    isSystemPromptOverride,
    displayMode,
    outputMode,
  });
}

export function renderAudioModelPrice(
  inputTokens,
  completionTokens,
  modelRatio,
  modelPrice = -1,
  completionRatio,
  audioInputTokens,
  audioCompletionTokens,
  audioRatio,
  audioCompletionRatio,
  groupRatio,
  user_group_ratio,
  cacheTokens = 0,
  cacheRatio = 1.0,
  displayMode = 'price',
) {
  const { ratio: effectiveGroupRatio, label: ratioLabel } = getEffectiveRatio(
    groupRatio,
    user_group_ratio,
  );
  groupRatio = effectiveGroupRatio;

  // 获取货币配置
  const { symbol, rate } = getCurrencyConfig();

  if (!shouldUseRatioBillingProcess(modelPrice)) {
    if (modelPrice !== -1) {
      return renderBillingArticle([
        buildBillingPriceText('模型价格：{{symbol}}{{price}} / 次', {
          symbol,
          usdAmount: modelPrice,
          rate,
        }),
        buildBillingPriceText(
          '模型价格 {{symbol}}{{price}} / 次 * {{ratioType}} {{ratio}} = {{symbol}}{{total}}',
          {
            symbol,
            usdAmount: modelPrice,
            rate,
            ratioType: ratioLabel,
            ratio: groupRatio,
            total: formatBillingDisplayPrice(modelPrice * groupRatio, rate),
          },
        ),
      ]);
    }

    if (completionRatio === undefined) {
      completionRatio = 0;
    }
    audioRatio = parseFloat(audioRatio).toFixed(6);
    const inputRatioPrice = modelRatio * 2.0;
    const completionRatioPrice = modelRatio * 2.0 * completionRatio;
    const textPrice =
      ((inputTokens - cacheTokens + cacheTokens * cacheRatio) / 1000000) *
        inputRatioPrice *
        groupRatio +
      (completionTokens / 1000000) * completionRatioPrice * groupRatio;
    const audioPrice =
      (audioInputTokens / 1000000) * inputRatioPrice * audioRatio * groupRatio +
      (audioCompletionTokens / 1000000) *
        inputRatioPrice *
        audioRatio *
        audioCompletionRatio *
        groupRatio;
    const totalPrice = textPrice + audioPrice;

    return renderBillingArticle([
      buildBillingPriceText('输入价格：{{symbol}}{{price}} / 1M tokens', {
        symbol,
        usdAmount: inputRatioPrice,
        rate,
      }),
      buildBillingPriceText('输出价格：{{symbol}}{{price}} / 1M tokens', {
        symbol,
        usdAmount: completionRatioPrice,
        rate,
      }),
      cacheTokens > 0
        ? buildBillingPriceText(
            '缓存读取价格：{{symbol}}{{price}} / 1M tokens',
            {
              symbol,
              usdAmount: inputRatioPrice * cacheRatio,
              rate,
            },
          )
        : null,
      buildBillingPriceText('音频输入价格：{{symbol}}{{price}} / 1M tokens', {
        symbol,
        usdAmount: inputRatioPrice * audioRatio,
        rate,
      }),
      buildBillingPriceText('音频补全价格：{{symbol}}{{price}} / 1M tokens', {
        symbol,
        usdAmount: inputRatioPrice * audioRatio * audioCompletionRatio,
        rate,
      }),
      buildBillingText(
        '文字提示 {{input}} tokens / 1M tokens * {{symbol}}{{textInputPrice}} + 文字补全 {{completion}} tokens / 1M tokens * {{symbol}}{{textCompPrice}} + 音频提示 {{audioInput}} tokens / 1M tokens * {{symbol}}{{audioInputPrice}} + 音频补全 {{audioCompletion}} tokens / 1M tokens * {{symbol}}{{audioCompPrice}} * {{ratioType}} {{ratio}} = {{symbol}}{{total}}',
        {
          input: inputTokens,
          completion: completionTokens,
          audioInput: audioInputTokens,
          audioCompletion: audioCompletionTokens,
          textInputPrice: formatBillingDisplayPrice(inputRatioPrice, rate),
          textCompPrice: formatBillingDisplayPrice(completionRatioPrice, rate),
          audioInputPrice: formatBillingDisplayPrice(
            audioRatio * inputRatioPrice,
            rate,
          ),
          audioCompPrice: formatBillingDisplayPrice(
            audioRatio * audioCompletionRatio * inputRatioPrice,
            rate,
          ),
          ratioType: ratioLabel,
          ratio: groupRatio,
          symbol,
          total: formatBillingDisplayPrice(totalPrice, rate),
        },
      ),
    ]);
  }

  // 1 ratio = $0.002 / 1K tokens
  if (modelPrice !== -1) {
    return i18next.t(
      '模型价格：{{symbol}}{{price}} * {{ratioType}}：{{ratio}} = {{symbol}}{{total}}',
      {
        symbol: symbol,
        price: (modelPrice * rate).toFixed(6),
        ratio: groupRatio,
        total: (modelPrice * groupRatio * rate).toFixed(6),
        ratioType: ratioLabel,
      },
    );
  }

  if (completionRatio === undefined) {
    completionRatio = 0;
  }

  const modelRatioValue = formatRatioValue(modelRatio);
  const completionRatioValue = formatRatioValue(completionRatio);
  const cacheRatioValue = formatRatioValue(cacheRatio);
  const audioRatioValue = formatRatioValue(audioRatio);
  const audioCompletionRatioValue = formatRatioValue(audioCompletionRatio);

  const inputRatioPrice = modelRatio * 2.0;
  const completionRatioPrice = modelRatio * 2.0 * completionRatioValue;

  const effectiveInputTokens =
    inputTokens - cacheTokens + cacheTokens * cacheRatioValue;

  const textPrice =
    (effectiveInputTokens / 1000000) * inputRatioPrice * groupRatio +
    (completionTokens / 1000000) * completionRatioPrice * groupRatio;
  const audioPrice =
    (audioInputTokens / 1000000) *
      inputRatioPrice *
      audioRatioValue *
      groupRatio +
    (audioCompletionTokens / 1000000) *
      inputRatioPrice *
      audioRatioValue *
      audioCompletionRatioValue *
      groupRatio;
  const totalPrice = textPrice + audioPrice;

  return renderBillingArticle([
    buildBillingText(
      '模型倍率 {{modelRatio}}，补全倍率 {{completionRatio}}，音频倍率 {{audioRatio}}，音频补全倍率 {{audioCompletionRatio}}，{{cachePart}}{{ratioType}} {{ratio}}',
      {
        modelRatio: modelRatioValue,
        completionRatio: completionRatioValue,
        audioRatio: audioRatioValue,
        audioCompletionRatio: audioCompletionRatioValue,
        cachePart:
          cacheTokens > 0
            ? `${i18next.t('缓存倍率')} ${cacheRatioValue}，`
            : '',
        ratioType: ratioLabel,
        ratio: groupRatio,
      },
    ),
    buildBillingText(
      '普通输入：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * {{ratioType}} {{ratio}} = {{amount}}',
      {
        tokens: Math.max(inputTokens - cacheTokens, 0),
        modelRatio: modelRatioValue,
        ratioType: ratioLabel,
        ratio: groupRatio,
        amount: renderDisplayAmountFromUsd(
          (Math.max(inputTokens - cacheTokens, 0) / 1000000) *
            inputRatioPrice *
            groupRatio,
        ),
      },
    ),
    cacheTokens > 0
      ? buildBillingText(
          '缓存输入：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * 缓存倍率 {{cacheRatio}} * {{ratioType}} {{ratio}} = {{amount}}',
          {
            tokens: cacheTokens,
            modelRatio: modelRatioValue,
            cacheRatio: cacheRatioValue,
            ratioType: ratioLabel,
            ratio: groupRatio,
            amount: renderDisplayAmountFromUsd(
              (cacheTokens / 1000000) *
                inputRatioPrice *
                cacheRatioValue *
                groupRatio,
            ),
          },
        )
      : null,
    buildBillingText(
      '文字输出：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * 补全倍率 {{completionRatio}} * {{ratioType}} {{ratio}} = {{amount}}',
      {
        tokens: completionTokens,
        modelRatio: modelRatioValue,
        completionRatio: completionRatioValue,
        ratioType: ratioLabel,
        ratio: groupRatio,
        amount: renderDisplayAmountFromUsd(
          (completionTokens / 1000000) *
            inputRatioPrice *
            completionRatioValue *
            groupRatio,
        ),
      },
    ),
    buildBillingText(
      '音频输入：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * 音频倍率 {{audioRatio}} * {{ratioType}} {{ratio}} = {{amount}}',
      {
        tokens: audioInputTokens,
        modelRatio: modelRatioValue,
        audioRatio: audioRatioValue,
        ratioType: ratioLabel,
        ratio: groupRatio,
        amount: renderDisplayAmountFromUsd(
          (audioInputTokens / 1000000) *
            inputRatioPrice *
            audioRatioValue *
            groupRatio,
        ),
      },
    ),
    buildBillingText(
      '音频输出：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * 音频倍率 {{audioRatio}} * 音频补全倍率 {{audioCompletionRatio}} * {{ratioType}} {{ratio}} = {{amount}}',
      {
        tokens: audioCompletionTokens,
        modelRatio: modelRatioValue,
        audioRatio: audioRatioValue,
        audioCompletionRatio: audioCompletionRatioValue,
        ratioType: ratioLabel,
        ratio: groupRatio,
        amount: renderDisplayAmountFromUsd(
          (audioCompletionTokens / 1000000) *
            inputRatioPrice *
            audioRatioValue *
            audioCompletionRatioValue *
            groupRatio,
        ),
      },
    ),
    buildBillingText(
      '合计：文字部分 {{textTotal}} + 音频部分 {{audioTotal}} = {{total}}',
      {
        textTotal: renderDisplayAmountFromUsd(textPrice),
        audioTotal: renderDisplayAmountFromUsd(audioPrice),
        total: renderDisplayAmountFromUsd(totalPrice),
      },
    ),
  ]);
}

export function renderQuotaWithPrompt(quota, digits) {
  const quotaDisplayType = localStorage.getItem('quota_display_type') || 'USD';
  if (quotaDisplayType !== 'TOKENS') {
    return i18next.t('等价金额：') + renderQuota(quota, digits);
  }
  return '';
}

export function renderClaudeModelPrice(
  inputTokens,
  completionTokens,
  modelRatio,
  modelPrice = -1,
  completionRatio,
  groupRatio,
  user_group_ratio,
  cacheTokens = 0,
  cacheRatio = 1.0,
  cacheCreationTokens = 0,
  cacheCreationRatio = 1.0,
  cacheCreationTokens5m = 0,
  cacheCreationRatio5m = 1.0,
  cacheCreationTokens1h = 0,
  cacheCreationRatio1h = 1.0,
  displayMode = 'price',
) {
  const { ratio: effectiveGroupRatio, label: ratioLabel } = getEffectiveRatio(
    groupRatio,
    user_group_ratio,
  );
  groupRatio = effectiveGroupRatio;

  // 获取货币配置
  const { symbol, rate } = getCurrencyConfig();

  if (!shouldUseRatioBillingProcess(modelPrice)) {
    if (modelPrice !== -1) {
      return renderBillingArticle([
        buildBillingPriceText('模型价格：{{symbol}}{{price}} / 次', {
          symbol,
          usdAmount: modelPrice,
          rate,
        }),
        buildBillingPriceText(
          '模型价格 {{symbol}}{{price}} / 次 * {{ratioType}} {{ratio}} = {{symbol}}{{total}}',
          {
            symbol,
            usdAmount: modelPrice,
            rate,
            ratioType: ratioLabel,
            ratio: groupRatio,
            total: formatBillingDisplayPrice(modelPrice * groupRatio, rate),
          },
        ),
      ]);
    }

    if (completionRatio === undefined) {
      completionRatio = 0;
    }

    const inputRatioPrice = modelRatio * 2.0;
    const completionRatioPrice = modelRatio * 2.0 * completionRatio;
    const cacheRatioPrice = modelRatio * 2.0 * cacheRatio;
    const cacheCreationRatioPrice = modelRatio * 2.0 * cacheCreationRatio;
    const cacheCreationRatioPrice5m = modelRatio * 2.0 * cacheCreationRatio5m;
    const cacheCreationRatioPrice1h = modelRatio * 2.0 * cacheCreationRatio1h;
    const hasSplitCacheCreation =
      cacheCreationTokens5m > 0 || cacheCreationTokens1h > 0;
    const legacyCacheCreationTokens = hasSplitCacheCreation
      ? 0
      : cacheCreationTokens;
    const effectiveInputTokens =
      inputTokens +
      cacheTokens * cacheRatio +
      legacyCacheCreationTokens * cacheCreationRatio +
      cacheCreationTokens5m * cacheCreationRatio5m +
      cacheCreationTokens1h * cacheCreationRatio1h;
    const price =
      (effectiveInputTokens / 1000000) * inputRatioPrice * groupRatio +
      (completionTokens / 1000000) * completionRatioPrice * groupRatio;
    const inputUnitPrice = inputRatioPrice * rate;
    const completionUnitPrice = completionRatioPrice * rate;
    const cacheUnitPrice = cacheRatioPrice * rate;
    const cacheCreationUnitPrice = cacheCreationRatioPrice * rate;
    const cacheCreationUnitPrice5m = cacheCreationRatioPrice5m * rate;
    const cacheCreationUnitPrice1h = cacheCreationRatioPrice1h * rate;
    const cacheCreationUnitPriceTotal =
      cacheCreationUnitPrice5m + cacheCreationUnitPrice1h;
    const shouldShowCache = cacheTokens > 0;
    const shouldShowLegacyCacheCreation =
      !hasSplitCacheCreation && cacheCreationTokens > 0;
    const shouldShowCacheCreation5m =
      hasSplitCacheCreation && cacheCreationTokens5m > 0;
    const shouldShowCacheCreation1h =
      hasSplitCacheCreation && cacheCreationTokens1h > 0;

    const breakdownSegments = [
      i18next.t('提示 {{input}} tokens / 1M tokens * {{symbol}}{{price}}', {
        input: inputTokens,
        symbol,
        price: inputUnitPrice.toFixed(6),
      }),
    ];

    if (shouldShowCache) {
      breakdownSegments.push(
        i18next.t('缓存 {{tokens}} tokens / 1M tokens * {{symbol}}{{price}}', {
          tokens: cacheTokens,
          symbol,
          price: cacheUnitPrice.toFixed(6),
        }),
      );
    }

    if (shouldShowLegacyCacheCreation) {
      breakdownSegments.push(
        i18next.t(
          '缓存创建 {{tokens}} tokens / 1M tokens * {{symbol}}{{price}}',
          {
            tokens: cacheCreationTokens,
            symbol,
            price: cacheCreationUnitPrice.toFixed(6),
          },
        ),
      );
    }

    if (shouldShowCacheCreation5m) {
      breakdownSegments.push(
        i18next.t(
          '5m缓存创建 {{tokens}} tokens / 1M tokens * {{symbol}}{{price}}',
          {
            tokens: cacheCreationTokens5m,
            symbol,
            price: cacheCreationUnitPrice5m.toFixed(6),
          },
        ),
      );
    }

    if (shouldShowCacheCreation1h) {
      breakdownSegments.push(
        i18next.t(
          '1h缓存创建 {{tokens}} tokens / 1M tokens * {{symbol}}{{price}}',
          {
            tokens: cacheCreationTokens1h,
            symbol,
            price: cacheCreationUnitPrice1h.toFixed(6),
          },
        ),
      );
    }

    breakdownSegments.push(
      i18next.t(
        '补全 {{completion}} tokens / 1M tokens * {{symbol}}{{price}}',
        {
          completion: completionTokens,
          symbol,
          price: completionUnitPrice.toFixed(6),
        },
      ),
    );

    const breakdownText = breakdownSegments.join(' + ');

    return renderBillingArticle([
      buildBillingPriceText('输入价格：{{symbol}}{{price}} / 1M tokens', {
        symbol,
        usdAmount: inputRatioPrice,
        rate,
      }),
      buildBillingPriceText('输出价格：{{symbol}}{{price}} / 1M tokens', {
        symbol,
        usdAmount: completionRatioPrice,
        rate,
      }),
      cacheTokens > 0
        ? buildBillingPriceText(
            '缓存读取价格：{{symbol}}{{price}} / 1M tokens',
            {
              symbol,
              usdAmount: cacheRatioPrice,
              rate,
            },
          )
        : null,
      !hasSplitCacheCreation && cacheCreationTokens > 0
        ? buildBillingPriceText(
            '缓存创建价格：{{symbol}}{{price}} / 1M tokens',
            {
              symbol,
              usdAmount: cacheCreationRatioPrice,
              rate,
            },
          )
        : null,
      hasSplitCacheCreation && cacheCreationTokens5m > 0
        ? buildBillingPriceText(
            '5m缓存创建价格：{{symbol}}{{price}} / 1M tokens',
            {
              symbol,
              usdAmount: cacheCreationRatioPrice5m,
              rate,
            },
          )
        : null,
      hasSplitCacheCreation && cacheCreationTokens1h > 0
        ? buildBillingPriceText(
            '1h缓存创建价格：{{symbol}}{{price}} / 1M tokens',
            {
              symbol,
              usdAmount: cacheCreationRatioPrice1h,
              rate,
            },
          )
        : null,
      buildBillingText(
        '{{breakdown}} * {{ratioType}} {{ratio}} = {{symbol}}{{total}}',
        {
          breakdown: breakdownText,
          ratioType: ratioLabel,
          ratio: groupRatio,
          symbol,
          total: formatBillingDisplayPrice(price, rate),
        },
      ),
    ]);
  }

  if (modelPrice !== -1) {
    return i18next.t(
      '模型价格：{{symbol}}{{price}} * {{ratioType}}：{{ratio}} = {{symbol}}{{total}}',
      {
        symbol: symbol,
        price: (modelPrice * rate).toFixed(6),
        ratioType: ratioLabel,
        ratio: groupRatio,
        total: (modelPrice * groupRatio * rate).toFixed(6),
      },
    );
  }

  if (completionRatio === undefined) {
    completionRatio = 0;
  }

  const modelRatioValue = formatRatioValue(modelRatio);
  const completionRatioValue = formatRatioValue(completionRatio);
  const cacheRatioValue = formatRatioValue(cacheRatio);
  const cacheCreationRatioValue = formatRatioValue(cacheCreationRatio);
  const cacheCreationRatio5mValue = formatRatioValue(cacheCreationRatio5m);
  const cacheCreationRatio1hValue = formatRatioValue(cacheCreationRatio1h);

  const inputRatioPrice = modelRatio * 2.0;
  const completionRatioPrice = modelRatio * 2.0 * completionRatioValue;

  const hasSplitCacheCreation =
    cacheCreationTokens5m > 0 || cacheCreationTokens1h > 0;
  const shouldShowCache = cacheTokens > 0;
  const shouldShowLegacyCacheCreation =
    !hasSplitCacheCreation && cacheCreationTokens > 0;
  const shouldShowCacheCreation5m =
    hasSplitCacheCreation && cacheCreationTokens5m > 0;
  const shouldShowCacheCreation1h =
    hasSplitCacheCreation && cacheCreationTokens1h > 0;

  const legacyCacheCreationTokens = hasSplitCacheCreation
    ? 0
    : cacheCreationTokens;
  const effectiveInputTokens =
    inputTokens +
    cacheTokens * cacheRatioValue +
    legacyCacheCreationTokens * cacheCreationRatioValue +
    cacheCreationTokens5m * cacheCreationRatio5mValue +
    cacheCreationTokens1h * cacheCreationRatio1hValue;

  const totalAmount =
    (effectiveInputTokens / 1000000) * inputRatioPrice * groupRatio +
    (completionTokens / 1000000) * completionRatioPrice * groupRatio;

  return renderBillingArticle([
    buildBillingText(
      '模型倍率 {{modelRatio}}，输出倍率 {{completionRatio}}，缓存倍率 {{cacheRatio}}，{{ratioType}} {{ratio}}',
      {
        modelRatio: modelRatioValue,
        completionRatio: completionRatioValue,
        cacheRatio: cacheRatioValue,
        ratioType: ratioLabel,
        ratio: groupRatio,
      },
    ),
    hasSplitCacheCreation
      ? buildBillingText(
          '缓存创建倍率 5m {{cacheCreationRatio5m}} / 1h {{cacheCreationRatio1h}}',
          {
            cacheCreationRatio5m: cacheCreationRatio5mValue,
            cacheCreationRatio1h: cacheCreationRatio1hValue,
          },
        )
      : buildBillingText('缓存创建倍率 {{cacheCreationRatio}}', {
          cacheCreationRatio: cacheCreationRatioValue,
        }),
    buildBillingText(
      '普通输入：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * {{ratioType}} {{ratio}} = {{amount}}',
      {
        tokens: inputTokens,
        modelRatio: modelRatioValue,
        ratioType: ratioLabel,
        ratio: groupRatio,
        amount: renderDisplayAmountFromUsd(
          (inputTokens / 1000000) * inputRatioPrice * groupRatio,
        ),
      },
    ),
    shouldShowCache
      ? buildBillingText(
          '缓存读取：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * 缓存倍率 {{cacheRatio}} * {{ratioType}} {{ratio}} = {{amount}}',
          {
            tokens: cacheTokens,
            modelRatio: modelRatioValue,
            cacheRatio: cacheRatioValue,
            ratioType: ratioLabel,
            ratio: groupRatio,
            amount: renderDisplayAmountFromUsd(
              (cacheTokens / 1000000) *
                inputRatioPrice *
                cacheRatioValue *
                groupRatio,
            ),
          },
        )
      : null,
    shouldShowLegacyCacheCreation
      ? buildBillingText(
          '缓存创建：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * 缓存创建倍率 {{cacheCreationRatio}} * {{ratioType}} {{ratio}} = {{amount}}',
          {
            tokens: cacheCreationTokens,
            modelRatio: modelRatioValue,
            cacheCreationRatio: cacheCreationRatioValue,
            ratioType: ratioLabel,
            ratio: groupRatio,
            amount: renderDisplayAmountFromUsd(
              (cacheCreationTokens / 1000000) *
                inputRatioPrice *
                cacheCreationRatioValue *
                groupRatio,
            ),
          },
        )
      : null,
    shouldShowCacheCreation5m
      ? buildBillingText(
          '5m缓存创建：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * 5m缓存创建倍率 {{cacheCreationRatio5m}} * {{ratioType}} {{ratio}} = {{amount}}',
          {
            tokens: cacheCreationTokens5m,
            modelRatio: modelRatioValue,
            cacheCreationRatio5m: cacheCreationRatio5mValue,
            ratioType: ratioLabel,
            ratio: groupRatio,
            amount: renderDisplayAmountFromUsd(
              (cacheCreationTokens5m / 1000000) *
                inputRatioPrice *
                cacheCreationRatio5mValue *
                groupRatio,
            ),
          },
        )
      : null,
    shouldShowCacheCreation1h
      ? buildBillingText(
          '1h缓存创建：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * 1h缓存创建倍率 {{cacheCreationRatio1h}} * {{ratioType}} {{ratio}} = {{amount}}',
          {
            tokens: cacheCreationTokens1h,
            modelRatio: modelRatioValue,
            cacheCreationRatio1h: cacheCreationRatio1hValue,
            ratioType: ratioLabel,
            ratio: groupRatio,
            amount: renderDisplayAmountFromUsd(
              (cacheCreationTokens1h / 1000000) *
                inputRatioPrice *
                cacheCreationRatio1hValue *
                groupRatio,
            ),
          },
        )
      : null,
    buildBillingText(
      '补全 {{completion}} tokens * 输出倍率 {{completionRatio}}',
      {
        completion: completionTokens,
        completionRatio: completionRatioValue,
      },
    ),
    buildBillingText(
      '输出：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * 输出倍率 {{completionRatio}} * {{ratioType}} {{ratio}} = {{amount}}',
      {
        tokens: completionTokens,
        modelRatio: modelRatioValue,
        completionRatio: completionRatioValue,
        ratioType: ratioLabel,
        ratio: groupRatio,
        amount: renderDisplayAmountFromUsd(
          (completionTokens / 1000000) *
            inputRatioPrice *
            completionRatioValue *
            groupRatio,
        ),
      },
    ),
    buildBillingText('合计：{{total}}', {
      total: renderDisplayAmountFromUsd(totalAmount),
    }),
  ]);
}

export function renderClaudeLogContent(
  modelRatio,
  completionRatio,
  modelPrice = -1,
  groupRatio,
  user_group_ratio,
  cacheRatio = 1.0,
  cacheCreationRatio = 1.0,
  cacheCreationTokens5m = 0,
  cacheCreationRatio5m = 1.0,
  cacheCreationTokens1h = 0,
  cacheCreationRatio1h = 1.0,
  displayMode = 'price',
) {
  const { ratio: effectiveGroupRatio, label: ratioLabel } = getEffectiveRatio(
    groupRatio,
    user_group_ratio,
  );
  groupRatio = effectiveGroupRatio;

  // 获取货币配置
  const { symbol, rate } = getCurrencyConfig();

  if (isPriceDisplayMode(displayMode, modelPrice)) {
    if (modelPrice !== -1) {
      return joinBillingSummary([
        i18next.t('模型价格 {{symbol}}{{price}} / 次', {
          symbol,
          price: (modelPrice * rate).toFixed(6),
        }),
        getGroupRatioText(groupRatio, user_group_ratio),
      ]);
    }

    const parts = [
      i18next.t('输入价格 {{symbol}}{{price}} / 1M tokens', {
        symbol,
        price: (modelRatio * 2.0 * rate).toFixed(6),
      }),
      i18next.t('输出价格 {{symbol}}{{price}} / 1M tokens', {
        symbol,
        price: (modelRatio * 2.0 * completionRatio * rate).toFixed(6),
      }),
      i18next.t('缓存读取价格 {{symbol}}{{price}} / 1M tokens', {
        symbol,
        price: (modelRatio * 2.0 * cacheRatio * rate).toFixed(6),
      }),
    ];
    const hasSplitCacheCreation =
      cacheCreationTokens5m > 0 || cacheCreationTokens1h > 0;
    appendPricePart(
      parts,
      hasSplitCacheCreation && cacheCreationTokens5m > 0,
      '5m缓存创建价格 {{symbol}}{{price}} / 1M tokens',
      {
        symbol,
        price: (modelRatio * 2.0 * cacheCreationRatio5m * rate).toFixed(6),
      },
    );
    appendPricePart(
      parts,
      hasSplitCacheCreation && cacheCreationTokens1h > 0,
      '1h缓存创建价格 {{symbol}}{{price}} / 1M tokens',
      {
        symbol,
        price: (modelRatio * 2.0 * cacheCreationRatio1h * rate).toFixed(6),
      },
    );
    appendPricePart(
      parts,
      !hasSplitCacheCreation,
      '缓存创建价格 {{symbol}}{{price}} / 1M tokens',
      {
        symbol,
        price: (modelRatio * 2.0 * cacheCreationRatio * rate).toFixed(6),
      },
    );
    parts.push(getGroupRatioText(groupRatio, user_group_ratio));
    return joinBillingSummary(parts);
  }

  if (modelPrice !== -1) {
    return i18next.t('模型价格 {{symbol}}{{price}}，{{ratioType}} {{ratio}}', {
      symbol: symbol,
      price: (modelPrice * rate).toFixed(6),
      ratioType: ratioLabel,
      ratio: groupRatio,
    });
  } else {
    const hasSplitCacheCreation =
      cacheCreationTokens5m > 0 || cacheCreationTokens1h > 0;
    const shouldShowCacheCreation5m =
      hasSplitCacheCreation && cacheCreationTokens5m > 0;
    const shouldShowCacheCreation1h =
      hasSplitCacheCreation && cacheCreationTokens1h > 0;

    let cacheCreationPart = null;
    if (hasSplitCacheCreation) {
      if (shouldShowCacheCreation5m && shouldShowCacheCreation1h) {
        cacheCreationPart = i18next.t(
          '缓存创建倍率 5m {{cacheCreationRatio5m}} / 1h {{cacheCreationRatio1h}}',
          {
            cacheCreationRatio5m,
            cacheCreationRatio1h,
          },
        );
      } else if (shouldShowCacheCreation5m) {
        cacheCreationPart = i18next.t(
          '缓存创建倍率 5m {{cacheCreationRatio5m}}',
          {
            cacheCreationRatio5m,
          },
        );
      } else if (shouldShowCacheCreation1h) {
        cacheCreationPart = i18next.t(
          '缓存创建倍率 1h {{cacheCreationRatio1h}}',
          {
            cacheCreationRatio1h,
          },
        );
      }
    }

    if (!cacheCreationPart) {
      cacheCreationPart = i18next.t('缓存创建倍率 {{cacheCreationRatio}}', {
        cacheCreationRatio,
      });
    }

    const parts = [
      i18next.t('模型倍率 {{modelRatio}}', { modelRatio }),
      i18next.t('输出倍率 {{completionRatio}}', { completionRatio }),
      i18next.t('缓存倍率 {{cacheRatio}}', { cacheRatio }),
      cacheCreationPart,
      i18next.t('{{ratioType}} {{ratio}}', {
        ratioType: ratioLabel,
        ratio: groupRatio,
      }),
    ];

    return parts.join('，');
  }
}

// 已统一至 renderModelPriceSimple，若仍有遗留引用，请改为传入 provider='claude'

/**
 * rehype 插件：将段落等文本节点拆分为逐词 <span>，并添加淡入动画 class。
 * 仅在流式渲染阶段使用，避免已渲染文字重复动画。
 */
export function rehypeSplitWordsIntoSpans(options = {}) {
  const { previousContentLength = 0 } = options;

  return (tree) => {
    let currentCharCount = 0; // 当前已处理的字符数

    visit(tree, 'element', (node) => {
      if (
        ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'strong'].includes(
          node.tagName,
        ) &&
        node.children
      ) {
        const newChildren = [];
        node.children.forEach((child) => {
          if (child.type === 'text') {
            try {
              // 使用 Intl.Segmenter 精准拆分中英文及标点
              const segmenter = new Intl.Segmenter('zh', {
                granularity: 'word',
              });
              const segments = segmenter.segment(child.value);

              Array.from(segments)
                .map((seg) => seg.segment)
                .filter(Boolean)
                .forEach((word) => {
                  const wordStartPos = currentCharCount;
                  const wordEndPos = currentCharCount + word.length;

                  // 判断这个词是否是新增的（在 previousContentLength 之后）
                  const isNewContent = wordStartPos >= previousContentLength;

                  newChildren.push({
                    type: 'element',
                    tagName: 'span',
                    properties: {
                      className: isNewContent ? ['animate-fade-in'] : [],
                    },
                    children: [{ type: 'text', value: word }],
                  });

                  currentCharCount = wordEndPos;
                });
            } catch (_) {
              // Fallback：如果浏览器不支持 Segmenter
              const textStartPos = currentCharCount;
              const isNewContent = textStartPos >= previousContentLength;

              if (isNewContent) {
                // 新内容，添加动画
                newChildren.push({
                  type: 'element',
                  tagName: 'span',
                  properties: {
                    className: ['animate-fade-in'],
                  },
                  children: [{ type: 'text', value: child.value }],
                });
              } else {
                // 旧内容，不添加动画
                newChildren.push(child);
              }

              currentCharCount += child.value.length;
            }
          } else {
            newChildren.push(child);
          }
        });
        node.children = newChildren;
      }
    });
  };
}
