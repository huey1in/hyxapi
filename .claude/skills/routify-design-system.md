# Routify 设计系统规范

当你在本项目中编写或修改前端代码时，必须遵循以下设计规范。

---

## 1. CSS 设计令牌

所有颜色通过 CSS 变量定义在 `web/src/index.css`，Tailwind 通过 `tailwind.config.js` 映射。

### 亮色模式（:root）
```
--page-bg:          #f8f8f6      /* 页面主背景 */
--ui-bg:            #ffffff      /* 基础白 */
--ui-bg-elevated:   #ffffff      /* 浮层/卡片 */
--ui-bg-subtle:     #f4f4f5      /* hover/active 背景 */
--ui-border:        #e4e4e7      /* 边框 */
--ui-divider:       #f4f4f5      /* 分割线 */
--ui-text:          #18181b      /* 主文字 */
--ui-text-2:        #71717a      /* 次要文字 */
--ui-text-3:        #a1a1aa      /* 辅助文字 */
--ui-accent:        #18181b      /* 强调按钮背景 */
--ui-accent-fg:     #ffffff      /* 强调按钮文字 */
--ui-accent-hover:  #3f3f46      /* 强调按钮 hover */
--ui-danger:        #ef4444      /* 危险色 */
--ui-danger-bg:     #fef2f2      /* 危险背景 */
--ui-brand:         #3b82f6      /* 品牌蓝 */
--header-height:    76px         /* 导航栏高度 */
--sidebar-width:    180px        /* 侧边栏宽度 */
```

### 暗色模式（html.dark）
```
--page-bg:          #1a1a18
--ui-bg:            #09090b
--ui-bg-elevated:   #18181b
--ui-bg-subtle:     #27272a
--ui-border:        #27272a
--ui-text:          #fafafa
--ui-text-2:        #a1a1aa
--ui-text-3:        #52525b
--ui-accent:        #ffffff
--ui-accent-fg:     #09090b
--ui-accent-hover:  #e4e4e7
--ui-danger:        #f87171
--ui-brand:         #60a5fa
```

### 使用规则
- 页面/卡片背景：`bg-[var(--page-bg)]` 或 inline `style={{ backgroundColor: 'var(--page-bg)' }}`
- 浮层（模态框面板）：`bg-ui-bg-elevated`
- hover 状态：`hover:bg-ui-bg-subtle`
- 边框统一用：`border-ui-border`
- **禁止**硬编码 `bg-white`、`text-black`、`text-gray-*`、`bg-gray-*`

---

## 2. 字体

| 用途 | 字体 | 样式 |
|------|------|------|
| 标题 | Space Grotesk | `style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}` |
| 正文/导航 | Plus Jakarta Sans | `style={{ fontFamily: "'Plus Jakarta Sans', 'Space Grotesk', sans-serif" }}` |
| 代码 | JetBrains Mono | `font-mono` |

---

## 3. 组件清单与用法

### 3.1 ModalDialog — 居中模态框

**文件**: `web/src/components/common/ModalDialog.jsx`

**Props**:
| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| open | boolean | - | 是否显示 |
| onClose | function | - | 关闭回调 |
| title | string/node | - | 标题 |
| children | node | - | 内容 |
| footer | node | 默认取消/确定 | 自定义底部 |
| width | number | 500 | 最大宽度 |
| loading | boolean | false | 确定按钮 loading |
| hideFooter | boolean | false | 隐藏底部 |

**用法**:
```jsx
import ModalDialog from '../common/ModalDialog';

<ModalDialog
  open={visible}
  onClose={() => setVisible(false)}
  title={t('标题')}
  width={500}
  footer={
    <>
      <button onClick={onCancel} className='...[次要按钮]'>{t('取消')}</button>
      <button onClick={onOk} className='...[主按钮]'>{t('确定')}</button>
    </>
  }
>
  <FieldRow label={t('字段名')}>
    <TextField value={x} onChange={setX} placeholder='...' />
  </FieldRow>
</ModalDialog>
```

