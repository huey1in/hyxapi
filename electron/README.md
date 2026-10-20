# Hyxware Desktop

The desktop application runs the existing Hyxware interface with a private local
SQLite server. It supports a system tray, a single application instance, and
persistent data under the operating system's application data
directory. Closing the window hides it; choose **Quit** to stop the local server.
If the system tray is unavailable, closing the window quits.

From `web/`, run `bun install` and `bun run build`. Then, from `electron/`:

```sh
bun install
bun run prepare-server
bun run start
```

`bun run dev` opens the existing development frontend on port 5173. Start
`go run .` in the repository root and `bun run dev` in `web/` first.

Run `bun run test` for runtime checks. Package on the target operating system
with `bun run build:win`, `bun run build:mac`, or `bun run build:linux`.
Each command compiles the Go server for the current host before packaging;
cross compilation is not configured. Output goes to `electron/dist/`.
Signing credentials are supplied through electron-builder's environment settings.

The application chooses a free port once, retains it in `server-port`, and binds
the server to `127.0.0.1`. Restarting preserves the same browser origin and local
preferences. If another service occupies that port, stop that service first;
the desktop application will report the conflict.
It ignores inherited database and Redis connection strings. Use **Open data
folder** in the application menu to find the database, file logs and persistent
session secret. Quit before backing up the entire data folder. Do not discard
`session-secret` when restoring a backup.

Set `HYXWARE_DESKTOP_DATA_DIR` to an absolute path for a separate portable profile.
`--background` starts with the window hidden. These settings also allow isolated
local smoke checks without touching an installed profile.
