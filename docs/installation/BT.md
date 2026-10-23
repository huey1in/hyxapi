# 宝塔面板部署 HyxAPI

本文使用仓库中的 `Dockerfile` 和 `docker-compose.yml` 构建、部署 HyxAPI。
宝塔应用商店中的 New API 和上游镜像不会包含本项目的修改。

## 准备代码

在服务器安装 Git、Docker 和 Docker Compose，通过宝塔终端执行：

```bash
git clone https://github.com/huey1in/api.git /www/wwwroot/hyxapi
cd /www/wwwroot/hyxapi
```

`Dockerfile` 会先编译前端，再编译 Go 服务，不需要在宿主机安装 Bun 或 Go。

## 配置与构建

编辑仓库根目录的 `docker-compose.yml`：

- 将 PostgreSQL、Redis 密码及对应连接字符串中的示例密码一起替换。
- 在 `new-api.environment` 中设置持久的随机 `SESSION_SECRET`，可用
  `openssl rand -hex 32` 生成；多实例必须保持一致。
- 如需独立加密密钥，添加 `CRYPTO_SECRET`；未设置时使用 `SESSION_SECRET`。
- 通过 HTTPS 反向代理提供服务时，添加 `SESSION_COOKIE_SECURE=true` 和
  `SESSION_COOKIE_TRUSTED_URL=https://你的域名`。
- 仅由本机反向代理访问时，将端口映射改为 `127.0.0.1:3000:3000`。

其他环境变量见 [`.env.example`](../../.env.example)。应用环境变量应写入
Compose 的 `environment`；仅复制根目录 `.env` 不会将其中所有变量注入容器。

```bash
docker build -t hyxware:local .
docker compose up -d
docker compose ps
```

镜像标签与当前 Compose 配置保持一致。首次构建需下载依赖。

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
docker build -t hyxware:local .
docker compose up -d
docker compose logs --tail=100 new-api
```

健康检查可请求 `http://127.0.0.1:3000/api/status`。若无法访问，先检查容器状态、
数据库连接和反向代理配置；登录失效时检查持久密钥及 HTTPS Cookie 设置。
