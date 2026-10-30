# PGR GM Tool

A FastAPI-based administration tool for PGR private servers (e.g., `AscNet`) and player data. The backend serves the static frontend, so only one process is required to run the application.

> Current support: InfiniteLoop 4.8 (document version 4.8.12), synchronized with commit `9b40b1f921d05873828179db6337e76d6e5cda9e`.

>[!TIP]
>If you have any setup question about this tool, it is a good choice to use "Chat with Copilot"
>
>（如果你在部署使用时遇到任何问题，你可以使用 Github 官方的 AgenticRAG 功能 - "Chat with Copilot"）
>
>Otherwise you can join to [our discord channel](https://discord.gg/fbsRYc7bBA) for futher help.

## Quick start for [AscNet Launcher](https://github.com/reiserFSs/InfiniteLoop/releases) Users

1. Install Python (> 3.12), and clone the GM tool repo:
    ```sh
    git clone git@github.com:wacmkxiaoyi/pgr-gm-tool.git
    ```
2. Start AscNet Launcher, and click 'Play' (**do not login**).
    > If you have logined, please close your game, and click 'play' again (>= 1.0.12)
3. Run `quick_start.bat` or `quick_start.sh`, according to your system
4. Open `http://127.0.0.1:8000`, switch your language:
    - For CN client, use language: `Chinese`
    - For other client (GLO, JP, TW, etc.), use `English` (default)
    > **Do not** mix-use language, some models has been hidden/deleted in CN, **game crashes** may encounter as mixed use.
5. Make some modification
6. Login now and enjoy

## Detailed User Guide

### Requirements

- Python 3.12 or newer
- Git (required for automatic downloads and updates)
- A reachable MongoDB instance
- A current Chrome or Edge browser

The frontend has no Node.js dependencies, build step, or separate development server.

### Windows Quick Start

Run `quick_start.bat` from the repository root. It:

1. Finds `python` or `python3` (Python 3.12+).
2. Downloads or updates project code by default (see below).
3. Creates `.venv` if necessary.
4. Installs missing or incompatible packages from `backend/requirements.txt`.
5. Starts the application at `http://127.0.0.1:8000/login`.

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

### Automatic Downloads And Updates

Both scripts are self-contained: with Git and Python 3.12+ installed, even a directory containing only `quick_start.bat` or `quick_start.sh` can download and start the project.

- **With `.git`**: runs `git pull --ff-only` against the current branch's configured upstream. Local uncommitted changes (including untracked files) cause the update to be skipped.
- **Without `.git`**: shallow-clones `https://github.com/wacmkxiaoyi/pgr-gm-tool.git` into a temporary directory, then copies tracked files and `.git` into the launcher's directory. This also applies to partially populated directories and GitHub Release **Source code (zip/tar.gz)** archives, which do not contain `.git`.
- During the first synchronization, different same-name local files are backed up under `.quick-start-backups/` before being overwritten. Extra local files such as `.env` and `.venv` are preserved. Failed or timed-out clones are not synchronized.
- Git operations share a **10-second timeout** by default. Credential prompts are disabled, and timed-out Git processes and their children are terminated. Local copying and dependency installation are outside this Git timeout.
- Missing Git, missing upstream, update errors and timeouts produce a message and continue with local files. If project files are still missing, the script explains that Git/network access is required before retrying.
- After a successful code update, the launcher restarts once with the updated script and forwards the original application arguments.

Set `AUTO_UPDATE=false` to disable downloads and updates, or adjust `AUTO_UPDATE_TIMEOUT` (positive seconds). These are launcher environment variables, not application CLI options; both scripts include editable defaults near the top.

Windows CMD:

```bat
set "AUTO_UPDATE=false"
quick_start.bat
```

PowerShell:

```powershell
$env:AUTO_UPDATE_TIMEOUT = "20"
.\quick_start.bat
```

macOS / Linux:

```bash
AUTO_UPDATE=false bash quick_start.sh
# Or allow more time for the initial download:
AUTO_UPDATE_TIMEOUT=20 bash quick_start.sh
```

### Login And Basic Workflow

1. Configure MongoDB connection settings before starting.
2. To require login, configure both `ADMIN_USERNAME` and `ADMIN_PASSWORD`; leaving either one empty disables login.
3. Open `http://127.0.0.1:8000/`. When login is enabled, sign in at `/login` first.
4. Open Database Management and confirm that the MongoDB status is healthy.
5. Select an account before editing player profile, characters, weapons, memories, items, or stages.

Changing the rainbow-card balance in GM does not increase Total Recharge progress. The server tracks accumulated recharge separately from the item balance and credits it only for completed recharge products.

First-pay progress is also separate: `total_pay_money` records completed recharge amounts in hundredths of `Pay.ShowAmount`, while `accumulated_pay_money` counts credited rainbow cards. Editing the GM balance does not advance either counter or claim first-pay rewards.

Accumulated consumption is tracked separately in `inventory.spent_totals`, a BSON document keyed by item ID strings with Int64 totals. The server counts in-game debits after the accumulate-expend shop's saved baseline. GM balance changes and item deletion do not count as consumption, convert shop tokens, or reset shop sign-in and version-gift claim records.

Daily and weekly task resets follow the server's configured reset boundaries. The server owns the `mission_progress.reset_epoch` migration marker, Passport season login counters, and Norman Revival Plan (Stronghold) daily settlement periods. GM profile and balance edits preserve these records. Direct balance or stage edits do not replay gameplay events to credit Passport tasks, settle Norman cycles, or award Clash Reflection (Transfinite) achievements.

Clash Reflection's legacy anchor-skipped payout repair runs on server login, once per eligible run, using the saved rotation history and inventory claim receipts. New payouts record `terminal_paid_group_id` and `terminal_skipped_score`; GM edits preserve these markers, timestamps and receipts. Changing balances or stage records does not perform the repair or recalculate War Zone area best scores or Pain Cage Intensive Battle strategy score bonuses. War Zone areas retain independent best scores even when they share a stage.

Stage management edits raw completion records only. It does not synchronize CerberusGame story points, route choices, star-reward claims, or activity teams; those are separate server-owned activity state.

It also does not resolve MaintainerAction (Operation Guardians) board nodes, change action counts, or grant activity rewards.

Adding or clearing stage records does not claim or reset chapter treasures, experiment star rewards, weekly activeness rewards, auto-fight rewards, or Stage Memory milestones; those have separate server-owned records. It also does not settle Concert Pre-Heating stages or advance their tasks. Profile edits preserve birthday single-story records, board-effect cooldowns, version-gift claims, and BossInshot talent selections.

When login is disabled, anyone who can reach the application can operate the GM tool. Use this mode only on a trusted local machine or protected network.

When server management is enabled, the Server Management page also shows SDK and game-server health. If the configured executable is available, it provides start, stop, live-log, and server configuration controls.

The server configuration editor supports InfiniteLoop's optional `"Client": { "Debug": true, "ShowInspector": true }` settings. Both default to `false`; the client inspector requires both to be enabled. These are local research settings: Debug enables the client's debug environment and external Lua/table loading. Save while the server is stopped, then start the server and restart the game to fetch the updated remote configuration. Launcher integration preserves these settings in both the persistent and runtime server configuration files.

The Launcher's **SETTINGS → CLIENT MODS** master switch also writes `Client.Debug` in its persistent configuration and reapplies it during Setup and Play. Use that switch when managing Launcher-installed mods. GM installs the latest persistent configuration before starting its managed server; restart the server and game after changing the switch.

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
- Exact existing Launcher server/MongoDB instances are reused. Occupied ports from other instances cause startup to fail. GM-started services write to `<local root>/logs/server.log` and `mongod.log`. Each start preserves the previous run as `server.previous.log` / `mongod.previous.log`; logs also rotate at 32 MiB during a run, retaining at most two files per service. The live-log view follows rotation automatically.
- Launcher 1.0.12 uses native Rust Setup while retaining the same version-1 build state. When GM runs as a Windows process under Wine, its MongoDB command also disables diagnostic data collection, matching Launcher.
- Launcher stops its local services when the game exits. With server management disabled in GM, keep the game and Launcher running while editing player data before login; if they stop, start the backend through Launcher again.
- **Stop** shuts down the GM-started server before its MongoDB. A matching externally started server can be stopped explicitly; externally started MongoDB is left running. Exiting GM cleans up only the backend processes it started.
- Configuration reads `resourceDirectory/Configs/config.json`. Saving also updates `<local root>/config.json`, the persistent source used by Launcher. Before starting a new backend, GM validates and atomically copies this persistent configuration into `serverDirectory/Configs/config.json`, so external edits apply on the next start. Game/MongoDB loopback settings and the `asc_net` database must remain consistent with the Launcher state; SDK HTTP uses `sdkPort` via the startup arguments. Missing or invalid persistent configuration prevents startup.
- Server packet logs omit heartbeats below `SuperDebug`. `Normal` logs packet names/sizes, while `Debug` also includes response/push content; changing `VerboseLevel` takes effect on the next server start.

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
|  |- pages/
|  |  |- index.html       Login page
|  |  |- dashboard.html   Dashboard template entry point
|  |  `- dashboard/       Feature panels, navigation, and modal templates
|  |- src/                Browser JavaScript and CSS
|  `- assets/             Static assets
|- .env.example           Configuration reference
`- quick_start.bat        Windows bootstrap and launcher
```

### Architecture

`backend.app.main` builds `Settings`, creates the FastAPI application, and calls `init_app`. The application mounts `/src` and `/assets`, serves `/login` and the authenticated dashboard at `/`, and registers API routes under `/api`.

The frontend is plain HTML, CSS, and ES modules. It requests `/api/app-info` at startup to determine whether server management is available, then only polls the active management page.

The dashboard is assembled on the backend with Jinja2 `{% include %}` directives before its JavaScript loads. `frontend/pages/dashboard.html` defines the page shell; `frontend/pages/dashboard/` contains `layout/`, `shared/`, `game-server-management/`, and `user-data-management/` templates, mirroring the JavaScript feature directories. Each feature owns its panel and modal files. Add panels to `user-data-management/index.html` and modals to `dashboard/modals.html`; preserve existing element IDs and `data-*` attributes when editing markup. Browser-facing URLs remain `/`, `/login`, `/src`, and `/assets`.

### Game Resource Tables

`backend/assets/EN/` and `backend/assets/CN/` contain independent TSV datasets. All APIs select the complete dataset using the request's `Accept-Language` header (`en-US` → EN, `zh-CN` → CN; default EN), including names, search, available IDs, and upgrade rules. Parsed and derived tables are cached independently in memory for each language. Changing the dashboard language reloads the page to refresh tables and discard old requests and dialog state.

#### Manual EN resource supplements (2026-10-24)

The EN dataset includes **74 manually supplemented records across 10 TSV tables**, based on the corresponding CN records. IDs, numeric values, references, and asset paths are preserved from CN. English text is manually translated using existing EN terminology, or reuses existing EN skill, coating, and nameplate text; these supplements are not an official upstream EN export.

| Supplement | EN tables | Records |
| --- | --- | --- |
| Kurumi Tokisaki (`1411003`) and Adelyde: Anabasis (`1421003`): S–SSS+ evolution and 14 promotion grades each | `CharacterQuality.tsv`, `CharacterGrade.tsv` | 8 + 28 |
| Zafkiel (`16420000`) and Kelpie (`16430000`): definitions, breakthrough, evolution, and skill bindings | `Partner.tsv`, `PartnerBreakThrough.tsv`, `PartnerQuality.tsv`, `PartnerSkill.tsv`, `PartnerMainSkillGroup.tsv`, `PartnerPassiveSkillGroup.tsv` | 34 |
| Scorching Torrent (`12530003`), Sacrament of Ruin (`12630002`), and Pale Pyre (`12690001`): functional coating definitions paired with existing EN display text | `WeaponFashion.tsv` | 3 |
| Nightshroud Covenant (`17064707`): nameplate definition using existing EN content-map text | `Nameplate.tsv` | 1 |

**Resource refreshes overwrite these manual supplements.** After refreshing, check whether upstream EN now provides these records; otherwise reapply the CN-based supplements and English translations. Restart the backend after updating tables to clear its in-memory caches. Validate both languages with `get_resource_issues()` from `backend.app.services.player.resource_validation`, and check that both characters have quality bounds `[3, 6]`, 14 promotion grades, and complete max templates, that both CUB max templates resolve, and that the coating/nameplate IDs remain selectable.

#### Refreshing resource tables

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
