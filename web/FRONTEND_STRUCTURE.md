# Routify Web 前端文件结构与用途说明

## src/ 根目录

- `index.jsx` — React 应用入口，挂载 Router 和 Context Providers
- `index.css` — 全局样式，Tailwind CSS 配置、设计 token、动画、滚动条
- `App.jsx` — 路由定义与鉴权守卫

---

## src/components/auth/ — 认证组件

- `LoginForm.jsx` — 登录表单（邮箱/密码 + OAuth）
- `LoginModal.jsx` — 全屏登录/注册/重置密码弹窗
- `OAuth2Callback.jsx` — OAuth2 回调处理
- `PasswordResetConfirm.jsx` — 密码重置确认页
- `PasswordResetForm.jsx` — 密码重置请求表单
- `RegisterForm.jsx` — 用户注册表单
- `TwoFAVerification.jsx` — 两步验证组件

---

## src/components/common/ — 通用组件

- `ConfirmDialog.jsx` — 确认对话框（删除/危险操作）
- `ErrorBoundary.jsx` — React 错误边界
- `ModalDialog.jsx` — 通用居中弹窗（CRUD 表单）
- `SlideOver.jsx` — 侧滑面板（左/右）
- `Toast.jsx` — 自定义 Toast 通知系统

### common/DocumentRenderer/
- `index.jsx` — 多格式文档渲染器

### common/form/
- `Primitives.jsx` — 基础表单组件（TextField、NumberField、Toggle 等）
- `Select.jsx` — 自定义下拉选择器

### common/logo/
- `LinuxDoIcon.jsx` — LinuxDo 图标
- `OIDCIcon.jsx` — OIDC 图标
- `WeChatIcon.jsx` — 微信图标

### common/markdown/
- `MarkdownRenderer.jsx` — Markdown 渲染（支持 KaTeX、Mermaid、代码高亮）
- `markdown.css` — Markdown 样式

### common/modals/
- `RiskAcknowledgementModal.jsx` — 风险确认弹窗（带勾选和文字验证）
- `SecureVerificationModal.jsx` — 安全验证弹窗（2FA/Passkey）

### common/table/
- `CrudSection.jsx` — 表格 CRUD 操作区
- `Pagination.jsx` — 分页组件

### common/ui/
- `CardPro.jsx` — 增强卡片组件
- `CardTable.jsx` — 卡片式表格布局
- `ChannelKeyDisplay.jsx` — 渠道 API Key 展示
- `CompactModeToggle.jsx` — 紧凑模式切换
- `Dropdown.jsx` — 下拉菜单
- `JSONEditor.jsx` — JSON 编辑器（可视化/手动模式）
- `Loading.jsx` — 加载动画
- `RenderUtils.jsx` — 渲染工具函数
- `ScrollableContainer.jsx` — 可滚动容器
- `SelectableButtonGroup.jsx` — 可选按钮组（筛选器）
- `SquircleBox.jsx` — 圆角方形容器
- `forms.js` — 表单 CSS 类常量

---

## src/components/dashboard/ — 仪表盘

- `index.jsx` — 仪表盘主组件（统计卡片 + 图表）

### dashboard/parts/
- `InfoCard.jsx` — 信息卡片
- `MonthlyBarChart.jsx` — 月度柱状图
- `SearchModal.jsx` — 仪表盘搜索弹窗
- `vchartTheme.js` — VChart 图表主题配置

---

## src/components/layout/ — 布局

- `Footer.jsx` — 页脚
- `NoticeModal.jsx` — 公告弹窗
- `PageLayout.jsx` — 主布局（Header + Sidebar + Content）
- `SetupCheck.js` — 初始化检查
- `SiderBar.jsx` — 左侧导航栏

### layout/components/
- `SkeletonWrapper.jsx` — 骨架屏加载

### layout/headerbar/
- `index.jsx` — 顶栏主组件
- `ActionButtons.jsx` — 顶栏操作按钮
- `HeaderLogo.jsx` — Logo
- `LanguageSelector.jsx` — 语言切换
- `MobileMenuButton.jsx` — 移动端菜单按钮
- `MobileNavDrawer.jsx` — 移动端导航抽屉
- `Navigation.jsx` — 导航链接
- `NewYearButton.jsx` — 新年特效按钮
- `NotificationButton.jsx` — 通知铃铛
- `ThemeToggle.jsx` — 主题切换（深色/浅色）
- `UserArea.jsx` — 用户头像/菜单区

