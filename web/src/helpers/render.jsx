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

import { visit } from 'unist-util-visit';
import { Layers } from 'lucide-react';

// 获取侧边栏Lucide图标组件
const MODEL_ICON_CDN = 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/light';

const MODEL_ICON_SLUGS = {
  openai: 'openai',
  anthropic: 'anthropic',
  claude: 'claude',
  gemini: 'gemini',
  deepseek: 'deepseek',
  mistral: 'mistral',
  xai: 'xai',
  openrouter: 'openrouter',
  moonshot: 'moonshot',
  kimi: 'moonshot',
  qwen: 'qwen',
  zhipu: 'zhipu',
  minimax: 'minimax',
  cohere: 'cohere',
  cloudflare: 'cloudflare',
  meta: 'meta',
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

/**
 * 获取当前货币配置信息
 * @returns {{ symbol: string, rate: number, type: string }}
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
