# HyxAPI

HyxAPI 是基于 New API 开发的 AI API 网关，提供多供应商协议转发、API Key 管理、用量计费、充值订阅和工单服务。首页、用户页面与管理后台由同一个 Go 服务提供。

## 本地启动

准备 Go 1.26 或更高版本、Node.js 22.12 或更高版本，以及 Bun。首次配置见[原生部署指南](docs/installation/native.md)，无需 Docker。

```sh
cd web
bun install --frozen-lockfile
bun run build
cd ..
go run .
```

访问 `http://localhost:3000/setup` 创建超级管理员。前端产物通过 Go 嵌入，必须先构建 `web/dist/`。

开发前端时，保持后端运行，在另一个终端进入 `web/` 执行 `bun run dev`。开发服务器位于 `http://localhost:5173`，将 `/api` 和 `/v1` 代理到后端。

## 项目结构

| 目录 | 用途 |
| --- | --- |
| `router/`、`middleware/`、`controller/` | 路由、认证和 HTTP 请求处理 |
| `service/`、`model/`、`setting/` | 业务逻辑、数据库及运行时配置 |
| `relay/` | 上游渠道接入和转发 |
| `relaykit/` | 独立 Go 模块：协议 DTO 与转换 |
| `tokenkit/` | 独立 Go 模块：Token 计数与估算 |
| `pkg/` | 表达式计费、插件等基础能力 |
| `web/` | React 19、TypeScript、Rsbuild 2、Tailwind CSS 4 前端 |
| `docs/` | 部署、配置和接口参考 |

Go 导入路径沿用 `github.com/QuantumNous/new-api`；根模块通过本地 `replace` 使用仓库内的两个子模块。

## 验证与文档

在根目录、`relaykit/` 和 `tokenkit/` 分别运行 `go test ./...`；在 `web/` 运行 `bun run test`、`bun run build`。完整命令与 Redis 测试说明见[开发与测试](docs/development.md)。

- [文档目录](docs/README.md)
- [功能与配置](docs/configuration.md)
- [工单权限与 USDT 收款](docs/support-and-usdt.md)
- [前端开发](web/README.md)

## 许可证

项目遵循 [AGPL-3.0](LICENSE)。保留上游版权声明；第三方组件说明见 [NOTICE](NOTICE) 和 [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md)。