---

### 3.2 SlideOver — 侧滑面板

**文件**: `web/src/components/common/SlideOver.jsx`

**Props**:
| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| open | boolean | - | 是否显示 |
| onClose | function | - | 关闭回调 |
| title | node | - | 标题区域 |
| headerExtra | node | - | 标题右侧额外内容 |
| footer | node | - | 底部操作栏 |
| width | number | 600 | 面板宽度 |
| placement | 'right'\|'left' | 'right' | 滑出方向 |
| bodyClass | string | '' | body 额外 class |

**用法**（大表单编辑）:
```jsx
import SlideOver from '../common/SlideOver';

<SlideOver
  open={showEdit}
  onClose={handleClose}
  placement='right'
  width={600}
  title={<span className='text-base font-semibold text-ui-text'>{t('编辑')}</span>}
  footer={
    <>
      <button onClick={handleClose} className='...[次要按钮]'>{t('取消')}</button>
      <button onClick={handleSubmit} className='...[主按钮]'>{t('提交')}</button>
    </>
  }
  bodyClass='p-6'
>
  {/* 表单内容 */}
</SlideOver>
```

---

### 3.3 ConfirmDialog — 确认弹窗

**文件**: `web/src/components/common/ConfirmDialog.jsx`

**命令式 API**（推荐）:
```jsx
import { showConfirm } from '../common/ConfirmDialog';

showConfirm({
  title: t('确定删除？'),
  content: t('此操作不可逆'),
  danger: true,
  onOk: () => handleDelete(),
  okText: t('删除'),
  cancelText: t('取消'),
});
```

**组件式**:
```jsx
<ConfirmDialog
  open={showConfirm}
  title='...'
  description='...'
  danger
  onConfirm={onOk}
  onCancel={onClose}
/>
```

---

### 3.4 Dropdown — 下拉选择原语

**文件**: `web/src/components/common/ui/Dropdown.jsx`

**Props**:
| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| options | [{label, value}] | [] | 选项列表 |
| value | any | - | 当前值 |
| onChange | function | - | 选中回调 |
| placeholder | string | '' | 占位文字 |
| emptyText | string | '' | 无选项时文字 |
| placement | string | 'bottom-start' | 弹出方向 |
| portal | boolean | false | 是否 portal 渲染 |
| popupClassName | string | 'w-52' | 弹出层 class |
| triggerClassName | string | '' | 触发器 class |
| renderTrigger | function | - | 自定义触发器渲染 |
| showCheck | boolean | true | 选中项显示 ✓ |

**用法**:
```jsx
import Dropdown from '../common/ui/Dropdown';

<Dropdown
  options={[{ label: '选项A', value: 'a' }, { label: '选项B', value: 'b' }]}
  value={selected}
  onChange={setSelected}
  placeholder={t('请选择')}
  portal
  placement='bottom-start'
/>
```

---

### 3.5 Select — 下拉选择器（Dropdown 封装）

**文件**: `web/src/components/common/form/Select.jsx`

**Props**: `value`, `onChange`, `options`, `placeholder`, `className`, `width`

**用法**:
```jsx
import Select from '../common/form/Select';

<Select
  value={group}
  onChange={setGroup}
  options={[{ label: '全部', value: 'all' }, ...]}
  placeholder={t('选择分组')}
/>
```

---

### 3.6 表单原语

**文件**: `web/src/components/common/form/Primitives.jsx`

