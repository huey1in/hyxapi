<div align="center">

<img src="web/public/logo/hyxware-light.svg" alt="HyxAPI 标志" width="88" height="88" />

# HyxAPI

**统一模型接入，让管理与运营更简单。**

基于 New API 二次开发的开源 AI API 网关

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-18181b?style=flat-square&logo=gnu&logoColor=white)](LICENSE)
[![Based on New API](https://img.shields.io/badge/Based_on-New_API-18181b?style=flat-square&logo=github&logoColor=white)](https://github.com/QuantumNous/new-api)

[![Go 1.26+](https://img.shields.io/badge/Go-1.26%2B-00ADD8?style=flat-square&logo=go&logoColor=white)](go.mod)
[![React 19](https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white)](web/package.json)
[![TypeScript 6](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white)](web/tsconfig.json)
[![Rsbuild 2](https://img.shields.io/badge/Rsbuild-2-FF8A42?style=flat-square)](web/rsbuild.config.ts)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](web/package.json)

[快速开始](#-快速开始) · [项目文档](docs/README.md) · [开发指南](docs/development.md) · [上游项目](https://github.com/QuantumNous/new-api)

</div>

---

## ✨ 项目介绍

HyxAPI 基于 [New API](https://github.com/QuantumNous/new-api) 二次开发，沿用上游的开源协议，围绕统一站点、用户控制台和管理后台持续完善。项目重新设计了界面与移动端交互，提供模型接入、API Key 管理、计费、充值订阅、日志和工单等功能。

首页、用户页面、管理后台与 API 由同一个 Go 服务提供；前端构建后嵌入可执行文件，支持原生部署。

## 🧩 功能一览

| 能力 | 说明 |
| --- | --- |
| 🔌 多协议接入 | 接入多个模型供应商，支持 OpenAI、Anthropic、Gemini 等协议及流式响应 |
| 🔑 API Key 管理 | 配置额度、有效期、模型、分组与 IP 限制，管理分组优先级 |
| 🧮 计费与用量 | 支持模型定价、分组倍率、表达式计费及缓存 Token 用量记录 |
| 📊 概览与日志 | 按时间和 API Key 查看消费趋势，统一查询调用与任务日志，支持 CSV 导出 |
| 🗂️ 模型页面 | 展示模型价格、能力与成功率历史，支持搜索和筛选 |
| 💳 充值与订阅 | 管理余额、充值记录与订阅，支持接入自托管 Epusdt 网关收取 USDT |
| 🎫 工单服务 | 用户提交工单，客服认领与回复，管理员指派处理，支持内部备注 |
| 🛡️ 认证与权限 | 区分用户、客服、管理员和超级管理员，支持第三方登录、Passkey 与双重身份验证 |
| 📱 响应式界面 | 桌面端表格与移动端卡片适配，提供骨架屏、通知和主题设置 |

## 🚀 快速开始

### 环境要求

| 工具 | 要求 |
| --- | --- |
| Go | 1.26 或更高版本 |
| Node.js | 22.12 或更高版本 |
| Bun | 用于前端依赖安装与脚本执行 |
| 数据库 | 默认 SQLite，也可配置 MySQL 或 PostgreSQL；Redis 按需配置 |

### 获取代码与配置

```sh
git clone https://github.com/huey1in/api.git
cd api
cp .env.example .env
```

编辑 `.env`，设置持久的随机 `SESSION_SECRET`，并按需配置数据库。已有部署请保留原有密钥与数据；配置项见 [环境变量示例](.env.example)。

### 构建与启动

```sh
cd web
bun install --frozen-lockfile
bun run build
cd ..
go run .
```

首次访问 **<http://localhost:3000/setup>** 创建超级管理员。默认端口为 `3000`，健康检查地址为 `/api/status`。

> 前端资源通过 Go 嵌入，首次启动和运行后端测试前，需要先构建 `web/dist/`。正式部署的 HTTPS、反向代理、备份与更新步骤见 [原生部署指南](docs/installation/native.md)。

## 🛠️ 本地开发

保持后端运行，在另一个终端进入 `web/` 执行 `bun run dev`。前端开发地址为 `http://localhost:5173`，API 请求代理至本地 `3000` 端口。

| 目录 | 命令 | 用途 |
| --- | --- | --- |
| 仓库根目录 | `go run .` | 启动后端并提供已构建的前端 |
| 仓库根目录 | `go test ./...` | 执行根模块 Go 测试 |
| `relaykit/`、`tokenkit/` | 分别运行 `go test ./...` | 验证两个独立 Go 模块 |
| `web/` | `bun run dev` | 启动前端开发服务器 |
| `web/` | `bun run test` | 执行前端测试 |
| `web/` | `bun run build` | 执行类型检查并构建生产资源 |
| `web/` | `bun run storybook` | 预览 UI 组件 |

更多验证命令及 Redis 集成测试说明见 [开发与测试](docs/development.md)。

## 🏗️ 项目结构

```text
.
├── main.go        # Go / Gin 服务入口
├── router/        # HTTP 路由
├── middleware/    # 认证、权限与限流
├── controller/    # 接口处理
├── service/       # 业务逻辑
├── model/         # 数据库与持久化
├── setting/       # 站点与运行时配置
├── relay/         # 上游适配与请求转发
├── relaykit/      # 独立模块：协议 DTO 与转换
├── tokenkit/      # 独立模块：Token 计数与估算
├── pkg/           # 表达式计费、插件等基础能力
├── web/           # React / TypeScript 前端
└── docs/          # 部署、配置与接口文档
```

## 📚 文档导航

- [文档目录](docs/README.md)
- [原生部署与更新](docs/installation/native.md)
- [功能与配置](docs/configuration.md)
- [工单权限与自托管 USDT 收款](docs/support-and-usdt.md)
- [前端开发](web/README.md)
- [接口参考](docs/openapi/README.md)

## 🤝 参与贡献

欢迎提交 Issue 或 Pull Request。请说明问题、预期行为与复现步骤；代码修改请附上验证结果，界面修改请提供截图。涉及计费、认证、权限或协议行为时，补充对应的回归测试，并同步相关文档。

## 📄 开源协议与致谢

HyxAPI 是 [New API](https://github.com/QuantumNous/new-api) 的衍生项目，沿用上游的 **GNU Affero General Public License v3.0（AGPL-3.0）**，并保留 [NOTICE](NOTICE) 中的附加归属声明与版权要求。完整条款见 [LICENSE](LICENSE)，第三方组件许可见 [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md)。

HyxAPI 对原项目进行了界面、交互和功能修改。感谢 **New API 及其贡献者**提供的基础，也感谢本项目使用的开源组件与工具。

> Frontend design and development by New API contributors.
