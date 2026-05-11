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

import React, { useState, useRef, useEffect } from 'react';
import { useMinimumLoadingTime } from '../../../hooks/common/useMinimumLoadingTime';
import { useContainerWidth } from '../../../hooks/common/useContainerWidth';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * 通用可选择按钮组组件
 *
 * @param {string} title 标题
 * @param {Array<{value:any,label:string,icon?:React.ReactNode,tagCount?:number}>} items 按钮项
 * @param {*|Array} activeValue 当前激活的值，可以是单个值或数组（多选）
 * @param {(value:any)=>void} onChange 选择改变回调
 * @param {function} t i18n
 * @param {object} style 额外样式
 * @param {boolean} collapsible 是否支持折叠，默认true
 * @param {number} collapseHeight 折叠时的高度，默认200
 * @param {boolean} withCheckbox 是否启用前缀 Checkbox 来控制激活状态
 * @param {boolean} loading 是否处于加载状态
 * @param {string} variant 颜色变体: 'violet' | 'teal' | 'amber' | 'rose' | 'green'，不传则使用默认蓝色
 */
const SelectableButtonGroup = ({
  title,
  items = [],
  activeValue,
  onChange,
  t = (v) => v,
  style = {},
  collapsible = true,
  collapseHeight = 200,
  withCheckbox = false,
  loading = false,
  variant,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [skeletonCount] = useState(12);
  const [containerRef, containerWidth] = useContainerWidth();

  const ConditionalTooltipText = ({ text }) => {
    const textRef = useRef(null);
    const [isOverflowing, setIsOverflowing] = useState(false);

    useEffect(() => {
      const el = textRef.current;
      if (!el) return;
      setIsOverflowing(el.scrollWidth > el.clientWidth);
    }, [text, containerWidth]);

    const textElement = (
      <span ref={textRef} className='sbg-ellipsis'>
        {text}
      </span>
    );

    return isOverflowing ? (
      <span title={text}>{textElement}</span>
    ) : (
      textElement
    );
  };

  // 基于容器宽度计算响应式列数和标签显示策略
  const getResponsiveConfig = () => {
    if (containerWidth <= 280) return { columns: 1, showTags: true }; // 极窄：1列+标签
    if (containerWidth <= 380) return { columns: 2, showTags: true }; // 窄屏：2列+标签
    if (containerWidth <= 460) return { columns: 3, showTags: false }; // 中等：3列不加标签
    return { columns: 3, showTags: true }; // 最宽：3列+标签
  };

  const { columns: perRow, showTags: shouldShowTags } = getResponsiveConfig();
  const maxVisibleRows = Math.max(1, Math.floor(collapseHeight / 32)); // Approx row height 32
  const needCollapse = collapsible && items.length > perRow * maxVisibleRows;
  const showSkeleton = useMinimumLoadingTime(loading);

  // 统一使用紧凑的网格间距
  const gutterSize = [4, 4];

  // 计算网格列样式
  const getGridStyle = () => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${perRow}, 1fr)`,
    gap: '4px',
    lineHeight: '32px',
    ...style,
  });

  const maskStyle = isOpen
    ? {}
    : {
        WebkitMaskImage:
          'linear-gradient(to bottom, black 0%, rgba(0, 0, 0, 1) 60%, rgba(0, 0, 0, 0.2) 80%, transparent 100%)',
      };

  const toggle = () => {
    setIsOpen(!isOpen);
  };

  const linkStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    bottom: -10,
    fontWeight: 400,
    cursor: 'pointer',
    fontSize: '12px',
    color: 'var(--semi-color-text-2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  };

  const renderSkeletonButtons = () => {
    return (
      <div style={getGridStyle()}>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <div
            key={index}
            className='animate-pulse'
            style={{
              width: '100%',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              border: '1px solid var(--semi-color-border)',
              borderRadius: 'var(--semi-border-radius-medium)',
              padding: '0 12px',
              gap: '6px',
            }}
          >
            {withCheckbox && (
              <div className='bg-gray-200 rounded' style={{ width: 14, height: 14 }} />
            )}
            <div
              className='bg-gray-200 rounded'
              style={{ width: `${60 + (index % 3) * 20}px`, height: 14 }}
            />
          </div>
        ))}
      </div>
    );
  };

  const contentElement = showSkeleton ? (
    renderSkeletonButtons()
  ) : (
    <div style={getGridStyle()}>
      {items.map((item) => {
        const isActive = Array.isArray(activeValue)
          ? activeValue.includes(item.value)
          : activeValue === item.value;

        if (withCheckbox) {
          return (
            // SelectableButtonGroup 视觉系底层（依赖外部 .sbg-button CSS）
            <button
              key={item.value}
              type='button'
              onClick={() => {}}
              className={`sbg-button ${isActive ? 'sbg-button-active' : 'sbg-button-inactive'}`}
              style={{ width: '100%', cursor: 'default' }}
            >
              <span className='inline-flex items-center mr-1.5'>
                <input
                  type='checkbox'
                  checked={isActive}
                  onChange={() => onChange(item.value)}
                  className='w-3.5 h-3.5'
                  style={{ pointerEvents: 'auto' }}
                />
              </span>
              <div className='sbg-content'>
                {item.icon && <span className='sbg-icon'>{item.icon}</span>}
                <ConditionalTooltipText text={item.label} />
                {item.tagCount !== undefined && shouldShowTags && (
                  <span className={`sbg-badge ${isActive ? 'sbg-badge-active' : ''}`}>
                    {item.tagCount}
                  </span>
                )}
              </div>
            </button>
          );
        }

        return (
          // SelectableButtonGroup 视觉系底层
          <button
            key={item.value}
            type='button'
            onClick={() => onChange(item.value)}
            className={`sbg-button ${isActive ? 'sbg-button-active' : 'sbg-button-inactive'}`}
            style={{ width: '100%' }}
          >
            <div className='sbg-content'>
              {item.icon && <span className='sbg-icon'>{item.icon}</span>}
              <ConditionalTooltipText text={item.label} />
              {item.tagCount !== undefined && shouldShowTags && item.tagCount !== '' && (
                <span className={`sbg-badge ${isActive ? 'sbg-badge-active' : ''}`}>
                  {item.tagCount}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className={`mb-8 ${containerWidth <= 400 ? 'sbg-compact' : ''}${variant ? ` sbg-variant-${variant}` : ''}`}
      ref={containerRef}
    >
      {title && (
        <div className='flex items-center gap-2 my-3'>
          <hr className='flex-1' style={{ borderColor: 'var(--semi-color-border)' }} />
          <span className='text-xs text-gray-500 whitespace-nowrap'>
            {showSkeleton ? (
              <span className='inline-block animate-pulse bg-gray-200 rounded' style={{ width: 80, height: 14 }} />
            ) : (
              title
            )}
          </span>
          <hr className='flex-1' style={{ borderColor: 'var(--semi-color-border)' }} />
        </div>
      )}
      {needCollapse && !showSkeleton ? (
        <div style={{ position: 'relative' }}>
          <div
            style={{
              maxHeight: isOpen ? 'none' : collapseHeight,
              overflow: 'hidden',
              transition: 'max-height 0.3s ease',
              ...maskStyle,
            }}
          >
            {contentElement}
          </div>
          {isOpen ? null : (
            <div onClick={toggle} style={{ ...linkStyle }}>
              <ChevronDown size={12} />
              <span>{t('展开更多')}</span>
            </div>
          )}
          {isOpen && (
            <div
              onClick={toggle}
              style={{
                ...linkStyle,
                position: 'static',
                marginTop: 8,
                bottom: 'auto',
              }}
            >
              <ChevronUp size={12} />
              <span>{t('收起')}</span>
            </div>
          )}
        </div>
      ) : (
        contentElement
      )}
    </div>
  );
};

export default SelectableButtonGroup;
