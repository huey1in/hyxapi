<div align="center">

<img src="web/public/logo/hyxware-light.svg" alt="HyxAPI 标志" width="88" height="88" />

# HyxAPI

**统一模型接入，让管理与运营更简单。**

基于 New API 二次开发的开源 AI API 网关

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-18181b?style=flat-square&logo=gnu&logoColor=white)](LICENSE)
[![Based on New API](https://img.shields.io/badge/Based_on-New_API-18181b?style=flat-square&logo=github&logoColor=white)](https://github.com/QuantumNous/new-api)
[![认可 LINUX DO 社区](https://img.shields.io/badge/%E8%AE%A4%E5%8F%AF-LINUX_DO-18181b?style=flat-square&logo=discourse&logoColor=white)](https://linux.do/)
[![Docker build](https://github.com/huey1in/hyxapi/actions/workflows/docker.yml/badge.svg)](https://github.com/huey1in/hyxapi/actions/workflows/docker.yml)
[![GHCR](https://img.shields.io/badge/GHCR-Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](https://github.com/huey1in/hyxapi/pkgs/container/hyxapi)

[![Go 1.26+](https://img.shields.io/badge/Go-1.26%2B-00ADD8?style=flat-square&logo=go&logoColor=white)](go.mod)
[![React 19](https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white)](web/package.json)
[![TypeScript 6](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white)](web/tsconfig.json)
[![Rsbuild 2](https://img.shields.io/badge/Rsbuild-2-FF8A42?style=flat-square)](web/rsbuild.config.ts)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](web/package.json)

[快速开始](#快速开始) · [项目文档](docs/README.md) · [开发指南](docs/development.md) · [上游项目](https://github.com/QuantumNous/new-api)

</div>

---

## 项目介绍

HyxAPI 基于 [New API](https://github.com/QuantumNous/new-api) 二次开发，沿用上游的开源协议，围绕统一站点、用户控制台和管理后台持续完善。项目重新设计了界面与移动端交互，提供模型接入、API Key 管理、计费、充值订阅、日志和工单等功能。

用户页面、管理后台与 API 由同一个 Go 服务提供；前端构建后嵌入可执行文件，支持容器与原生部署。首页暂未完成设计，访问 `/` 会跳转控制台。

HyxAPI 将长期跟随 New API 的迭代方向，持续跟进上游的模型与协议适配、核心能力、安全修复和稳定性改进。上游更新会结合本项目的界面、权限和运营需求进行适配与回归验证，持续整合到 HyxAPI。

## 功能一览

| 能力 | 说明 |
| --- | --- |
| 多协议接入 | 接入多个模型供应商，支持 OpenAI、Anthropic、Gemini 等协议及流式响应 |
| API Key 管理 | 配置额度、有效期、模型、分组与 IP 限制，管理分组优先级 |
| 计费与用量 | 支持模型定价、分组倍率、表达式计费及缓存 Token 用量记录 |
| 概览与日志 | 按时间和 API Key 查看消费趋势，统一查询调用与任务日志，支持 CSV 导出 |
| 模型页面 | 展示模型价格、能力与成功率历史，支持搜索和筛选 |
| 充值与订阅 | 管理余额、充值记录与订阅，支持接入自托管 Epusdt 网关收取 USDT |
| 工单服务 | 用户提交工单，客服认领与回复，管理员指派处理，支持内部备注 |
| 认证与权限 | 区分用户、客服、管理员和超级管理员，支持第三方登录、Passkey 与双重身份验证 |
| 响应式界面 | 桌面端表格与移动端卡片适配，提供骨架屏、通知和主题设置 |

## 快速开始

| 部署方式 | 适用场景 | 要求 |
| --- | --- | --- |
| [一键部署](#一键部署linux) | 自动生成配置和持久密钥，启动单实例 | Linux、Docker Compose、curl、OpenSSL |
| [Docker 部署](#docker-部署) | 使用预构建镜像管理服务 | Docker Engine、Compose 2.20+ |
| [手动部署](#手动部署) | 不使用容器，从源码构建运行 | Go、Node.js、Bun |

### 一键部署（Linux）

先安装 [Docker Engine](https://docs.docker.com/engine/install/) 和 [Compose 插件](https://docs.docker.com/compose/install/)，再执行：

```sh
curl -fsSL https://raw.githubusercontent.com/huey1in/hyxapi/main/tools/install.sh -o install-hyxapi.sh \
  && bash install-hyxapi.sh
```

默认安装到 `~/hyxapi-deploy`，使用 SQLite，自动生成随机 `SESSION_SECRET`，保留已有配置与数据，并等待健康检查通过。默认仅监听本机 `127.0.0.1:3000`。

已准备 HTTPS 域名时，可在首次安装时指定站点和目录：

```sh
HYXAPI_SITE_URL=https://api.example.com bash install-hyxapi.sh /opt/hyxapi
```

安装目录需有写入权限。远程访问先配置 HTTPS 反向代理；需要直接开放端口测试时，在首次运行脚本前设置 `HYXAPI_BIND_ADDRESS=0.0.0.0`。完整参数见 [一键与 Docker 部署指南](docs/installation/docker.md)。

### Docker 部署

镜像地址为 **`ghcr.io/huey1in/hyxapi:latest`**，支持 **AMD64 / ARM64**。无需在服务器安装 Go、Node.js 或 Bun。

在新的部署目录中执行：

```sh
mkdir -p hyxapi-deploy && cd hyxapi-deploy
curl -fsSL https://raw.githubusercontent.com/huey1in/hyxapi/main/deploy/compose.yml -o compose.yml
(umask 077; test -e .env || printf 'SESSION_SECRET=%s\n' "$(openssl rand -hex 32)" > .env)
docker compose up -d --wait
```

配置保存在 `.env`，SQLite 数据和日志分别保存在 `./data`、`./logs`。查看日志与更新：

```sh
docker compose logs -f hyxapi
# 更新前先备份数据库与 .env
docker compose pull && docker compose up -d --wait
```

`latest` 跟随 `main`；发布版本可固定为 `:v1.2.3`，也支持 `:sha-完整提交哈希`。标签需已由工作流构建。PostgreSQL + Redis、`docker run`、源码构建镜像与备份步骤见 [Docker 部署指南](docs/installation/docker.md)。

### 手动部署

构建环境要求：

| 工具 | 要求 |
| --- | --- |
| Go | 1.26 或更高版本 |
| Node.js | 22.12 或更高版本 |
| Bun | 用于前端依赖安装与脚本执行 |
| 数据库 | 默认 SQLite，也可配置 MySQL 或 PostgreSQL；Redis 按需配置 |

```sh
git clone https://github.com/huey1in/hyxapi.git
cd hyxapi
cp .env.example .env
openssl rand -hex 32
```

将生成的随机值写入 `.env` 的 `SESSION_SECRET`，并按需配置数据库；已有部署保留原密钥。然后构建并启动：

```sh
cd web
bun install --frozen-lockfile
bun run build
cd ..
go build -trimpath -o hyxapi .
./hyxapi --port 3000
```

首次访问 **<http://localhost:3000/setup>** 创建超级管理员。默认端口为 `3000`，健康检查地址为 `/api/status`。

> 首次部署请通过最终 HTTPS 域名访问 `/setup`，站点地址会在初始化时自动检测。HTTPS、systemd 常驻运行、备份与更新见 [手动部署指南](docs/installation/native.md)。前端资源通过 Go 嵌入，首次启动和运行后端测试前需先构建 `web/dist/`。

### GitHub 自动构建镜像

仓库内置 [Docker 工作流](.github/workflows/docker.yml)：推送 `main`、推送 `v*` 标签或在 Actions 手动运行时，先验证容器启动和页面路由，再发布多架构镜像到 GHCR；Pull Request 只构建验证。

使用内置 `GITHUB_TOKEN`，无需配置 Docker Hub 账号。首次发布后，在 GitHub **Packages → hyxapi → Package settings → Change visibility** 将镜像设为 **Public**，即可匿名拉取；公开代码仓库不会自动公开已有镜像。[GitHub 容器仓库说明](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)。

## 本地开发

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

## 项目结构

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

## 文档导航

- [文档目录](docs/README.md)
- [一键部署与 Docker](docs/installation/docker.md)
- [原生部署与更新](docs/installation/native.md)
- [功能与配置](docs/configuration.md)
- [工单权限与自托管 USDT 收款](docs/support-and-usdt.md)
- [前端开发](web/README.md)
- [接口参考](docs/openapi/README.md)

## 参与贡献

欢迎提交 Issue 或 Pull Request。请说明问题、预期行为与复现步骤；代码修改请附上验证结果，界面修改请提供截图。涉及计费、认证、权限或协议行为时，补充对应的回归测试，并同步相关文档。

## 开源协议与致谢

HyxAPI 是 [New API](https://github.com/QuantumNous/new-api) 的衍生项目，沿用上游的 **GNU Affero General Public License v3.0（AGPL-3.0）**，并保留 [NOTICE](NOTICE) 中的附加归属声明与版权要求。完整条款见 [LICENSE](LICENSE)，第三方组件许可见 [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md)。

HyxAPI 对原项目进行了界面、交互和功能修改。感谢 **New API 及其贡献者**提供的基础，也感谢本项目使用的开源组件与工具。

> Frontend design and development by New API contributors.