| 组件 | 用途 | 关键 Props |
|------|------|-----------|
| `FieldRow` | 字段容器 | `label`, `required`, `hint`, `error`, `extra`, `children` |
| `TextField` | 文本输入 | `value`, `onChange`, `placeholder`, `type`, `disabled`, `prefix`, `suffix` |
| `NumberField` | 数字输入 | `value`, `onChange`, `min`, `max`, `step`, `disabled` |
| `TextAreaField` | 多行文本 | `value`, `onChange`, `placeholder`, `rows`, `autoResize`, `disabled` |
| `Toggle` | 开关 | `checked`, `onChange`, `disabled` |
| `ToggleField` | 开关+标签 | `label`, `hint`, `checked`, `onChange`, `disabled` |
| `NativeSelect` | 原生 select | `value`, `onChange`, `options`, `disabled` |
| `Notice` | 提示横幅 | `kind`('info'\|'warning'\|'danger'), `icon`, `children`, `action` |
| `Section` | 分组标题 | `title`, `children`, `className` |
| `Chip` | 可删除标签 | `children`, `onRemove`, `className` |
| `TagInput` | 标签输入 | `value`, `onChange`, `placeholder`, `disabled` |
| `MultiCombobox` | 多选搜索 | `value`, `onChange`, `options`, `placeholder`, `disabled` |
| `Combobox` | 单选搜索 | `value`, `onChange`, `options`, `placeholder`, `disabled` |
| `DateTimeField` | 日期时间 | `value`, `onChange`, `disabled`, `min`, `max` |
| `ColorField` | 颜色选择 | `value`, `onChange`, `disabled` |
| `RangeSlider` | 范围滑块 | `value`, `onChange`, `min`, `max`, `step` |
| `RadioChipGroup` | 单选组 | `value`, `onChange`, `options`, `disabled` |
| `SectionWithSave` | 设置区块 | `title`, `hint`, `icon`, `iconColor`, `dirty`, `loading`, `onSave` |

**典型用法**:
```jsx
import { FieldRow, TextField, Toggle, MultiCombobox } from '../common/form/Primitives';

<FieldRow label={t('名称')} required hint={t('唯一标识')}>
  <TextField value={name} onChange={setName} placeholder={t('请输入名称')} />
</FieldRow>
```

---

### 3.7 Pagination — 分页

**文件**: `web/src/components/common/table/Pagination.jsx`

**Props**: `page`, `pageSize`, `total`, `onChange`

```jsx
import Pagination from '../common/table/Pagination';

<Pagination page={page} pageSize={20} total={total} onChange={setPage} />
```

---

### 3.8 CrudSection — CRUD 表格区块

**文件**: `web/src/components/common/table/CrudSection.jsx`

用于系统设置中的可增删改查列表（公告管理、API 信息管理等）。

**关键 Props**: `title`, `hint`, `icon`, `iconColor`, `columns`, `dataSource`, `onAdd`, `onBatchDelete`, `page`, `pageSize`, `total`, `onPageChange`, `enabled`, `onToggleEnabled`

---

## 4. 按钮规范

### 主按钮（Primary）
```
inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors disabled:opacity-50
```

### 次要按钮（Secondary）
```
inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors
```

### 危险按钮（Danger）
```
inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-danger text-white hover:opacity-90 transition-opacity disabled:opacity-50
```

### 幽灵按钮（Ghost / 行内操作）
```
inline-flex items-center gap-1 px-2 h-7 text-xs font-medium rounded-lg text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors
```

### 图标按钮
```
inline-flex items-center justify-center w-8 h-8 rounded-lg text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors
```

### 大号 CTA（首页）
```
inline-flex items-center gap-2 px-6 py-3 text-[15px] font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover hover:shadow-md active:scale-95 transition-all duration-200
```

---

## 5. 圆角规范

| 元素 | 圆角 |
|------|------|
| 按钮/输入框/选择器 | `rounded-xl`（12px） |
| 卡片/面板/模态框 | `rounded-2xl`（16px） |
| 小标签/徽章 | `rounded-md`（6px）或 `rounded-lg`（8px） |
| 头像/开关 | `rounded-full` |

---

## 6. 页面布局规范

### 页面容器
```jsx
<div className='px-4 pt-8 pb-6 md:px-6 md:pt-10 md:pb-8'>
  <div className='max-w-[1400px] mx-auto'>
    ...
  </div>
</div>
```
- 不需要 `mt-16`（PageLayout 已处理 header offset）
- 不需要 `min-h-[calc(100vh-4rem)]`（已废弃）
- 不需要 `bg-ui-bg`（Content 区已设置 `var(--page-bg)`）

