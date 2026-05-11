# UI 设计系统

所有 UI 原子组件统一定义在 `src/components/ui/` 目录下。**禁止**在业务代码中再用 inline className 拼装按钮、标签、输入框等基础组件。

## 使用方式

```jsx
import { Button, Input, Tag, Card, Modal, showConfirm } from '@/components/ui';
// 或相对路径
import { Button } from '../components/ui';
```

## 组件清单

### 按钮类
- `Button` — 通用按钮（variant: primary/secondary/ghost/danger/link）
- `IconButton` — 仅图标的方形按钮

### 输入类
- `Input` — 单行文本（支持 prefix/suffix/clearable）
- `Textarea` — 多行文本（支持 autoResize）
- `NumberInput` — 数字输入

### 选择类
- `Select` — 单选下拉（portal-aware，统一使用，禁用原生 `<select>`）
- `Combobox` — 可搜索单选
- `MultiSelect` — 可搜索多选
- `Dropdown` — 通用下拉菜单（菜单项是 action，不是 value）

### 勾选类
- `Toggle` — 开关
- `Checkbox` — 复选框
- `Radio` / `RadioGroup` — 单选

### 展示类
- `Tag` — 标签/徽章（支持 dot 模式作为状态指示）
- `Card` — 卡片容器（variant: plain/elevated/outlined/filled）

### 弹窗类
- `Modal` — 居中弹窗
- `ConfirmDialog` + `showConfirm` — 确认对话框（支持命令式调用）
- `SlideOver` — 侧滑面板

### 布局类
- `Tabs` — 标签页（pill / underline 两种风格）
- `Pagination` — 分页

### 反馈类
- `Loading` — 加载动画（支持 fullscreen）
- `Skeleton` — 骨架屏
- `Tooltip` — 提示气泡

## 设计原则

### 1. 一种组件一个实现
- ❌ 不要再用 `<button className="bg-ui-accent ...">` 写按钮
- ❌ 不要再用 `<input className={INPUT_CLS}>`
- ❌ 不要再用原生 `<select>`
- ✅ 全部使用 `ui/` 中的统一组件

### 2. 通过 variant 表达样式差异
按钮颜色、卡片风格、标签颜色等差异都通过 `variant` / `color` / `size` props 表达，**不要传 className 重写样式**。

### 3. 尺寸规范
组件统一使用三档尺寸：`sm` / `md` (默认) / `lg`。

### 4. 颜色 token
组件内部统一使用 CSS variables（`--ui-text`, `--ui-bg-subtle` 等），不硬编码 `bg-blue-500`。
Tag 等需要多色的组件，通过 `color` prop 选择预设色板。

## 示例

```jsx
// 按钮
<Button variant="primary" icon={Plus}>添加</Button>
<Button variant="danger" loading={loading}>删除</Button>
<Button variant="ghost" size="sm">取消</Button>

// 输入
<Input prefix={<Search size={14} />} clearable value={kw} onChange={setKw} />

// 标签
<Tag color="blue">新建</Tag>
<Tag color="emerald" dot>已启用</Tag>

// 弹窗
showConfirm({ title: '确定删除？', danger: true, onOk: doDelete });

// 选择
<Select options={[{value: 'a', label: 'A'}]} value={v} onChange={setV} />
```

## 当前状态

阶段 1（骨架建立）：✅ 完成
阶段 2（迁移业务代码）：进行中

后续每次迁移一类组件，分批完成。
