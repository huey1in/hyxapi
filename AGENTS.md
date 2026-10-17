# Repository Guidelines

## Project Structure & Module Organization

- `main.go` starts the Go/Gin API. `router/`, `middleware/`, and `controller/` handle HTTP requests; `service/` contains business logic and `model/` persistence.
- `relay/` implements upstream adapters. `relaykit/` is a separate Go module for protocol DTOs and conversions; keep it independent of gateway, billing, and database code.
- `web/` contains the React/Vite frontend: pages in `src/pages/`, reusable UI in `src/components/`, translations in `src/i18n/`, and static assets in `public/`.
- Tests sit alongside source files. `docs/` holds API, installation, and design documentation; backend translations live in `i18n/locales/`.

## Build, Test, and Development Commands

Use Go 1.25.1 or newer, Bun for frontend dependencies, and Node.js for frontend tests.

- In `web/`, run `bun install`, then `bun run build` to generate `web/dist/`. Build this first: Go embeds the frontend and requires these files even for root-module tests.
- From the repository root, run `go run .` to serve locally on port 3000, or `go build -o new-api .` to compile.
- In another terminal under `web/`, run `bun run dev`; Vite proxies API requests to port 3000. `bun run storybook` opens component previews.
- Run `go test ./...` from the root, and separately from `relaykit/`; root tests do not traverse the nested module.
- From the root, run `node --test web/src/pages/modelPricingFrontend.test.js`; pass additional `*.test.js` paths explicitly.

## Coding Style & Naming Conventions

Format Go changes with `gofmt`; use tabs, lowercase package names, and descriptive snake_case filenames. Follow frontend conventions: two-space indentation, single quotes, semicolons, PascalCase components, and camelCase helpers/hooks. No frontend lint or formatting script is configured; match surrounding code.

## Testing Guidelines

Go tests use `testing` and Testify, with `TestXxx` functions in `*_test.go`. Frontend tests use `node:test` and `node:assert/strict` in `*.test.js`. Add regression coverage for changed billing, authorization, and protocol behavior. Review RelayKit golden output changes before updating fixtures. No enforced coverage threshold is configured.

## Commit & Pull Request Guidelines

Follow history's prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, and `style:`. Use concise, imperative descriptions. PRs should explain behavior changes, link relevant issues, list validation commands/results, and include screenshots for UI changes.

## Security & Configuration

Copy `.env.example` to `.env` for local settings. Keep credentials, database files, logs, and generated `web/dist/` out of commits. Replace sample deployment passwords and configure a random `SESSION_SECRET`.