### 卡片
```jsx
<div className='border border-ui-border rounded-2xl p-4' style={{ backgroundColor: 'var(--page-bg)' }}>
```

### 分组标签
```jsx
<div className='text-[11px] font-semibold uppercase tracking-widest text-ui-text-3 mb-3'>
  {t('标题')}
</div>
```

---

## 7. 标签/徽章规范

```jsx
// 蓝色
<span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'>

// 绿色: bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20
// 橙色: bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20
// 红色: bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20
// 紫色: bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20
// 青色: bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20
```

---

## 8. 表格页面结构

```jsx
{/* 筛选卡片 */}
<div className='border border-ui-border rounded-2xl p-4 mb-4' style={{ backgroundColor: 'var(--page-bg)' }}>
  <Filters />
  <div className='border-t border-ui-border pt-3 mt-3'>
    <Actions />
  </div>
</div>

{/* 表格卡片 */}
<div className='border border-ui-border rounded-2xl overflow-hidden' style={{ backgroundColor: 'var(--page-bg)' }}>
  <table className='w-full text-sm'>
    <thead>
      <tr className='border-b border-ui-border bg-ui-bg-subtle/50 text-[11px] uppercase tracking-wider text-ui-text-3'>
        <th className='px-3 py-2.5 text-left font-medium'>...</th>
      </tr>
    </thead>
    <tbody>
      <tr className='border-b border-ui-divider hover:bg-ui-bg-subtle/40 transition-colors'>
        <td className='px-3 py-3'>...</td>
      </tr>
    </tbody>
  </table>
  <div className='border-t border-ui-border'>
    <Pagination ... />
  </div>
</div>
```

---

## 9. 自定义 SVG 图标

位于 `web/src/components/layout/headerbar/icons/` 和 `web/src/components/layout/icons/`。

统一规范：`strokeWidth="1.5"` / `strokeLinecap="round"` / `strokeLinejoin="round"` / `fill="none"` / `stroke="currentColor"`。

**headerbar/icons/**: BellIcon, ChevronDownIcon, GlobeIcon, KeyIcon, LogOutIcon, MenuIcon, MonitorIcon, MoonIcon, SlidersIcon, SunIcon, WalletIcon, XIcon

**layout/icons/**: AnnouncementEmptyIcon, CopyIcon, HelpIcon, MegaphoneIcon, NotificationEmptyIcon, PulseIcon, SpeedIcon

---

## 10. 导航栏

统一毛玻璃效果，所有路由共用同一个 header：
```jsx
className='fixed top-0 left-0 right-0 z-50 py-4 md:py-6 px-[16px] md:px-[26px] bg-[#f8f8f6]/80 dark:bg-[#1a1a18]/85 backdrop-blur-md'
```

---

## 11. 禁止事项

- ❌ 不要使用 Semi UI 组件（`@douyinfe/semi-ui`），用上述自定义组件替代
- ❌ 不要硬编码颜色（`bg-white`、`text-black`、`text-gray-*`、`bg-gray-*`），用 CSS 变量
- ❌ 不要用 `rounded-md` 做按钮/输入框（用 `rounded-xl`）
- ❌ 不要用 `text-xs` 做主要按钮文字（用 `text-sm`）
- ❌ 不要用 `mt-16` 或 `min-h-[calc(100vh-4rem)]` 做页面偏移
- ❌ 不要用 lucide-react 通用图标做导航栏（用自定义 SVG）
- ❌ 不要用 native `<select>` 做下拉（用 `Select` 或 `Dropdown` 组件）
- ❌ 不要用 `Toast.success/error` 从 Semi UI（用 `showSuccess/showError` 从 helpers）
- ❌ 不要用 `Modal.confirm` 从 Semi UI（用 `showConfirm` 从 ConfirmDialog）
