/*
 * Tooltip — 统一提示气泡（基于 title 属性的轻量实现）
 *
 * 使用：
 *   <Tooltip content='提示文本'>
 *     <button>悬停</button>
 *   </Tooltip>
 *
 * 注：当前为基础实现，使用浏览器原生 title。后续可升级为 portal-based 自定义气泡。
 */

import React, { cloneElement, isValidElement } from 'react';

const Tooltip = ({ content, children }) => {
  if (!content) return children;
  if (isValidElement(children)) {
    return cloneElement(children, { title: content });
  }
  return <span title={content}>{children}</span>;
};

export default Tooltip;
