# 宝塔面板部署 HyxAPI

本文使用公开镜像或仓库中的 `Dockerfile` 部署 HyxAPI。
SQLite 单实例可直接使用[一键部署](docker.md)；以下保留 PostgreSQL + Redis 的 Compose 部署方式。

## 准备代码

在服务器安装 Git、Docker 和 Docker Compose，通过宝塔终端执行：

```bash
git clone https://github.com/huey1in/hyxapi.git /www/wwwroot/hyxapi
cd /www/wwwroot/hyxapi
```

`Dockerfile` 会先编译前端，再编译 Go 服务，不需要在宿主机安装 Bun 或 Go。

## 配置与构建

在仓库根目录新建 `.env`，填写以下配置。每个随机值分别通过 `openssl rand -hex 32` 生成；已有部署保留原值：

```dotenv
SESSION_SECRET=填写持久随机会话密钥
POSTGRES_PASSWORD=填写数据库随机密码
REDIS_PASSWORD=填写缓存随机密码
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_TRUSTED_URL=https://你的域名
HYXAPI_BIND_ADDRESS=127.0.0.1
```

- Compose 自动使用 `.env` 中的数据库、Redis 密码拼接连接字符串，新密码建议使用十六进制字符。
- `SESSION_SECRET` 在重启和更新时保持不变，多实例必须一致。
- 如需独立加密密钥，添加 `CRYPTO_SECRET`；未设置时使用 `SESSION_SECRET`。
- 通过 HTTPS 反向代理提供服务时，添加 `SESSION_COOKIE_SECURE=true` 和
  `SESSION_COOKIE_TRUSTED_URL=https://你的域名`。
- 默认只映射 `127.0.0.1:3000`，供宝塔反向代理访问。

其他环境变量见 [`.env.example`](../../.env.example)。Compose 的 `env_file` 会把 `.env` 注入应用容器，明确写在 `environment` 中的项目优先。

```bash
docker compose pull
docker compose up -d --wait
docker compose ps
```

默认拉取 `ghcr.io/huey1in/hyxapi:latest`。如需自行构建，执行 `docker build -t hyxapi:local .`，在 `.env` 设置 `HYXAPI_IMAGE=hyxapi:local` 后执行 `docker compose up -d --pull never --wait`。

## 站点初始化

在宝塔中为站点配置 HTTPS，反向代理到 `http://127.0.0.1:3000`。
首页、登录、控制台与 API 使用同一域名；代理需保留 Host 和转发协议，并支持 WebSocket。

首次访问 `https://你的域名/setup` 创建超级管理员。站点地址在初始化时检测，
应通过最终对外使用的域名访问。第三方登录回调和支付回调也使用该地址。

## 数据与更新

PostgreSQL 数据保存在 `pg_data` 卷，文件日志位于 `./logs`，`./data` 挂载到容器
工作目录 `/data`。备份数据库、这些目录及部署密钥；不要使用 `docker compose down -v`
更新服务，该选项会删除数据库卷。

```bash
cd /www/wwwroot/hyxapi
git pull --ff-only
docker compose pull
docker compose up -d --wait
docker compose logs --tail=100 new-api
```

健康检查可请求 `http://127.0.0.1:3000/api/status`。若无法访问，先检查容器状态、
数据库连接和反向代理配置；登录失效时检查持久密钥及 HTTPS Cookie 设置。