### layout/headerbar/icons/
- `BellIcon.jsx` — 铃铛图标
- `ChevronDownIcon.jsx` — 下箭头图标
- `GlobeIcon.jsx` — 地球图标
- `KeyIcon.jsx` — 钥匙图标
- `LogOutIcon.jsx` — 登出图标
- `MenuIcon.jsx` — 菜单图标
- `MonitorIcon.jsx` — 显示器图标
- `MoonIcon.jsx` — 月亮图标
- `SlidersIcon.jsx` — 滑块图标
- `SunIcon.jsx` — 太阳图标
- `WalletIcon.jsx` — 钱包图标
- `XIcon.jsx` — 关闭图标

### layout/icons/
- `AnnouncementEmptyIcon.jsx` — 空公告图标
- `CopyIcon.jsx` — 复制图标
- `HelpIcon.jsx` — 帮助图标
- `MegaphoneIcon.jsx` — 喇叭图标
- `NotificationEmptyIcon.jsx` — 空通知图标
- `PulseIcon.jsx` — 脉冲图标
- `SpeedIcon.jsx` — 速度图标

---

## src/components/playground/ — API 对话测试

- `ChatArea.jsx` — 聊天界面
- `CodeViewer.jsx` — 代码查看器
- `ConfigManager.jsx` — 配置管理
- `CustomRequestEditor.jsx` — 自定义请求编辑器
- `DebugPanel.jsx` — 调试面板
- `ImageUrlInput.jsx` — 图片 URL 输入
- `MessageActions.jsx` — 消息操作按钮
- `MessageContent.jsx` — 消息内容渲染
- `ParameterControl.jsx` — API 参数控制
- `SettingsPanel.jsx` — 设置面板
- `SSEViewer.jsx` — SSE 流式响应查看器
- `ThinkingContent.jsx` — AI 思考过程展示
- `configStorage.js` — 配置持久化
- `OptimizedComponents.js` — 性能优化组件

---

## src/components/settings/ — 系统设置

- `ChannelSelectorModal.jsx` — 渠道选择弹窗
- `DashboardSetting.jsx` — 仪表盘设置包装器
- `HttpStatusCodeRulesInput.jsx` — HTTP 状态码规则编辑器
- `LimitsSetting.jsx` — 限制与监控设置包装器
- `OperationSetting.jsx` — 运营设置包装器
- `OtherSetting.jsx` — 其他设置（公告/协议/隐私）
- `PerformanceSetting.jsx` — 性能设置包装器
- `PersonalSetting.jsx` — 个人设置页面
- `RatioSetting.jsx` — 倍率设置包装器
- `SystemSetting.jsx` — 系统设置包装器（认证相关）

### settings/auth/
- `LoginRegister.jsx` — 登录注册设置
- `OAuthProviders.jsx` — OAuth 提供商配置
- `PasskeyAndMisc.jsx` — Passkey 与杂项认证设置
- `ServerAndSSRF.jsx` — 服务器与 SSRF 防护设置

### settings/personal/cards/
- `NotificationSettings.jsx` — 通知偏好设置
- `PreferencesSettings.jsx` — 用户偏好设置

### settings/personal/components/
- `TwoFASetting.jsx` — 两步验证设置
- `UserInfoHeader.jsx` — 用户信息头部

---

## src/components/setup/ — 初始化向导

- `SetupWizard.jsx` — 安装向导主组件
- `index.jsx` — 入口

### setup/components/
- `StepNavigation.jsx` — 步骤导航

### setup/components/steps/
- `AdminStep.jsx` — 管理员账户创建
- `CompleteStep.jsx` — 完成步骤
- `DatabaseStep.jsx` — 数据库配置
- `UsageModeStep.jsx` — 使用模式选择

---

## src/components/table/channels/ — 渠道管理表格

