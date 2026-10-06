# PGR GM Tool

A FastAPI-based administration tool for PGR private servers (e.g., `AscNet`) and player data. The backend serves the static frontend, so only one process is required to run the application.

> Current support: InfiniteLoop 4.8 (document version 4.8.12), synchronized with commit `f30151151aad36307e770d490ab466ae6d9b900b`.

## Quick start for [AscNet Launcher](https://github.com/reiserFSs/InfiniteLoop/releases) Users

1. Install Python (> 3.12)
2. Start AscNet Launcher, and click 'Play' (**do not login**).
    > If you have logined, please close your game client, but not close launcher (or close and re-launch again)
3. Run `quick_start.bat` or `quick_start.sh`
4. Open `http://127.0.0.1:8000`, switch your language:
    - For CN client, use language: `Chinese`
    - For other client (GLO, JP, TW, etc.), use `English` (default)
    > **Do not** mix-use language, some model has been hidden/deleted in CN, **game crashes** may encounter as mixed use.
5. Make some modified
6. Login in and enjoy

## Detailed User Guide

### Requirements

- Python 3.12 or newer
- A reachable MongoDB instance
- A current Chrome or Edge browser

The frontend has no Node.js dependencies, build step, or separate development server.

### Windows Quick Start

Run `quick_start.bat` from the repository root. It:

1. Finds `python` or `python3` (Python 3.12+).
2. Creates `.venv` if necessary.
3. Installs missing or incompatible packages from `backend/requirements.txt`.
4. Starts the application at `http://127.0.0.1:8000/login`.

On Windows, the application checks `%LOCALAPPDATA%\AscNetLauncher\local\build-state.json` automatically. When present, it uses the Launcher's actual build and random ports for server and database management. To use another local root:

```bat
quick_start.bat --ASCNET_LAUNCHER_PATH "D:\AscNetLauncher\local"
```

Without a Launcher state file, configure `SERVER_PATH`, `SERVER_BINARY_FILE`, `SERVER_RUNTIME_LOG_PATH`, and the fallback SDK/game-server endpoints as needed. A directly launched Windows `SERVER_BINARY_FILE` must be an existing `.exe` file. Set `ENABLE_SERVER_MANAGEMENT=false` to use only database management; Launcher database auto-configuration still applies.

The GM web port remains `8000`. Launcher selects free ports rather than reserving a fixed GM port. To change the GM port, run `quick_start.bat --APP_PORT 8001` or set `APP_PORT`. The startup output shows the effective login URL.

### macOS Quick Start

Install Python 3.12+ and run from the project directory:

```bash
bash quick_start.sh
```

The script creates `.venv`, installs dependencies and starts the application. Server process management defaults to disabled on this path. Connect to your MongoDB using environment variables or CLI options:

```bash
bash quick_start.sh --MONGO_HOST 127.0.0.1 --MONGO_PORT 27017 --MONGO_DB asc_net --APP_PORT 8000
```

Both quick-start scripts forward CLI arguments. Use Ctrl+C to exit.

### Login And Basic Workflow

1. Configure MongoDB connection settings before starting.
2. To require login, configure both `ADMIN_USERNAME` and `ADMIN_PASSWORD`; leaving either one empty disables login.
3. Open `http://127.0.0.1:8000/`. When login is enabled, sign in at `/login` first.
4. Open Database Management and confirm that the MongoDB status is healthy.
5. Select an account before editing player profile, characters, weapons, memories, items, or stages.

When login is disabled, anyone who can reach the application can operate the GM tool. Use this mode only on a trusted local machine or protected network.

When server management is enabled, the Server Management page also shows SDK and game-server health. If the configured executable is available, it provides start, stop, live-log, and server configuration controls.

### Configuration

The application accepts configuration in this precedence order:

1. CLI arguments
2. Process environment variables
3. Built-in defaults

`.env.example` is a reference template. A `.env` file is not loaded automatically, so set process environment variables, use `quick_start.bat`, or pass CLI options.

The UI defaults to English. Use the language selector on the login page or in the dashboard sidebar to switch between Chinese and English. Your selection is remembered in the browser across reloads.

Example PowerShell launch:

```powershell
$env:ADMIN_USERNAME = "admin"
$env:ADMIN_PASSWORD = "change-this-password"
$env:MONGO_HOST = "127.0.0.1"
$env:MONGO_PORT = "27017"
$env:MONGO_DB = "asc_net"
python -m backend.app.main
```

