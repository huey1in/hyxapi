# 一键与 Docker 部署

HyxAPI 的公开镜像地址为 `ghcr.io/huey1in/hyxapi`，提供 Linux AMD64 和 ARM64 镜像。部署前安装 [Docker Engine](https://docs.docker.com/engine/install/) 与 [Compose 插件](https://docs.docker.com/compose/install/)（2.20+），确保当前用户可以访问 Docker。

## 一键部署

Linux 服务器准备好 `curl` 和 `openssl` 后运行：

```sh
curl -fsSL https://raw.githubusercontent.com/huey1in/hyxapi/main/tools/install.sh -o install-hyxapi.sh \
  && bash install-hyxapi.sh
```

脚本将 SQLite 版 [Compose 配置](../../deploy/compose.yml) 安装到 `~/hyxapi-deploy`，生成权限受限的 `.env` 和随机会话密钥，拉取镜像并等待健康检查。重复执行会保留 `.env`、Compose 文件和数据；不会替换已有部署的密钥或将其他 Compose 部署改成 SQLite。

首次运行可指定参数：

```sh
HYXAPI_PORT=3000 \
HYXAPI_SITE_URL=https://api.example.com \
bash install-hyxapi.sh /opt/hyxapi
```

目录需有写入权限；镜像标签通过 `HYXAPI_IMAGE` 指定。默认只开放 `127.0.0.1:3000`，可供本机反向代理访问。直接开放服务器端口测试时，首次安装设置 `HYXAPI_BIND_ADDRESS=0.0.0.0`。已有部署修改安装目录的 `.env` 后执行 `docker compose up -d --wait`，环境变量不会覆盖已有配置文件。

## Docker Compose：SQLite

适合单实例，无需单独启动数据库或 Redis。在新的部署目录执行：

```sh
mkdir -p hyxapi-deploy && cd hyxapi-deploy
curl -fsSL https://raw.githubusercontent.com/huey1in/hyxapi/main/deploy/compose.yml -o compose.yml
if [ ! -f .env ]; then
  (umask 077; printf 'SESSION_SECRET=%s\n' "$(openssl rand -hex 32)" > .env)
fi
docker compose up -d --wait
docker compose ps
```

`.env` 会注入应用容器，支持 [环境变量示例](../../.env.example) 中的配置。容器内端口固定为 `3000`，宿主机端口使用 `HYXAPI_PORT`，宿主机监听地址使用 `HYXAPI_BIND_ADDRESS`；不要将容器内的 `BIND_ADDRESS` 改为回环地址。

| 文件或目录 | 用途 |
| --- | --- |
| `.env` | 会话密钥、镜像标签和运行配置 |
| `compose.yml` | 容器定义 |
| `data/one-api.db` | SQLite 主数据库，沿用内部文件名 |
| `data/` | 应用工作目录及持久文件 |
| `logs/` | 文件日志 |

## Docker Compose：PostgreSQL + Redis

需要独立数据库和 Redis 时，使用仓库根目录的 [`docker-compose.yml`](../../docker-compose.yml)：

```sh
git clone https://github.com/huey1in/hyxapi.git
cd hyxapi
if [ ! -f .env ]; then
  (umask 077; printf 'SESSION_SECRET=%s\nPOSTGRES_PASSWORD=%s\nREDIS_PASSWORD=%s\n' \
    "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env)
fi
docker compose up -d --wait
docker compose logs -f new-api
```

密码使用十六进制随机值，避免连接 URL 的特殊字符编码问题。数据库和 Redis 只开放容器网络，不映射宿主机端口。应用等待数据库与 Redis 健康后再启动。

该配置保留既有 `new-api` 服务名、数据库名、`pg_data` 卷和网络标识，以便原部署继续使用原数据。已有部署应保持原目录、Compose 项目名、数据库密码、`SESSION_SECRET` 与 `CRYPTO_SECRET`，把旧配置中的原值写入 `.env` 后再更新；修改 `POSTGRES_PASSWORD` 环境变量不会修改已初始化数据库的密码。不要将此配置直接替换成 SQLite 版启动。

## 使用 docker run

先在部署目录创建 `.env` 并设置持久随机 `SESSION_SECRET`，再执行：

```sh
mkdir -p data logs
docker run -d --name hyxapi --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  --env-file .env \
  -e SQLITE_PATH=/data/one-api.db \
  -e BIND_ADDRESS=0.0.0.0 -e PORT=3000 \
  -v "$PWD/data:/data" -v "$PWD/logs:/data/logs" \
  ghcr.io/huey1in/hyxapi:latest
docker logs -f hyxapi
```

## HTTPS 与初始化

本机调试可访问 `http://localhost:3000/setup`。对外部署先把 HTTPS 域名反向代理到 `http://127.0.0.1:3000`，再通过最终域名访问 `/setup` 创建超级管理员；站点地址在初始化时自动检测。

HTTPS 部署在 `.env` 设置后重建容器：

```dotenv
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_TRUSTED_URL=https://api.example.com
```

反向代理需要保留 Host、客户端 IP 和协议，支持 WebSocket，并关闭流式响应缓冲。Nginx 可参考以下片段，证书与 HTTPS 站点按实际环境配置：

```nginx
# 放在 http 块中。
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

# 放在已配置 HTTPS 的 server 块中。
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_buffering off;
    proxy_read_timeout 600s;
}
```

### 客户端 IP 与 Cloudflare

按 IP 的限流依赖真实访问者地址。`TRUSTED_PROXIES` 留空时只信任回环、私有 IPv4 和 IPv6 ULA 地址；设置为 `none` 时忽略转发头；显式填写 IP / CIDR 列表会替换默认值，因此需要同时包含实际的 Nginx / Docker 代理地址。

对于 `Cloudflare → Nginx → 应用`，上面的 Nginx 配置会保留 `X-Forwarded-For` 链。如果应用只信任本机代理，会在 Cloudflare 节点处停止解析，导致多个用户共用同一 IP 限流额度，登录状态刷新也可能返回 429。可选择以下一种配置方式：

- 在 Nginx 中按 [Cloudflare 官方说明](https://developers.cloudflare.com/support/troubleshooting/restoring-visitor-ips/restoring-original-visitor-ips/)配置真实 IP 模块，仅信任 Cloudflare 官方网段提供的 `CF-Connecting-IP`，并向应用传递校验后的访问者地址。
- 保留转发链，在应用的 `.env` 中将本机 / Docker 代理地址和 Cloudflare 的全部官方 [IPv4](https://www.cloudflare.com/ips-v4/) / [IPv6](https://www.cloudflare.com/ips-v6/) 网段一起填入 `TRUSTED_PROXIES`，以逗号分隔，再执行 `docker compose up -d --no-deps --wait new-api` 重建应用容器。

代理需要把实际连接方地址追加到转发链，不能直接透传客户端提供的任意 IP。不要设置 `0.0.0.0/0` 或 `::/0` 信任所有来源。调整后检查应用日志中的客户端 IP，并验证同一 Cloudflare 节点后的不同访问者分别计数、外部请求伪造转发头无效。官方代理网段变动后需同步配置。

健康检查接口为 `GET /api/status`。首页暂未完成设计，`/` 自动跳转控制台 `/console`，属于预期行为。

## 更新与备份

在原部署目录执行，保留 `.env`、数据目录和原 Compose 文件：

```sh
docker compose pull
docker compose up -d --wait
docker compose ps
```

更新前备份数据库、`.env`、`data/` 和实际日志目录。SQLite 可停止应用后备份整个 `data/`（包含可能存在的 WAL 文件）；PostgreSQL 使用数据库备份工具，例如：

```sh
docker compose exec -T postgres pg_dump -U root -d new-api > hyxapi-backup.sql
```

不要使用 `docker compose down -v` 更新，这会删除数据库卷。数据库迁移会随启动执行，回滚镜像前需要确认数据库兼容性。

`latest` 和 `main` 跟随主分支；`v1.2.3` 标签会生成 `:v1.2.3`、`:1.2.3` 和 `:1.2`，提交镜像为 `:sha-完整提交哈希`。固定版本可在 `.env` 写入 `HYXAPI_IMAGE=ghcr.io/huey1in/hyxapi:v1.2.3`；使用已成功发布的实际标签替换示例。

## 从源码构建镜像

无需在宿主机安装 Go 或 Bun，Dockerfile 会构建前后端：

```sh
git clone https://github.com/huey1in/hyxapi.git
cd hyxapi
docker build -t hyxapi:local .
```

在部署目录的 `.env` 将 `HYXAPI_IMAGE` 改为 `hyxapi:local`，执行 `docker compose up -d --pull never --wait`。本地镜像不需要先发布到镜像仓库。

## GitHub 镜像发布

[`Docker` 工作流](../../.github/workflows/docker.yml) 在推送 `main`、`v*` 标签或手动运行时发布镜像。发布前会先启动 AMD64 容器，验证状态接口、首页跳转、控制台与模型路由；随后构建 AMD64 / ARM64 清单。Pull Request 只验证，不发布。

工作流使用内置 `GITHUB_TOKEN` 和 `packages: write` 权限。首次发布后，维护者在 **Packages → hyxapi → Package settings → Change visibility** 设置 **Public**；镜像公开后可匿名拉取。参见 [GitHub 容器仓库文档](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)和 [Docker 多架构构建说明](https://docs.docker.com/build/ci/github-actions/multi-platform/)。
