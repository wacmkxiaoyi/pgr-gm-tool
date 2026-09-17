# WACMK PGR GM Tool

A FastAPI-based administration tool for WACMK PGR servers and player data. The backend serves the static frontend, so only one process is required to run the application.

## User Guide

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

The quick-start script sets `ENABLE_SERVER_MANAGEMENT=false` by default. This is intended for deployments that only manage MongoDB player data.

To enable server management on Windows, change this line in `quick_start.bat`:

```bat
set "ENABLE_SERVER_MANAGEMENT=true"
```

Then uncomment and adjust the adjacent optional settings for `SERVER_PATH`, `SERVER_BINARY_FILE`, `SERVER_RUNTIME_LOG_PATH`, `HEALTHY_CHECK_INTERVAL`, and the fallback SDK/game-server endpoints. On Windows, `SERVER_BINARY_FILE` must be an existing `.exe` file.

### Login And Basic Workflow

1. Configure `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and MongoDB connection settings before starting.
2. Open `http://127.0.0.1:8000/login` and sign in.
3. Open Database Management and confirm that the MongoDB status is healthy.
4. Select an account before editing player profile, characters, weapons, memories, items, or stages.

When server management is enabled, the Server Management page also shows SDK and game-server health. If the configured executable is available, it provides start, stop, live-log, and server configuration controls.

### Configuration

The application accepts configuration in this precedence order:

1. CLI arguments
2. Process environment variables
3. Built-in defaults

`.env.example` is a reference template. A `.env` file is not loaded automatically, so set process environment variables, use `quick_start.bat`, or pass CLI options.

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
| `true` or unset | Registers server-management API routes and renders the Server Management page. |
| `false` | Does not register server-management API routes, does not run game-server health polling, and hides the page in the frontend. |

The application default is `true`. The Windows quick-start script explicitly uses `false`.

When enabled, these settings are available:

| Setting | Default | Purpose |
| --- | --- | --- |
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