- `index.jsx` — 渠道管理页面入口
- `ChannelsActions.jsx` — 批量操作栏
- `ChannelsColumnDefs.jsx` — 列定义
- `ChannelsFilters.jsx` — 筛选栏
- `ChannelsTable.jsx` — 表格主体
- `ChannelsTabs.jsx` — 渠道类型标签页

### channels/modals/
- `BatchTagModal.jsx` — 批量设置标签
- `ChannelUpstreamUpdateModal.jsx` — 上游更新弹窗
- `CodexOAuthModal.jsx` — Codex OAuth 配置
- `CodexUsageModal.jsx` — Codex 用量展示
- `ColumnSelectorModal.jsx` — 列选择器
- `EditChannelModal.jsx` — 渠道编辑表单
- `EditTagModal.jsx` — 标签编辑
- `ModelSelectModal.jsx` — 模型选择
- `ModelTestModal.jsx` — 模型测试
- `MultiKeyManageModal.jsx` — 多 Key 管理
- `ParamOverrideEditorModal.jsx` — 参数覆写编辑器
- `SingleModelSelectModal.jsx` — 单模型选择
- `StatusCodeRiskGuardModal.jsx` — 状态码风险确认
- `statusCodeRiskGuard.js` — 风险守卫逻辑

---

## src/components/table/model-pricing/ — 模型定价

### filter/
- `PricingDisplaySettings.jsx` — 显示设置
- `PricingEndpointTypes.jsx` — 端点类型筛选
- `PricingGroups.jsx` — 分组筛选
- `PricingQuotaTypes.jsx` — 计费类型筛选
- `PricingTags.jsx` — 标签筛选
- `PricingVendors.jsx` — 厂商筛选

### layout/
- `PricingSidebar.jsx` — 侧边栏筛选面板

### layout/content/
- `PricingContent.jsx` — 内容区
- `PricingView.jsx` — 视图切换（卡片/表格）

### layout/header/
- `PricingTopSection.jsx` — 顶部区域
- `PricingVendorIntro.jsx` — 厂商介绍
- `PricingVendorIntroSkeleton.jsx` — 厂商介绍骨架屏
- `PricingVendorIntroWithSkeleton.jsx` — 带骨架屏的厂商介绍
- `SearchActions.jsx` — 搜索与操作

### modal/
- `ModelDetailSideSheet.jsx` — 模型详情侧面板
- `PricingFilterModal.jsx` — 筛选弹窗

### modal/components/
- `FilterModalContent.jsx` — 筛选弹窗内容
- `FilterModalFooter.jsx` — 筛选弹窗底部
- `ModelBasicInfo.jsx` — 模型基本信息
- `ModelEndpoints.jsx` — 模型端点
- `ModelHeader.jsx` — 模型头部
- `ModelPricingTable.jsx` — 模型定价表

### view/card/
- `PricingCardSkeleton.jsx` — 卡片骨架屏
- `PricingCardView.jsx` — 卡片视图

### view/table/
- `PricingTable.jsx` — 表格视图
- `PricingTableColumns.jsx` — 表格列定义

---

## src/components/table/redemptions/ — 兑换码管理

- `index.jsx` — 兑换码页面入口（额度 + 订阅双模式）
- `RedemptionsTable.jsx` — 兑换码表格

### redemptions/modals/
- `EditRedemptionModal.jsx` — 兑换码编辑
- `SubscriptionCodeBatchModal.jsx` — 批量生成订阅兑换码

---

## src/components/table/subscriptions/ — 订阅管理

- `index.jsx` — 订阅管理页面入口
- `SubscriptionsTable.jsx` — 订阅表格

### subscriptions/modals/
- `AddEditSubscriptionModal.jsx` — 添加/编辑订阅
- `SubscriptionCodesModal.jsx` — 订阅兑换码展示

---

## src/components/table/tokens/ — 令牌管理

- `index.jsx` — 令牌页面入口
- `TokensActions.jsx` — 操作栏
- `TokensColumnDefs.jsx` — 列定义
- `TokensDescription.jsx` — 说明文字
- `TokensFilters.jsx` — 筛选栏
- `TokensTable.jsx` — 表格主体

### tokens/modals/
- `CopyTokensModal.jsx` — 复制令牌
- `DeleteTokensModal.jsx` — 删除确认
- `EditTokenModal.jsx` — 令牌编辑表单

