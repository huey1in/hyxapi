# 功能与配置

后端环境变量见 [`.env.example`](../.env.example)，部署步骤见[原生部署](installation/native.md)。站点业务设置通过管理后台保存；开发与测试命令见[开发指南](development.md)。

## 渠道与模型

- **DeepSeek 工具**：`POST /v1/tools/search`、`POST /v1/tools/fetch` 分别按 `deepseek-search`、`deepseek-fetch` 路由，需配置启用的按次价格。空结果和失败请求不计费；模型内置 `deepseek_search`、`deepseek_fetch` 的工具价格单位为 USD/千次调用。
- **Responses WebSocket**：在支持的渠道编辑窗口启用，通过 `GET /v1/responses` 建立连接。支持 OpenAI、New API、Sub2API，以及配置原生 Responses 路由的高级自定义渠道。每次生成独立认证、限流和结算；修改连接配置或禁用渠道会关闭已有连接。
- **AWS Mantle Messages**：凭据支持 `APIKey|Region` 或 `AccessKey|SecretAccessKey|Region`，同时选择对应 Key 类型。
- **Vertex**：支持 `us`、`eu` 多地域地址；普通 API Key 可填写 Project ID，Express 模式可留空。
- **优先级**：拖动渠道调整为目标之前、之后或同级。后端同时处理筛选和分页之外的相邻层级，支持撤销并校验版本冲突；单次调整上限为 500 个渠道。

代理、请求格式和连接选项见[渠道设置](channel/settings.md)。协议转换与流式状态详见 [RelayKit](../relaykit/README.md)，计费变量与结算规则详见[计费表达式](../pkg/billingexpr/expr.md)。

插件市场默认不配置远程来源；管理员可在插件管理中添加自己的索引地址。内置任务插件随仓库提供。

## 令牌、日志与通知

API Key 可配置额度、有效期、模型、分组和 IP 限制。余额查询权限可单独关闭；只读用量查询允许过期或耗尽的 Key，仍拒绝禁用 Key、封禁账户及不符合 IP 限制的请求。

日志将调用、异步任务和 Midjourney 记录放在同一列表。普通用户仅查询及导出自己的记录，敏感管理字段会移除；审计日志限管理员访问。CSV 导出遵循当前筛选，每个用户同时只能运行一个导出；管理员通过 `log_setting.user_export_enabled` 控制普通用户导出。消费统计与趋势位于概览页。

个人设置分别控制额度预警、渠道通知和上游模型更新通知。额度预警在余额跨过阈值时触发，恢复后可再次提醒；验证码和密码重置邮件独立于这些通知开关。工单权限与收款设置见[工单与 USDT](support-and-usdt.md)。

## 下载与上游连接

安全设置中的 `WorkerUrl`、`WorkerValidKey` 和 `WorkerAllowHttpImageRequestEnabled` 控制图片下载 Worker。配置地址后通过 Worker 下载，清空后直接下载；密钥保存后不回显。HTTP 目标须显式开启，下载遵循 SSRF 限制，携带密钥的 Worker 请求不跟随重定向。

`RELAY_RESPONSE_HEADER_TIMEOUT` 默认 `1800` 秒，设为 `0` 关闭，仅限制等待上游响应头的时间。它不会截断已经开始读取的流；`RELAY_TIMEOUT` 控制总请求超时，`STREAMING_TIMEOUT` 控制流式无响应超时。变更代理或删除渠道时会关闭对应闲置连接池。

## 数据库升级

启动时自动执行数据库迁移。SQLite 套餐 ID 保持递增，序列覆盖历史订阅、订单和兑换码引用，防止删除后新建套餐复用旧 ID。迁移在事务内保留现有数据、未知列、索引和触发器；存在自定义套餐外键时会明确拒绝自动重建，需要单独迁移。升级前备份数据库，不能仅凭迁移修正已经发生的历史错误关联。
