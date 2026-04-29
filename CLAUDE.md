# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

New-API is an LLM gateway and AI asset management system (forked from One-API) maintained by QuantumNous. It proxies requests to multiple AI providers through a unified OpenAI-compatible API, with user/token/channel management, quota tracking, and billing.

## Build & Run

### Backend (Go)
```bash
# Run directly
go run main.go

# Run with options
go run main.go --port 3000 --log-dir ./logs

# Build binary
go build -o new-api main.go
```

### Frontend (React + Vite, uses bun)
```bash
cd web
bun install
bun run dev          # dev server (proxies to localhost:3000)
bun run build        # production build → web/dist/
bun run lint         # prettier check
bun run lint:fix     # prettier fix
bun run eslint       # eslint check
bun run eslint:fix   # eslint fix
```

### Full build (makefile)
```bash
make                 # build frontend then start backend dev server
make build-frontend  # frontend only
```

### Docker
```bash
docker-compose up -d  # starts new-api + redis + postgres on port 3000
```

### Tests
```bash
go test ./...                          # all backend tests
go test ./model/... -run TestPayment   # single test
```

## Architecture

### Backend (Go / Gin)

**Entry point:** `main.go` — initializes DB, Redis, i18n, OAuth, background tasks, then wires Gin routes.

**Package layout:**
- `router/` — Gin route registration split into `api-router.go` (admin/user REST API), `relay-router.go` (OpenAI-compatible proxy endpoints), `dashboard.go`, `video-router.go`, `web-router.go` (serves embedded `web/dist/`)
- `middleware/` — auth (`auth.go`), channel selection (`distributor.go`), rate limiting, CORS, i18n, token validation
- `controller/` — HTTP handlers for API and relay routes
- `relay/` — core proxy logic:
  - `relay/channel/adapter.go` — defines the `Adaptor` and `TaskAdaptor` interfaces that every provider must implement
  - `relay/channel/<provider>/` — per-provider implementations (openai, claude, gemini, aws, baidu, volcengine, etc.)
  - `relay/relay_adaptor.go` — factory: maps `APIType` integer constants → concrete `Adaptor`
  - `relay/common/relay_info.go` — `RelayInfo` struct passed through the full request lifecycle
  - Handler files: `compatible_handler.go`, `chat_completions_via_responses.go`, `claude_handler.go`, `gemini_handler.go`, `responses_handler.go`, `audio_handler.go`, `image_handler.go`, `embedding_handler.go`, `rerank_handler.go`
- `model/` — GORM models and DB access (channel, token, user, log, task, pricing, options)
- `dto/` — request/response structs for OpenAI, Claude, Gemini, Midjourney, etc.
- `service/` — shared services (HTTP client, token encoding, subscription resets, Codex credential refresh)
- `setting/` — runtime configuration subsystems (ratio settings, model settings, operation settings, performance settings)
- `middleware/distributor.go` — selects an upstream channel for each request based on model name, user group, token permissions, and channel priority/weight
- `constant/` — channel type integers, relay mode constants, task platform identifiers. **Constraint:** this package may only import Go stdlib — no internal package imports, no business logic.

### Frontend (React 18 + Vite + Semi UI)

**Entry:** `web/src/index.jsx` → `web/src/App.jsx` (React Router v6 routes)

**Key patterns:**
- UI library: `@douyinfe/semi-ui` (primary) + Tailwind CSS
- State: React Context (`context/User`, `context/Status`, `context/Theme`) — no Redux
- i18n: `react-i18next` with locale files under `web/src/i18n/`
- API calls: `web/src/services/` and `web/src/helpers/`
- Pages: lazy-loaded via `React.lazy` for Dashboard, Home, About; eagerly imported for Channel, Token, Log, etc.

## Key Configuration

The backend reads environment variables (and optionally `.env`):

| Variable | Purpose |
|---|---|
| `SQL_DSN` | Database (SQLite default, or `postgresql://...` / `mysql://...`) |
| `REDIS_CONN_STRING` | Redis (enables memory cache + distributed locking) |
| `SESSION_SECRET` | Cookie session secret — must change for multi-node |
| `PORT` | Listen port (default 3000) |
| `NODE_TYPE` | Set to `slave` to disable master-only tasks |
| `NODE_NAME` | Appears in audit logs |
| `MEMORY_CACHE_ENABLED` | Enable in-memory channel cache without Redis |
| `BATCH_UPDATE_ENABLED` | Batch DB writes for high-throughput logging |
| `DEBUG` | Verbose logging |

## Adding a New Provider Channel

**Synchronous (chat/embedding/audio/image):**
1. Create `relay/channel/<name>/` with a struct implementing `channel.Adaptor` (all methods in `relay/channel/adapter.go`)
2. Add a new `APIType` constant in `constant/`
3. Register it in `relay/relay_adaptor.go`'s `GetAdaptor()` switch
4. Add an entry to `CHANNEL_OPTIONS` in `web/src/constants/channel.constants.js`

**Async task-based (video gen, etc.):**
1. Create `relay/channel/task/<name>/` implementing `channel.TaskAdaptor`
2. Same steps 2–4 above; register in `relay/relay_adaptor.go`'s `GetTaskAdaptor()` switch

## Billing / Quota Flow

Requests flow through:
1. `middleware.TokenAuth()` — validates API key, loads user + token
2. `middleware.Distribute()` — selects channel, checks quota, sets `RelayInfo`
3. Handler (`compatible_handler.go` etc.) — pre-charges quota estimate
4. Adaptor `DoRequest` + `DoResponse` — proxies to upstream, returns actual usage
5. Post-response quota settlement based on actual token counts from `RelayInfo`

Task-based providers (image gen, video gen) use the `TaskAdaptor` interface with `EstimateBilling` / `AdjustBillingOnSubmit` / `AdjustBillingOnComplete` for async quota settlement.