---

## src/components/table/usage-logs/ — 使用日志

- `index.jsx` — 日志页面入口
- `UsageLogsActions.jsx` — 操作栏
- `UsageLogsColumnDefs.jsx` — 列定义
- `UsageLogsFilters.jsx` — 筛选栏
- `UsageLogsTable.jsx` — 表格主体

### usage-logs/components/
- `ParamOverrideEntry.jsx` — 参数覆写条目

### usage-logs/modals/
- `ChannelAffinityUsageCacheModal.jsx` — 渠道亲和缓存展示
- `ColumnSelectorModal.jsx` — 列选择器
- `ParamOverrideModal.jsx` — 参数覆写详情
- `UserInfoModal.jsx` — 用户信息弹窗

---

## src/components/table/users/ — 用户管理

- `index.jsx` — 用户管理页面入口
- `UsersTable.jsx` — 用户表格

### users/modals/
- `AddUserModal.jsx` — 添加用户
- `EditUserModal.jsx` — 编辑用户
- `UserSubscriptionsModal.jsx` — 用户订阅展示

---

## src/constants/ — 常量定义

- `channel.constants.js` — 渠道类型、选项
- `channel-affinity-template.constants.js` — 渠道亲和模板
- `common.constant.js` — 通用常量（分页大小、端点）
- `console.constants.js` — 控制台常量
- `dashboard.constants.js` — 仪表盘常量
- `index.js` — 常量统一导出
- `playground.constants.js` — Playground 常量
- `redemption.constants.js` — 兑换码常量
- `toast.constants.js` — Toast 常量
- `user.constants.js` — 用户相关常量

---

## src/context/ — 全局状态

- `LoginModal/index.jsx` — 登录弹窗全局状态
- `Status/index.jsx` — 应用状态 Context
- `Status/reducer.js` — 状态 Reducer
- `Theme/index.jsx` — 主题 Context（深色/浅色）
- `User/index.jsx` — 用户认证 Context
- `User/reducer.js` — 用户 Reducer

---

## src/contexts/ — 功能级 Context

- `PlaygroundContext.jsx` — Playground 状态管理

---

## src/helpers/ — 工具函数

- `api.js` — Axios 实例与拦截器
- `auth.jsx` — 认证辅助函数
- `base64.js` — Base64 编解码
- `boolean.js` — 布尔值转换
- `dashboard.jsx` — 仪表盘计算
- `data.js` — 数据转换
- `index.js` — 统一导出
- `log.js` — 日志工具
- `passkey.js` — Passkey/WebAuthn 辅助
- `quota.js` — 额度计算
- `render.jsx` — 渲染工具（格式化额度、时间等）
- `secureApiCall.js` — 安全 API 调用封装
- `statusCodeRules.js` — HTTP 状态码规则
- `token.js` — 令牌管理工具
- `utils.jsx` — 通用工具函数

---

## src/hooks/ — 自定义 Hooks

### hooks/channels/
- `upstreamUpdateUtils.js` — 上游更新工具
- `useChannelsData.jsx` — 渠道数据获取
- `useChannelUpstreamUpdates.jsx` — 渠道上游更新

### hooks/common/
- `useContainerWidth.js` — 容器宽度检测
- `useHeaderBar.js` — 顶栏状态
- `useIsMobile.js` — 移动端检测
- `useMinimumLoadingTime.js` — 最小加载时间
- `useNavigation.js` — 导航辅助
- `useNotifications.js` — 通知管理
- `usePageTitle.js` — 页面标题
- `useSecureVerification.jsx` — 安全验证
- `useSidebar.js` — 侧边栏状态
- `useSidebarCollapsed.js` — 侧边栏折叠
- `useTableCompactMode.js` — 表格紧凑模式
- `useUserPermissions.js` — 用户权限

### hooks/dashboard/
- `useDashboardCharts.jsx` — 图表数据
- `useDashboardData.js` — 仪表盘数据
- `useDashboardStats.jsx` — 统计数据

### hooks/model-pricing/
- `useModelPricingData.jsx` — 模型定价数据
- `usePricingFilterCounts.js` — 筛选计数

