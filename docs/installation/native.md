# 原生部署 HyxAPI

本文直接运行 Go 服务，不使用 Docker。准备 Go 1.26 或更高版本、Node.js 22.12 或更高版本及 Bun。

## 构建

```sh
git clone https://github.com/huey1in/hyxapi.git
cd hyxapi/web
bun install --frozen-lockfile
bun run build
cd ..
go build -o hyxapi .
```

Windows 最后一条命令改为 `go build -o hyxapi.exe .`。前端嵌入可执行文件，更新前端后需要重新编译 Go。

## 配置

首次部署时，将根目录 [`.env.example`](../../.env.example) 复制为 `.env`，取消所需变量前的注释并填写值。已有配置时直接编辑，保留原密钥。可在仓库目录用 Bun 生成密钥：

```sh
bun -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

- 将生成值写入 `SESSION_SECRET`，重启和更新时保持不变；多个实例使用相同值。
- `CRYPTO_SECRET` 可单独设置，默认沿用会话密钥；已有加密数据时保留原值。
- 未设置 `SQL_DSN` 时使用 SQLite，默认文件为工作目录下的 `one-api.db`。自定义 `SQLITE_PATH` 时先创建其父目录。
- 使用 MySQL 或 PostgreSQL 时设置 `SQL_DSN`；`LOG_SQL_DSN` 可指定独立日志库，ClickHouse 仅用于日志。
- HTTPS 部署设置 `SESSION_COOKIE_SECURE=true` 和 `SESSION_COOKIE_TRUSTED_URL=https://你的域名`。本地 HTTP 开发保持前者为 `false`。
- 仅供本机反向代理访问时设置 `BIND_ADDRESS=127.0.0.1`。Redis 按需配置 `REDIS_CONN_STRING`。

服务从启动时的工作目录读取 `.env`，数据库、文件日志和相对路径也以此目录为基准。

## 启动与初始化

在仓库根目录运行 `./hyxapi --port 3000`；Windows 使用 `./hyxapi.exe --port 3000`。开发时可直接执行 `go run .`。默认日志目录为 `./logs`，通过 `--log-dir` 修改。

首次访问 `/setup` 创建超级管理员。正式部署先为最终域名配置 HTTPS 反向代理，再通过该域名完成初始化；站点地址在此时自动检测，第三方登录和支付回调使用该地址。代理到 `http://127.0.0.1:3000`，保留 Host 和转发协议，并支持 WebSocket。首页、控制台和 API 使用同一域名。

健康检查：`GET /api/status`。Linux 可使用进程管理器或 systemd；仓库提供 [`hyxapi.service`](../../hyxapi.service) 示例。安装前按实际部署修改 `User`、`WorkingDirectory` 和 `ExecStart`，确保启动 `hyxapi` 可执行文件并加载原有环境配置。

已有 systemd 部署先停止并禁用旧服务，再安装和启用 `hyxapi.service`。保留原工作目录、数据库路径及密钥，避免新旧服务同时运行。

## 更新与备份

更新前备份数据库、`.env`、部署密钥及实际使用的数据目录。SQLite 运行期间使用 SQLite 备份工具，或停止服务后复制完整数据库文件，避免遗漏 WAL 数据。

更新代码后重新安装锁定依赖、构建前端和 Go，停止旧进程再替换可执行文件并启动。保留启动目录及环境配置，随后检查 `/api/status`、登录和关键业务。数据库迁移在启动时执行，回退前确认数据库与目标版本兼容。
