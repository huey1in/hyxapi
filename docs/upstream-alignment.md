# Hyxware 功能与配置说明

本轮按 New API `v1.0.0-rc.45`（`6cf0d90b`）补齐功能，保留 Hyxware 页面、同域登录和直接价格配置。

固定版本的本地对齐和最终回归已完成；保留差异及实环境验收边界见 [最终语义复核与验收](newapi-semantic-audit.md)。

## 前端开发

在 `web/` 执行：

```sh
bun install
bun run dev
bun run test
bun run build
bun run build-storybook
```

技术栈为 React 19、TypeScript、Rsbuild 和 Tailwind 4。入口、API、认证、状态及业务路由页面已迁移至 TypeScript；部分共享组件和工具仍支持 JavaScript，约定见 [web/README.md](../web/README.md)。开发代理仍连接本机 `3000` 端口。先构建前端，再从仓库根目录执行 `go run .`；无需 Docker。

## 渠道与模型

- **DeepSeek**：支持当前模型名、旧模型别名和 `@thinking:`、`@effort:` 修饰符。`POST /v1/tools/search`、`POST /v1/tools/fetch` 分别固定按 `deepseek-search`、`deepseek-fetch` 路由；未知 JSON 字段原样转发。
- **工具价格**：先为上述两个路由名配置启用的按次价格，例如 `0.00075 USD/次`。空搜索结果、空抓取内容和失败请求不计费；失败预扣费沿用异步退款流程。模型内置工具的 `deepseek_search`、`deepseek_fetch` 价格单位为每千次调用，默认各 `0.75 USD/千次`。
- **Responses WebSocket**：在支持的渠道编辑窗口开启开关，通过 `GET /v1/responses` 建立连接。支持 OpenAI、New API、Sub2API，以及配置原生 Responses 路由的高级自定义渠道。每次生成独立认证、限流和结算；修改连接配置或禁用渠道会关闭已有连接。
- **AWS**：可在编辑窗口选择 Mantle Messages；凭据支持 `APIKey|Region` 或 `AccessKey|SecretAccessKey|Region`，同时选择对应 Key 类型。
- **Vertex**：支持 `us`、`eu` 多地域地址。普通 API Key 可填写 Project ID，Express 模式可留空。
- **排序**：拖动渠道可放到目标之前、之后或同级；后端同时处理筛选、分页之外的相邻层级。支持撤销，并拒绝覆盖过期页面中的优先级。单次调整上限为 500 个渠道。

## 通知、日志与令牌

个人设置可分别控制额度预警、渠道通知和上游模型更新通知。额度预警默认开启，仅在余额跨过阈值时触发；恢复至阈值后可再次提醒。渠道通知旧设置默认仅向超级管理员发送；验证码和密码重置邮件独立于这些开关。

日志页支持按当前筛选导出 CSV。普通用户仅导出自己的记录，敏感管理字段会移除；每个用户同时只能运行一个导出。管理员可通过 `log_setting.user_export_enabled` 控制普通用户导出。查询和导出支持历史时间范围，不设最大天数；消费统计与趋势在概览页查看。

新令牌默认允许查询账户余额，可在编辑窗口关闭；已有令牌迁移后默认关闭。只读用量查询允许过期或耗尽的令牌，但继续拒绝禁用令牌、封禁账户和不符合 IP 白名单的请求。

## 协议兼容

Gemini 支持完整 JSON Schema，并按累计快照合并流式用量，保留后续帧省略的模态明细。Responses 工具返回的图片、文档经现有媒体加载器解析后传递：Gemini 3 使用 `functionResponse.parts`，旧版本放在同轮工具响应之后；无法加载或目标不支持的媒体会返回明确错误。自定义工具调用历史会保留。

Claude 转发保留 `thinking.block_binding` 和多值 beta 请求头；明确的零输出、缓存用量不会被估算值覆盖。跨协议转换保留图片 detail、工具调用与文本、reasoning summary，并统一 HTTP 与 WebSocket 的 Responses 用量及工具计费。

## 下载与连接配置

系统设置的安全页提供 `WorkerUrl`、`WorkerValidKey` 和 `WorkerAllowHttpImageRequestEnabled`。填写 Worker 地址后下载通过该端点执行；清空地址恢复直接下载。密钥保存后不会通过配置读取接口返回，HTTP 目标需要显式开启，下载继续遵循 SSRF 设置。携带密钥的 Worker 请求不跟随重定向。

环境变量 `RELAY_RESPONSE_HEADER_TIMEOUT` 默认 `1800` 秒，设为 `0` 关闭。它限制等待上游响应头的时间，收到响应头后不会因此截断仍在读取的流；总请求超时仍由既有配置控制。变更代理地址或删除渠道会关闭对应的闲置连接池。

SQLite 启动迁移会使套餐 ID 保持递增，并将序列提高至历史订阅、订单和兑换码引用以上，防止删除后创建的套餐继承旧历史。现有数据、未知列、索引和触发器在事务内保留；带自定义套餐外键的数据库会返回明确错误，需要按其约束另行迁移。

## 验证

根目录、`relaykit/` 与 `tokenkit/` 分别执行 `go test ./...`。Redis 集成测试需要专用测试实例：设置 `REDIS_TEST_ADDR=127.0.0.1:16389` 后，运行分组限流和日志导出锁测试。测试使用数据库 13、14；不要指向业务实例。完整令牌桶限流依赖支持 Lua `TIME` 后写入的现代 Redis。

真实供应商连通性需要对应渠道凭据；本轮协议、认证和扣费验证使用本地模拟上游，未消耗供应商额度。
