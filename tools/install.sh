#!/usr/bin/env bash
# Install a single HyxAPI instance without replacing existing data or secrets.
set -euo pipefail

usage() {
  cat <<'HELP'
Usage: bash install.sh [directory]

Requires Linux, Docker Engine, Docker Compose 2.20+, curl and openssl.
Default directory: $HOME/hyxapi-deploy
Options for a new installation:
  HYXAPI_PORT          Host port (default: 3000)
  HYXAPI_BIND_ADDRESS  Host IPv4 address (default: 127.0.0.1)
  HYXAPI_IMAGE         Image tag or digest (default: ghcr.io/huey1in/hyxapi:latest)
  HYXAPI_SITE_URL      HTTPS origin, e.g. https://api.example.com

Existing .env and compose.yml are preserved. Use Docker Compose to update.
HELP
}

fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }

if [[ "${1:-}" == --help || "${1:-}" == -h ]]; then
  usage
  exit 0
fi
[[ $# -le 1 ]] || fail 'Expected at most one deployment directory.'
[[ "$(uname -s)" == Linux ]] || fail 'Run this installer on a Linux server.'
for hyxapi_dependency in docker curl openssl; do
  command -v "$hyxapi_dependency" >/dev/null || fail "Missing dependency: $hyxapi_dependency"
done
docker compose version >/dev/null || fail 'Install the Docker Compose plugin: https://docs.docker.com/compose/install/'
docker info >/dev/null 2>&1 || fail 'Docker is unavailable. Start Docker and check your user permissions.'

hyxapi_install_dir="${1:-$HOME/hyxapi-deploy}"
hyxapi_port="${HYXAPI_PORT:-3000}"
hyxapi_bind="${HYXAPI_BIND_ADDRESS:-127.0.0.1}"
hyxapi_image="${HYXAPI_IMAGE:-ghcr.io/huey1in/hyxapi:latest}"
hyxapi_site_url="${HYXAPI_SITE_URL:-}"
[[ "$hyxapi_port" =~ ^[0-9]{1,5}$ ]] && ((10#$hyxapi_port > 0 && 10#$hyxapi_port <= 65535)) || fail 'HYXAPI_PORT must be between 1 and 65535.'
[[ "$hyxapi_bind" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || fail 'HYXAPI_BIND_ADDRESS must be an IPv4 address.'
IFS=. read -r -a hyxapi_octets <<< "$hyxapi_bind"
for hyxapi_octet in "${hyxapi_octets[@]}"; do
  ((10#$hyxapi_octet <= 255)) || fail 'HYXAPI_BIND_ADDRESS must be an IPv4 address.'
done
[[ "$hyxapi_image" =~ ^[a-zA-Z0-9._/:@-]+$ ]] || fail 'Invalid HYXAPI_IMAGE.'
if [[ -n "$hyxapi_site_url" && ! "$hyxapi_site_url" =~ ^https://[a-zA-Z0-9.-]+(:[0-9]+)?/?$ ]]; then
  fail 'HYXAPI_SITE_URL must be an HTTPS origin, without a path or query.'
fi

umask 077
mkdir -p -- "$hyxapi_install_dir"
hyxapi_install_dir="$(cd -- "$hyxapi_install_dir" && pwd -P)"
[[ "$hyxapi_install_dir" != / ]] || fail 'The deployment directory cannot be /.'
if [[ ! -f "$hyxapi_install_dir/.env" ]]; then
  for hyxapi_existing in data logs docker-compose.yml docker-compose.yaml compose.yml compose.yaml; do
    [[ ! -e "$hyxapi_install_dir/$hyxapi_existing" ]] || fail 'Existing deployment detected without .env. Restore its original configuration and secrets first.'
  done
  hyxapi_session_secret="$(openssl rand -hex 32)"
  # noclobber prevents another installer from replacing the secret concurrently.
  (set -o noclobber; cat > "$hyxapi_install_dir/.env" <<ENV
HYXAPI_IMAGE=$hyxapi_image
HYXAPI_PORT=$hyxapi_port
HYXAPI_BIND_ADDRESS=$hyxapi_bind
SESSION_SECRET=$hyxapi_session_secret
SESSION_COOKIE_SECURE=$([[ -n "$hyxapi_site_url" ]] && printf true || printf false)
SESSION_COOKIE_TRUSTED_URL=$hyxapi_site_url
TZ=UTC
ENV
  )
fi

if [[ ! -f "$hyxapi_install_dir/compose.yml" ]]; then
  [[ ! -e "$hyxapi_install_dir/docker-compose.yml" && ! -e "$hyxapi_install_dir/docker-compose.yaml" && ! -e "$hyxapi_install_dir/compose.yaml" ]] || fail 'Another Compose file exists. Use that deployment instead.'
  hyxapi_compose_tmp="$(mktemp "$hyxapi_install_dir/.compose.XXXXXX")"
  trap 'rm -f -- "$hyxapi_compose_tmp"' EXIT
  hyxapi_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
  if [[ -f "$hyxapi_script_dir/../deploy/compose.yml" ]]; then
    cp -- "$hyxapi_script_dir/../deploy/compose.yml" "$hyxapi_compose_tmp"
  else
    curl --fail --silent --show-error --location \
      https://raw.githubusercontent.com/huey1in/hyxapi/main/deploy/compose.yml \
      --output "$hyxapi_compose_tmp"
  fi
  # Hard-link creation refuses to replace a file created by another installer.
  ln -- "$hyxapi_compose_tmp" "$hyxapi_install_dir/compose.yml"
  rm -f -- "$hyxapi_compose_tmp"
  trap - EXIT
fi

cd -- "$hyxapi_install_dir"
docker compose --env-file .env -f compose.yml config --quiet
mkdir -p data logs
docker compose --env-file .env -f compose.yml pull
docker compose --env-file .env -f compose.yml up -d --wait --wait-timeout 180
printf '\nHyxAPI is ready. Deployment directory: %s\n' "$hyxapi_install_dir"
printf 'Open /setup through your HTTPS domain, or the local host port configured in .env.\n'
printf 'Logs: cd %q && docker compose -f compose.yml logs -f hyxapi\n' "$hyxapi_install_dir"