### Server Management

`ENABLE_SERVER_MANAGEMENT` controls the whole optional server-management feature.

| Value | Behavior |
| --- | --- |
| `true` | Registers server-management API routes and renders the Server Management page. |
| `false` or unset | Does not register server-management API routes, does not run game-server health polling, and hides the page in the frontend. |

The application and both quick-start scripts default to `false`, including when a Launcher build is discovered. Enable it with `--ENABLE_SERVER_MANAGEMENT true` or an environment variable; CLI takes precedence.

#### AscNet Launcher Integration

`ASCNET_LAUNCHER_PATH` defaults to `%LOCALAPPDATA%\AscNetLauncher\local` on Windows, and empty when `LOCALAPPDATA` is unavailable. An empty value disables discovery. When no `build-state.json` exists there, ordinary configuration is used. A present but invalid build produces a descriptive startup error.

Connection/runtime selection uses this precedence: **Launcher state > service directory/configuration > manual connection parameters** (including `MONGO_URI`). Within each option, CLI values override environment values.

The state provides `serverDirectory`, `resourceDirectory`, `dotnet`, `mongod`, `sdkPort`, `gamePort` and `mongoPort`. The build directory is read from this file; the support commit above is a compatibility reference, not a runtime path.

- Database and player management connect to the Launcher's loopback MongoDB port and the database specified by the running configuration.
- Server **Start** first starts MongoDB with `<local root>/data/mongo`, then runs `dotnet <serverDirectory>/AscNet.dll --urls http://127.0.0.1:<sdkPort>` from `resourceDirectory`, with the same routing/bind/managed-stdin environment as Launcher. Startup waits for MongoDB, the game port and `/api/launcher/status`.
- Exact existing Launcher server/MongoDB instances are reused. Occupied ports from other instances cause startup to fail. Logs append to `<local root>/logs/server.log` and `mongod.log`.
- **Stop** shuts down the GM-started server before its MongoDB. A matching externally started server can be stopped explicitly; externally started MongoDB is left running. Exiting GM cleans up only the backend processes it started.
- Configuration reads `resourceDirectory/Configs/config.json`. Saving also updates `<local root>/config.json`, the persistent source used by Launcher Setup. Game/MongoDB loopback settings and the `asc_net` database must remain consistent with the Launcher state; SDK HTTP uses `sdkPort` via the startup arguments.

Launcher upgrades are picked up when GM is restarted. `ENABLE_SERVER_MANAGEMENT=false` disables server controls while retaining automatic database connection settings. With server management disabled, start MongoDB through Launcher or another method before using database management.

When enabled, these settings are available:

| Setting | Default | Purpose |
| --- | --- | --- |
| `ASCNET_LAUNCHER_PATH` | `%LOCALAPPDATA%\AscNetLauncher\local` on Windows | Discover a local Launcher build and automatically configure server/database paths and ports. |
| `HEALTHY_CHECK_INTERVAL` | `60` | Server and database health-check interval in seconds. |
| `SERVER_PATH` | `/root/wacmk-pgr-server` | Server directory containing the executable and `Configs/config.json`. |
| `SERVER_BINARY_FILE` | `Wacmk.Pgr.Server` | Server executable file name. |
| `SERVER_RUNTIME_LOG_PATH` | `/tmp/rpg-server.log` | Runtime log to stream in the dashboard. |
| `SDK_SERVER_SCHEME` | `http` | Fallback SDK health-check scheme. |
| `SDK_SERVER_HOST` / `SDK_SERVER_PORT` | `127.0.0.1` / `80` | Fallback SDK health-check target. |
| `GAME_SERVER_HOST` / `GAME_SERVER_PORT` | `127.0.0.1` / `2335` | Fallback game TCP health-check target. |

If `SERVER_PATH/Configs/config.json` exists and contains valid JSON, its SDK, game-server, and MongoDB connection settings override the corresponding fallback environment values.

MongoDB can use either `MONGO_URI` or `MONGO_HOST`, `MONGO_PORT`, `MONGO_DB`, `MONGO_USERNAME`, `MONGO_PASSWORD`, `MONGO_AUTH_SOURCE`, and `MONGO_TLS`.

## Developer Guide

### Project Structure

