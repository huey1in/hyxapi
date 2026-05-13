# Routify UI 风格规范

本文档定义 Routify 前端的视觉设计系统。所有 UI 优化和新页面必须遵循此规范。

## 设计哲学

暖色调极简主义。大量留白，圆润形态，克制用色。信息密度适中，操作路径清晰。

## 色彩系统

| 用途 | 色值 |
|------|------|
| 页面背景 | `#FFFDF7`（暖白） |
| 卡片/容器背景 | `#FFFDF7` |
| 次级填充（选中态/hover/subtle） | `#F2F0E9` |
| 主边框 | `#e9e9e9` |
| 输入框边框 | `#e3e3e3` |
| 分隔线 | `#eeeeee` |
| 主文字 | `#000` / `#080808` |
| 二级文字 | `#666` |
| 三级文字/标签 | `#999` / `#8f8f8f` |
| 强调色（按钮/选中） | `#000` / `#222` |
| 代码块背景 | `#F2F0E9` |

## 圆角体系

| 元素 | 圆角 |
|------|------|
| 大卡片/区块容器 | `26px` |
| 中型容器（筛选面板/子卡片） | `16px` |
| 表格容器 | `16px`（使用 Table 原子组件默认 rounded-2xl） |
| 列表项/输入框容器 | `12px` |
| 按钮（pill 形） | `24px` / `999px`（全圆） |
| Tab 按钮 | `14px`~`15px` |
| 小标签/pill badge | `13px`~`14px` |

## 布局规范

- 页面内容区最大宽度：`740px`，水平居中 `marginInline: auto`
- 页面内边距：`padding: 24px 16px`
- 区块间距：`gap: 28px`（主区块）/ `gap: 20px`（紧凑）/ `gap: 12px`（内部）
- 统计卡片内边距：`paddingBlock: 26px, paddingInline: 20px`
- 表格行高：由 Table 组件 size='sm' 控制（`px-3 py-2`）

## 字体

- 主字体：`Kefaiii, Gilroy, Noto Sans SC, -apple-system, sans-serif`
- 等宽字体：`JetBrains Mono`
- 标题：18px, fontWeight 600
- 正文：14px, fontWeight 400
- 标签/辅助：12px~13px
- 大数字（统计）：28px, fontWeight 700
- 数字对齐：`fontVariantNumeric: 'tabular-nums'`

## 组件使用规范

### 必须使用原子组件（`components/ui/`）

- `Button` — 所有按钮
- `IconButton` — 图标按钮
- `Input` — 文本输入（onChange 接收 value 而非 event）
- `Select` / `MultiSelect` — 下拉选择
- `Table` — 数据表格
- `Modal` — 弹窗
- `SlideOver` — 侧滑面板
- `Pagination` — 分页
- `Tag` — 标签
- `Loading` — 加载状态
- `CodeBlock` — 代码展示
- `ConfirmDialog` — 确认对话框

### 禁止

- 禁止使用 Semi UI 或其他第三方 UI 库
- 禁止在业务页面写裸 `<table>` 标签，使用 Table 组件
- 禁止给 Input 组件传 className（通过 props 控制视觉）

## 交互模式

### 按钮样式

- 主按钮：黑底白字，border-radius 24px，height 32px
- 次级按钮（variant='toggle'）：白底黑边，hover 时反转为黑底白字
- 全宽操作按钮：border-radius 999px，height 48px，黑底
- 快捷金额选择：height 45px，border-radius 10px，选中 2px solid #000

### 卡片内标题

```
<span style={{ fontSize: 18, fontWeight: 600, color: '#000' }}>标题</span>
```

### 筛选面板

- 容器：border-radius 16px，border 1px solid #e9e9e9，padding 16px
- 内部：grid 4列布局，gap 10px
- 标签：fontSize 12，color #999，marginBottom 4

### 表格

- 使用 `<Table columns={...} rows={...} />` 原子组件
- 行点击展开详情时，详情面板独立渲染在表格下方
- Token 用量使用 pill badge：总量深色底，输入/输出浅边框

### Tab 切换

```jsx
<button style={{
  height: 28~30, paddingInline: 12, borderRadius: 14~15,
  fontSize: 13, border: 'none',
  color: active ? '#000' : '#666',
  background: active ? '#F2F0E9' : 'transparent',
}}>
```

### 侧边栏

- 宽度：展开 256px / 折叠 57px
- 导航项：h-9 px-[10px] rounded-lg
- 选中态：bg-[#F2F0E9] font-medium
- 不同类型页面之间用 1px #eeeeee 分隔线隔开

## 样式编写方式

- 优先使用 inline style 确保像素级精确
- Tailwind 仅用于简单的 flex/grid 布局和 hover/transition
- 不使用 CSS Modules
- 颜色值直接写十六进制，不引用 CSS 变量（页面级组件中）
- 原子组件内部使用 CSS 变量和 Tailwind

## 页面结构模板

```jsx
const XxxPage = () => {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 28,
      width: '100%', maxWidth: 740, marginInline: 'auto',
      padding: '24px 16px',
    }}>
      {/* 页面标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#000' }}>页面标题</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {/* 操作按钮 */}
        </div>
      </div>

      {/* 内容区块 */}
      <div style={{ padding: '20px 22px', border: '1px solid #e9e9e9', borderRadius: 26 }}>
        ...
      </div>
    </div>
  );
};
```
