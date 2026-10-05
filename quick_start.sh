#!/bin/bash
set -euo pipefail

# Resolve the project directory even when invoked from another directory.
cd -- "$(dirname -- "$0")"

# Optional configuration (environment variables and CLI flags are supported).
# export ADMIN_USERNAME=admin
# export ADMIN_PASSWORD=password
# export APP_PORT=8001
# export MONGO_HOST=127.0.0.1
# export MONGO_PORT=27017
# export MONGO_DB=asc_net
# export ASCNET_LAUNCHER_PATH=/path/to/AscNetLauncher/local
# Launcher local builds are Windows-only; ordinary macOS database access works
# without enabling server process management.
export ENABLE_SERVER_MANAGEMENT="${ENABLE_SERVER_MANAGEMENT:-false}"

if [[ ! -f backend/requirements.txt ]]; then
    echo 'ERROR: backend/requirements.txt was not found.' >&2
    exit 1
fi

bootstrap_python=''
for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1 &&
       "$candidate" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 1)' >/dev/null 2>&1; then
        bootstrap_python="$candidate"
        break
    fi
done
if [[ -z "$bootstrap_python" ]]; then
    echo 'ERROR: Install Python 3.12 or newer and make python3 available on PATH.' >&2
    exit 1
fi

"$bootstrap_python" --version
if [[ ! -x .venv/bin/python ]]; then
    echo 'Creating virtual environment...'
    "$bootstrap_python" -m venv .venv
fi
echo 'Checking Python dependencies...'
.venv/bin/python -m pip install -r backend/requirements.txt
echo 'Starting PGR GM Tool...'
exec .venv/bin/python -m backend.app.main "$@"