```text
.
|- backend/
|  |- app/
|  |  |- main.py          Application entry point and CLI parsing
|  |  |- config.py        Runtime settings
|  |  |- apis/            FastAPI routes and response schemas
|  |  |- services/        Business services, health checks, and auth
|  |  `- db/              MongoDB access and data models
|  |- requirements.txt    Python dependencies
|  `- tests/              Backend tests
|- frontend/
|  |- index.html          Login page
|  |- dashboard.html      Dashboard page
|  |- src/                Browser JavaScript and CSS
|  `- assets/             Static assets
|- .env.example           Configuration reference
`- quick_start.bat        Windows bootstrap and launcher
```

### Architecture

`backend.app.main` builds `Settings`, creates the FastAPI application, and calls `init_app`. The application mounts `/src` and `/assets`, serves `/login` and the authenticated dashboard at `/`, and registers API routes under `/api`.

The frontend is plain HTML, CSS, and ES modules. It requests `/api/app-info` at startup to determine whether server management is available, then only polls the active management page.

### Game Resource Tables

`backend/assets/EN/` and `backend/assets/CN/` contain independent TSV datasets. All APIs select the complete dataset using the request's `Accept-Language` header (`en-US` → EN, `zh-CN` → CN; default EN), including names, search, available IDs, and upgrade rules. Parsed and derived tables are cached independently in memory for each language. Changing the dashboard language reloads the page to refresh tables and discard old requests and dialog state.

Refresh both datasets together (the former `--cn` option has been removed):

```powershell
python backend/scripts/tsv_fetcher.py --upstream-dir "....\PGR_Data"
```

Omit `--upstream-dir` to download from GitHub, or add `--dry-run` to validate without replacing files. Existing CN-only source mappings for EN are preserved. Both datasets must be prepared successfully before replacement; known legacy root tables are removed after migration. Restart the backend after a resource refresh to clear its in-memory caches.

Max All uses the first `BaseCharacterIds` entry in `TeamRecommendCharacterTarget.tsv` and resolves equipment from `TeamRecommendBaseCharacter.tsv`. Both datasets currently use the CN upstream source for these tables. `MAX_CHARACTER_USE_FIX_MEMORY_RESONANCE` defaults to `true` to retain the fixed memory resonance strategy; when disabled, the selected native recommendation supplies memory resonances. `MAX_CHARACTER_USE_RECOMMEND_HARMONY` defaults to `true` to use the selected recommendation's `WeaponOverrunChoseSuit` (zero means no selected suit); set it to `false` to select a Harmony suit automatically from the equipped memories. Both switches support environment variables and matching command-line options. Partner recommendations are loaded but are not applied by Max All. Single-file conversion targets must start with `EN/` or `CN/`.

Database health monitoring is always started. Game-server health monitoring and all server-control routes are registered only when `ENABLE_SERVER_MANAGEMENT` is enabled.

### Local Development

Create and activate a virtual environment:

```bash
python -m venv .venv
```

```powershell
.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
python -m backend.app.main
```

Use the module entry point rather than `uvicorn backend.app.main:app` when testing CLI options, because CLI parsing occurs when `backend.app.main` runs as a module.

Example CLI override:

```bash
python -m backend.app.main --ENABLE_SERVER_MANAGEMENT false --ADMIN_USERNAME admin --ADMIN_PASSWORD password --MONGO_HOST 127.0.0.1 --MONGO_PORT 27017 --MONGO_DB asc_net
```

### Dependencies

Runtime dependencies are declared in `backend/requirements.txt`:

- `fastapi` and `uvicorn[standard]` for the ASGI application
- `motor` for MongoDB access
- `psutil` for server process control
- `requests` and `beautifulsoup4` for data/resource processing
- `python-dotenv` is available as a dependency, but the current application does not load `.env` files

### Testing

Run the backend test suite from the repository root:

```bash
python -m pytest backend/tests
```

For feature-gate validation, launch once with `--ENABLE_SERVER_MANAGEMENT false` and confirm that `/api/server-status` returns 404 and the dashboard contains no Server Management navigation. Launch again with `--ENABLE_SERVER_MANAGEMENT true` and confirm that the server routes and page are available.

### Operational Notes

- Authentication sessions are held in memory and expire after 12 hours. Restarting the application invalidates existing sessions.
- Database mutation features require both a healthy database connection and a selected account.
- Server configuration editing is available only while the managed server is stopped.
- Do not expose this tool directly to untrusted networks without additional authentication, network restrictions, and transport security.
