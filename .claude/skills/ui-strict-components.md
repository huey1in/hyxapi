---
name: ui-strict-components
description: Strict rule for ALL business-side frontend changes — any edits to files under web/src/pages/ or web/src/components/ (except components/ui/* itself). Forbids hand-writing buttons / inputs / cards / modals; forbids passing className to UI primitives; forces using ui/* components via props only. Read this BEFORE making any business-side .jsx/.js edits.
---

# UI 严控规则（业务端代码）

## 触发条件

**任何**对以下路径的 `.jsx`/`.js` 文件 **新建或修改**前，必读：
- `web/src/pages/**`
- `web/src/components/**`（**除外**：`web/src/components/ui/**` 本身）

修改 `web/src/components/ui/**` 内文件**不触发**本 skill —— 原子组件允许自定义实现细节。

## 第一原则

**业务端不允许定义任何按钮 / 输入 / 卡片 / 模态框 / 下拉的"孤立组件"**。所有这些视觉原子必须从 `web/src/components/ui/` 导入并通过 props 配置使用。

业务端文件中：
- 禁止 `<button>`（HTML 原生）
- 禁止 `<input>` / `<textarea>` / `<select>`（带 className 时）
- 禁止用 `border border-ui-border rounded-X` 组合手写卡片
- 禁止用 `bg-ui-bg-elevated shadow-2xl rounded-X` 组合手写模态
- 禁止给 `ui/*` 组件传 `className` prop（哪怕只是布局类）

## ui/ 组件清单与目录结构

组件按分类放进子目录。业务侧 `import { ... } from '@/components/ui'` 不变（走 index.js 出口）；只有在 `ui/` 内部新建/修改组件时才会用到子目录路径。

```
ui/
├── button/     Button, IconButton
├── card/       Card, SectionCard
├── input/      Input, Textarea, NumberInput, TagInput, Slider, FieldRow
├── select/     Select, Combobox, MultiSelect
├── toggle/     Switch, Checkbox, Radio (+ RadioGroup)
├── modal/      Modal, ModalShell, ConfirmDialog, SlideOver, Drawer, useExitTransition
├── feedback/   Tag, Loading, Skeleton, Tooltip, Notice, Progress, Toast (showToast/ToastContainer)
├── display/    CodeBlock (+ codeblock-theme.css)、Divider、EmptyState、Accordion
├── layout/     Tabs, Table, Steps, Breadcrumb, Pagination, PageShell
├── theme/      ThemeToggle (+ useTheme)
├── tokens.js   公共 cn / SIZE_* / FOCUS_RING
└── index.js    统一 re-export
```

调用前先看对应文件的 jsdoc 注释，所有可用 props 都在那里列出来。

**新增 / 修改 ui 组件时**：
- 文件放进对应分类子目录；如果分类不存在再新增子目录并到此 skill 一并补上
- 同目录引用 `'./Foo'`，跨目录 `'../subdir/Foo'`
- `tokens.js` 在 ui 根目录，子目录文件用 `'../tokens'`
- 完成后到 `index.js` 对应分组加上 export
- stories（`*.stories.jsx`）与组件同目录

## 现有 prop 表达不了时

**绝对禁止**：自己写局部 className 绕过 / 自己写新组件 / 用 `!important` 覆盖。

**必须**：
1. 停下手中的工作
2. 用 `AskUserQuestion` 工具向用户说明：
   - 当前要表达的视觉/行为是什么
   - 在哪里需要（具体文件+行号）
   - 建议给哪个 ui/ 组件加什么 prop / variant
3. 等用户确认后，**先改 `web/src/components/ui/` 添加 prop**，再回到业务代码用新 prop

## 任何业务 className 都是错的

发现下面这些模式立即停下问用户：
- `<Button className='...'>` / `<IconButton className='...'>`
- `<Card className='...border\|bg-\|rounded-\|shadow-...'>` (布局类如 `mb-4` 可以)
- 业务文件里出现 `const SomeBtn = ({ ... }) => <button className='...'>` 自造按钮组件
- 业务文件里出现 `border border-ui-border rounded-2xl` 这种组合不是从 `<Card>` 来的

## 改完验证（强制）

每次业务端改完，必须执行并确认通过（Windows / Git Bash）：

```bash
cd /c/Users/29269/Downloads/routify2/web && npm run build
```

不启动后端、不跑 dev server。

## 检查残留（每次修完一个文件跑一遍）

```bash
cd /c/Users/29269/Downloads/routify2/web/src && grep -rEn '<(Button|IconButton)\b[^/>]*className=' --include='*.jsx' --include='*.js' <你刚改的文件>
```

应该返回 0 行。如果有，要么改成 prop，要么删 className。

## 反例对照

| 错误 | 正确 |
|---|---|
| `<Button className='w-full'>` | `<Button block>` |
| `<Button className='flex-1'>` | `<Button flex1>` |
| `<Button className='!justify-start'>` | `<Button justify='start'>` |
| `<IconButton className='absolute top-2 right-2'>` | `<IconButton absolute position='tr'>` |
| `<button className='px-4 py-2 ...'>` | `<Button>` |
| `<input className='border ...'>` | `<Input>` 或 `<input className={inputStyle({variant:'admin'}).className} style={inputStyle().style}>` |
| 手写 `<div className='border rounded-2xl ...'>` | `<Card>` |
| 手写 `<div className='fixed inset-0 ... shadow-2xl rounded-2xl'>` | `<ModalShell>` 或 `<ModalDialog>` |
| 业务文件内 `const ActionBtn = (...) => <button ...>` | 改为 `Button` 薄包装且不接 className |

## 设计系统约定（本仓库强制）

字号 / 字体：
- 全站字体 = `Kefaiii`（自托管在 `public/fonts/`），fallback `Gilroy → MiSans → 系统`。`src/index.css` 已写好 `@font-face`，不要随意改。
- 按钮文字**不加粗**（Button / Tabs / Select 选项均无 `font-medium`/`font-semibold`）。
- 代码块字体走 `Menlo, Consolas, SF Mono, JetBrains Mono`（tailwind `font-mono`）。

颜色系统（CSS 变量在 `src/index.css`）：
- 亮色与暗色都已定型，**不要**改变量值。暗色走暖灰 / 咖色调（page-bg `#1c1b17`、text `#ebe8e0`），对比度故意压低，避免纯黑+纯白刺眼。
- `--page-bg` 是页面与 Card / Table / Dropdown 面板 / Modal / Drawer 等所有面板的统一底色；`--ui-bg-elevated` 仅作纯白参考色，**不直接用于面板**。
- `--ui-code-bg` 是代码块的"page-bg 加深版"，仅 CodeBlock 用。
- `--ui-accent` = 亮色纯黑 / 暗色暖白 `#ebe8e0`，仅用于 primary 按钮 / Switch on 态 / 选中态。
- `--ui-text-2` / `--ui-text-3` 已比 Tailwind 默认深一档，placeholder、次级文本、骨架屏直接用即可，**不要再叠 opacity**。
- ⚠️ Tailwind 的 `/数字` 透明度修饰符（如 `bg-ui-bg-subtle/60`）与 `var(--...)` 颜色**不兼容**，会生成无效 CSS。用全色 token 即可（`bg-ui-bg-subtle` / `bg-ui-border`）。
- danger 用 `--ui-danger` / `--ui-danger-bg`，其他色彩 Notice / Tag 已统一为中性灰，**不要随手引入 emerald/amber/rose 等彩色**（包括 Toast、Notice、IconButton 等所有反馈类）。
- 任何写死的 hex 颜色都会破坏主题切换 —— **必须**通过 CSS 变量 / Tailwind token 表达。

输入家族 API：
- `Input` / `Textarea` / `NumberInput` / `Select` / `Combobox` / `MultiSelect` / `TagInput` 的 `size` 是**数字**（默认 36，控制高度 + 字号 14；≤28→12 / ≤36→14 / >36→16），`width` 见 `resolveWidth`（默认 240px，可传 `'full'` / 数字 / CSS 字符串）。
- `Input` 的 variant 只有 `admin` / `inline`（`auth` 已删除）。
- 包在 `FieldRow` 里时不用手动写 width — FieldRow 会自动给已注册的 UI 子项注入 `width='full'`。

Card：
- 无 `padding` / `radius` / `outlined` 参数，固定 `p-4` + `rounded-2xl`。
- `header` / `footer` slot 已无分隔线。

滚动条：
- `src/index.css` 已用 `*` 选择器全局美化（细滚动条 + ui-border 浅灰 thumb）。**不要**再单独写 scrollbar 样式。

弹出层：
- ModalShell 通过 mousedown/mouseup 配对判断防止内部按住拖到遮罩误关。
- Modal / SlideOver / Drawer 都接入了 `useExitTransition`，进入用 `animate-*-in`、关闭用 `animate-*-out`。新增弹出层请同样接入。
- Modal header / footer **不要**分隔线。

Notice / Toast / Tag：
- Notice 图标统一 `text-ui-text-2`，无边框，page-bg 底。
- Toast 用 `ui-accent` 黑底胶囊，`rounded-xl`，单图标 + 关闭按钮。
- Tag 一律中性灰 + page-bg 底 + ui-border 边框，语义只靠左侧小圆点（`tone: success/warning/danger/info/default`）。

CodeBlock：
- 顶栏：折叠 chevron + 语言图标（来自 `registry.npmmirror.com/@lobehub/assets-fileicon`）+ 标签 + 复制按钮。
- 底色 `var(--ui-code-bg)`，无外边框。
- Prism token 走 slack-ochin 配色。

Chart：项目无图表组件（已删），需要可视化请确认后再新增。
