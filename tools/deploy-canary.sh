#!/bin/bash
# =============================================================================
# canary 金丝雀实例部署脚本
#
# 拓扑：
#   hyxware:local   -> 生产实例（3000 master / 3001 slave）
#   hyxware:canary  -> 金丝雀实例（3002 slave），新代码先只在这上面跑
#
# 用法：
#   tools/deploy-canary.sh build        # 用当前代码构建 hyxware:canary 镜像
#   tools/deploy-canary.sh deploy       # 用 canary 镜像重建金丝雀容器（不接流量）
#   tools/deploy-canary.sh test         # 本地健康探测 3002
#   tools/deploy-canary.sh on           # 金丝雀接入 nginx（weight=1 灰度）
#   tools/deploy-canary.sh off          # 金丝雀摘除 nginx（回滚，秒级）
#   tools/deploy-canary.sh status       # 查看当前状态
#
# 标准发布流程：
#   1. tools/deploy-canary.sh build    （改完代码后构建）
#   2. tools/deploy-canary.sh deploy   （部署到金丝雀，此时不接线上流量）
#   3. tools/deploy-canary.sh test     （本地/手动验证新代码）
#   4. tools/deploy-canary.sh on       （接入灰度，仅 ~9% 流量）
#   5. 观察正常后，把新代码再构建进 hyxware:local 并滚动升级生产实例
#   6. 出问题随时 tools/deploy-canary.sh off 秒级回滚
# =============================================================================
set -euo pipefail

CANARY_NAME="new-api-canary"
CANARY_PORT="3002"
CANARY_IMG="hyxware:canary"
NGINX_BIN="/www/server/nginx/sbin/nginx"
NGINX_CONF="/www/server/panel/vhost/nginx/routifyapi.com.conf"
UPSTREAM_LINE='    server 127.0.0.1:3002 weight=1;   # 金丝雀（先测试后接入，weight 越小流量越少）'

REPO=/www/wwwroot/routify
DATA=/www/wwwroot/routify/data
LOGS=/www/wwwroot/routify/logs

# 金丝雀容器启动参数（与生产实例一致，仅 NODE_NAME / 端口 / 镜像不同）
# 注意：SESSION_SECRET 由共享挂载 /data/.env 注入（godotenv.Load 读取），
# 必须全实例一致，否则登录 cookie 跨实例验签失败 → 401。
declare -ga CANARY_ARGS
build_args() {
  CANARY_ARGS=(
    --name "$CANARY_NAME"
    --network routify_new-api-network
    -p 3002:3000
    --restart always
    --health-cmd 'wget -q -O - http://localhost:3000/api/status | grep -o "\"success\":\s*true" || exit 1'
    --health-interval 30s
    --health-start-period 10s
    --health-retries 3
    -v "$DATA":/data
    -v "$LOGS":/app/logs
    -e BATCH_UPDATE_ENABLED=true
    -e GEO_BLOCK_ENABLED=true
    -e GLOBAL_WEB_RATE_LIMIT_ENABLE=false
    -e NODE_NAME=new-api-node-canary
    -e NODE_TYPE=slave
    -e REDIS_CONN_STRING='redis://:123456@redis:6379'
    -e SQL_DSN='postgresql://root:123456@postgres:5432/new-api'
    -e ERROR_LOG_ENABLED=true
    -e TZ=Asia/Shanghai
    "$CANARY_IMG" --log-dir /app/logs
  )
}

cmd_build() {
  echo ">>> 构建 canary 镜像 $CANARY_IMG"
  docker build -t "$CANARY_IMG" "$REPO"
  echo ">>> 完成"
}

cmd_deploy() {
  echo ">>> 重建金丝雀容器 $CANARY_NAME (镜像 $CANARY_IMG)"
  docker rm -f "$CANARY_NAME" >/dev/null 2>&1 || true
  build_args
  docker run -d "${CANARY_ARGS[@]}" >/dev/null
  sleep 8
  # 等待 healthy
  for i in $(seq 1 20); do
    st=$(docker inspect -f '{{.State.Health.Status}}' "$CANARY_NAME" 2>/dev/null || echo "gone")
    [ "$st" = "healthy" ] && { echo ">>> 金丝雀 healthy"; exit 0; }
    [ "$st" = "gone" ] && { echo "!!! 容器消失，部署失败"; exit 1; }
    sleep 3
  done
  echo "!!! 金丝雀未能在 60s 内 healthy（当前: $st），检查日志: docker logs $CANARY_NAME"
  exit 1
}

cmd_test() {
  echo ">>> 金丝雀健康探测: http://127.0.0.1:$CANARY_PORT"
  curl -sf "http://127.0.0.1:$CANARY_PORT/api/status" >/dev/null && echo ">>> OK" || { echo "!!! 探测失败"; exit 1; }
}

cmd_on() {
  echo ">>> 金丝雀接入 nginx (weight=1 灰度)"
  sed -i "s|^[[:space:]]*#*[[:space:]]*server 127.0.0.1:3002.*|$UPSTREAM_LINE|" "$NGINX_CONF"
  "$NGINX_BIN" -t >/dev/null && "$NGINX_BIN" -s reload
  echo ">>> 已接入灰度流量。观察日志确认正常，随后发布到生产。"
}

cmd_off() {
  echo ">>> 金丝雀摘除 nginx（秒级回滚）"
  sed -i 's|^[[:space:]]*server 127.0.0.1:3002.*|    # server 127.0.0.1:3002 weight=1;   # 金丝雀（先测试后接入，weight 越小流量越少）|' "$NGINX_CONF"
  "$NGINX_BIN" -t >/dev/null && "$NGINX_BIN" -s reload
  echo ">>> 已摘除，流量全部回生产实例。"
}

