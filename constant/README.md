# constant 包 (`/constant`)

集中存放网关使用的稳定标识、默认值和启动配置变量。协议库共享的类型由独立的 `relaykit` 模块维护。

## 当前文件

| 文件 | 用途 |
|---|---|
| `api_type.go` | 上游 API 类型编号；新增类型应放在 `APITypeDummy` 之前。 |
| `channel.go` | 渠道类型、默认地址、显示名称与特殊地址配置。 |
| `endpoint_type.go` | `relaykit/types` 端点类型与常量的宿主别名。 |
| `context_key.go` | 请求上下文键，覆盖令牌、渠道、订阅与计费信息。 |
| `multi_key_mode.go` | 渠道多密钥选择模式。 |
| `midjourney.go` | Midjourney 任务动作标识。 |
| `task.go` | Suno 等任务平台、动作与模型映射。 |
| `finish_reason.go` | 响应结束原因。 |
| `azure.go` | Azure 模型名兼容的时间边界。 |
| `env.go` | 启动时注入的环境配置变量。 |
| `setup.go` | 安装初始化状态。 |
| `waffo_pay_method.go` | Waffo 支付方式和支付场景标识。 |

## 使用约定

- 保持依赖方向简单：允许标准库及共享协议类型；不要引入控制器、数据库或业务服务。
- 新的协议通用类型优先定义在 `relaykit/types`；宿主兼容入口可以使用类型别名，避免复制定义。
- 环境变量的读取和初始化放在启动配置流程中；此处声明配置，不执行网络或数据库操作。
- 保持已有 API、渠道编号稳定；新增文件时同步更新本表。