### hooks/playground/
- `useApiRequest.jsx` — API 请求执行
- `useDataLoader.js` — 数据加载
- `useMessageActions.jsx` — 消息操作
- `useMessageEdit.jsx` — 消息编辑
- `usePlaygroundState.js` — Playground 状态
- `useSyncMessageAndCustomBody.js` — 消息同步

### hooks/redemptions/
- `useRedemptionsData.jsx` — 兑换码数据

### hooks/subscriptions/
- `useSubscriptionsData.jsx` — 订阅数据

### hooks/tokens/
- `useTokensData.jsx` — 令牌数据

### hooks/usage-logs/
- `useUsageLogsData.jsx` — 使用日志数据

### hooks/users/
- `useUsersData.jsx` — 用户数据

---

## src/i18n/ — 国际化

- `i18n.js` — i18next 初始化配置
- `language.js` — 语言工具与支持列表
- `locales/en.json` — 英文翻译
- `locales/zh-CN.json` — 简体中文翻译

---

## src/pages/ — 页面入口

- `Channel/index.jsx` — 渠道管理
- `Dashboard/index.jsx` — 仪表盘
- `Forbidden/index.jsx` — 403 无权限页
- `Home/index.jsx` — 首页/落地页
- `Log/index.jsx` — 使用日志
- `Playground/index.jsx` — API 对话测试
- `Pricing/index.jsx` — 模型广场
- `PrivacyPolicy/index.jsx` — 隐私政策
- `Redemption/index.jsx` — 兑换码管理
- `Setup/index.jsx` — 初始化向导
- `Subscription/index.jsx` — 订阅管理
- `Token/index.jsx` — 令牌管理
- `TopUp/index.js` — 钱包充值
- `User/index.jsx` — 用户管理
- `UserAgreement/index.jsx` — 用户协议

### pages/Setting/ — 系统设置子页面
- `index.jsx` — 设置页面外壳（6 个标签页）

### pages/Setting/Dashboard/
- `SettingsAnnouncements.jsx` — 公告管理
- `SettingsAPIInfo.jsx` — API 信息展示设置
- `SettingsDataDashboard.jsx` — 数据看板设置
- `SettingsFAQ.jsx` — FAQ 管理
- `SettingsUptimeKuma.jsx` — Uptime Kuma 集成

### pages/Setting/Model/
- `SettingClaudeModel.jsx` — Claude 模型配置
- `SettingGeminiModel.jsx` — Gemini 模型配置
- `SettingGlobalModel.jsx` — 全局模型设置
- `SettingGrokModel.jsx` — Grok 模型配置

### pages/Setting/Operation/
- `SettingsChannelAffinity.jsx` — 渠道亲和设置
- `SettingsCreditLimit.jsx` — 额度限制设置
- `SettingsGeneral.jsx` — 通用运营设置
- `SettingsLog.jsx` — 日志设置
- `SettingsMonitoring.jsx` — 监控设置
- `SettingsSensitiveWords.jsx` — 敏感词过滤

### pages/Setting/Performance/
- `SettingsPerformance.jsx` — 性能调优设置

### pages/Setting/RateLimit/
- `SettingsRequestRateLimit.jsx` — 请求限流设置

### pages/Setting/Ratio/
- `GroupRatioSettings.jsx` — 分组倍率设置
- `ModelPricingCombined.jsx` — 模型定价组合编辑器
- `ModelRatioSettings.jsx` — 模型倍率设置
- `ModelSettingsVisualEditor.jsx` — 可视化模型设置编辑器
- `UpstreamRatioSync.jsx` — 上游倍率同步
- `hooks/useModelPricingEditorState.js` — 编辑器状态 Hook
- `components/AutoGroupList.jsx` — 自动分组列表
- `components/GroupGroupRatioRules.jsx` — 分组间倍率规则
- `components/GroupSpecialUsableRules.jsx` — 分组特殊可用规则
- `components/GroupTable.jsx` — 分组管理表格
- `components/ModelPricingEditor.jsx` — 模型定价编辑器

---

## src/services/ — 服务层

- `secureVerification.js` — 安全验证服务（2FA/Passkey 流程）