cmd_status() {
  echo "== 容器 =="
  docker ps --filter name=new-api --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
  echo "== nginx upstream =="
  grep -n 'server 127.0.0.1:30' "$NGINX_CONF"
  echo "== 金丝雀是否在转发列表 =="
  grep -qE '^[[:space:]]*server 127.0.0.1:3002' "$NGINX_CONF" && echo "已接入（ON）" || echo "未接入（OFF）"
}

# ---------- 自动回滚看门狗 ----------
WATCH_LOG=/www/wwwroot/routify/logs/canary-watchdog.log

log_watch() { echo "[$(date '+%F %T')] $*" >> "$WATCH_LOG"; }

# 从 DB 取一个有效 token（不打印，仅用于探测）
get_probe_token() {
  local pg
  pg=$(docker ps -qf name=postgres | head -1)
  [ -n "$pg" ] || { echo "!! 找不到 postgres 容器"; return 1; }
  docker exec "$pg" psql "postgresql://root:123456@postgres:5432/new-api" -t -A \
    -c "SELECT key FROM tokens WHERE status=1 AND used_quota IS NOT NULL ORDER BY id DESC LIMIT 1;" \
    2>/dev/null | tr -d '[:space:]'
}

# 探测单实例：返回 "状态码|耗时ms|错误标记(OK/ERR)"
# $1=端口 $2=token
probe() {
  local port=$1 tok=$2
  local out start ms
  start=$(date +%s%N)
  out=$(curl -s -m 10 -o /dev/null -w "%{http_code}" \
        "http://127.0.0.1:$port/v1/models" -H "Authorization: Bearer $tok" 2>/dev/null) || out="000"
  ms=$(( ($(date +%s%N) - start) / 1000000 ))
  if [ "$out" = "000" ]; then echo "$out|$ms|ERR";           # 连接失败/超时
  elif [ "$out" -ge 500 ]; then echo "$out|$ms|ERR";         # 5xx
  else echo "$out|$ms|OK"; fi
}

cmd_watch() {
  local interval=${WATCH_INTERVAL:-10}        # 探测间隔（秒）
  local consec_limit=${WATCH_CONSEC:-3}       # 连续失败多少次触发回滚
  local rate_limit=${WATCH_RATE:-5}           # 滑动窗口错误率阈值（%）
  local window=${WATCH_WINDOW:-60}            # 滑动窗口大小（次）

  grep -qE '^[[:space:]]*server 127.0.0.1:3002' "$NGINX_CONF" || {
    echo "!!! 金丝雀当前未接入（OFF），看门狗没有意义。先 tools/deploy-canary.sh on 再启动 watch。"
    exit 1
  }
  echo ">>> 金丝雀看门狗启动: 每 ${interval}s 探测一次"
  echo ">>> 阈值: 连续失败>${consec_limit} 或 窗口错误率>${rate_limit}% 即自动回滚 (log: $WATCH_LOG)"
  log_watch "=== watchdog started ==="

  local tok; tok=$(get_probe_token) || { echo "!!! 取不到探测 token"; exit 1; }

  # 滑动窗口记录最近 N 次金丝雀探测结果（OK/ERR）
  local -a win=()
  local consec=0 canary_res prod_res

  while true; do
    canary_res=$(probe 3002 "$tok")
    prod_res=$(probe 3001 "$tok")

    local ccode cm cflag pcode pm pflag
    IFS='|' read -r ccode cm cflag <<<"$canary_res"
    IFS='|' read -r pcode pm pflag <<<"$prod_res"

    # 窗口滚动
    win+=( "$cflag" )
    [ "${#win[@]}" -gt "$window" ] && win=("${win[@]:1}")
    # 错误率
    local errs=0
    for f in "${win[@]}"; do [ "$f" = "ERR" ] && errs=$((errs+1)); done
    local rate=$(( errs * 100 / ${#win[@]} ))

    echo "$(date '+%T') canary=${ccode}/${cm}ms(${cflag}) prod=${pcode}/${pm}ms(${pflag}) 窗口错误率=${rate}% (${errs}/${#win[@]})"

    if [ "$cflag" = "ERR" ]; then
      consec=$((consec+1))
    else
      consec=0
    fi

    # 回滚条件 1：金丝雀连续失败超过阈值（不管生产如何，金丝雀自己不可用就回滚）
    if [ "$consec" -ge "$consec_limit" ]; then
      echo "!!! 金丝雀连续失败 ${consec} 次，自动回滚"
      log_watch "ROLLBACK (consecutive failures=${consec}, last=${canary_res}, prod=${prod_res})"
      cmd_off
      exit 0
    fi
    # 回滚条件 2：滑动窗口错误率超阈值，且生产同期正常（排除全站故障）
    if [ "${#win[@]}" -ge "$window" ] && [ "$rate" -gt "$rate_limit" ] && [ "$pflag" = "OK" ]; then
      echo "!!! 金丝雀错误率 ${rate}% 超阈值且生产正常，自动回滚"
      log_watch "ROLLBACK (error rate=${rate}% > ${rate_limit}%, window=${#win[@]}, prod=${prod_res})"
      cmd_off
      exit 0
    fi

    sleep "$interval"
  done
}

case "${1:-}" in
  build)   cmd_build ;;
  deploy)  cmd_deploy ;;
  test)    cmd_test ;;
  on)      cmd_on ;;
  off)     cmd_off ;;
  status)  cmd_status ;;
  watch)   cmd_watch ;;
  *)       grep -E '^\s+# ' "$0" | sed 's/#/ /' | head -40 ;;
esac
