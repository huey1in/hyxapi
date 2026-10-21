# HyxAPI frontend

Use Node.js 22.12 or later and Bun. The application uses React 19, Rsbuild 2 and
Tailwind CSS 4. Run these commands from `web/`:

```sh
bun install --frozen-lockfile
bun run dev              # http://localhost:5173; proxies the native Go API on :3000
bun run typecheck        # strict checking for TypeScript source and configuration
bun run test            # all *.test.js suites with Node's test runner
bun run build           # typecheck and compile into dist/ for Go embedding
bun run preview         # serve the production frontend
bun run storybook       # component previews on :6006
bun run build-storybook # static component previews
```

Start the backend with `go run .` from the repository root after building the
frontend. No container is required. Production serves the frontend and API from
the same origin. Optional `PUBLIC_API_BASE_URL` replaces the old
`VITE_REACT_APP_SERVER_URL`; leave it empty for normal deployments.

New modules use `.ts` or `.tsx`. Shared API types, requests, authentication state,
theme state and the primary button are checked strictly. Existing JavaScript
pages remain supported through `allowJs` during incremental migration; they are
not covered by `typecheck` until converted.

Define design tokens with `@theme inline` in `src/index.css`. Dark mode follows
the `.dark` class. Keep static resources in `public/` and reference them by their
root URL, such as `/fonts/example.woff2`. Application imports are extensionless.
