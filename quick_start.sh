#!/bin/bash
set -euo pipefail

# Resolve the project directory even when invoked from another directory.
cd -- "$(dirname -- "$0")"
launcher_path="$PWD/$(basename -- "$0")"

# Automatic Git updates (default true); timeout covers all Git operations in seconds.
export AUTO_UPDATE="${AUTO_UPDATE:-true}"
export AUTO_UPDATE_TIMEOUT="${AUTO_UPDATE_TIMEOUT:-20}"
# export AUTO_UPDATE=false

# Load the launcher before updating files, then restart it when code changes.
main() {
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
if [[ ( "$AUTO_UPDATE" == true || "$AUTO_UPDATE" == TRUE ) && -z "${QUICK_START_UPDATED:-}" ]]; then
    update_status=0
    "$bootstrap_python" - <<'QUICK_START_UPDATE_PYTHON' || update_status=$?
import filecmp
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import time

def update():
    root = Path.cwd()
    try:
        timeout = float(os.environ.get('AUTO_UPDATE_TIMEOUT', '10'))
        if not 0 < timeout < float('inf'):
            raise ValueError
    except ValueError:
        print('WARNING: Invalid AUTO_UPDATE_TIMEOUT; using 10 seconds.', flush=True)
        timeout = 10
    if not shutil.which('git'):
        print('WARNING: Git is unavailable; continuing with local files.', flush=True)
        return 0
    deadline = time.monotonic() + timeout
    env = dict(os.environ, GIT_TERMINAL_PROMPT='0', GCM_INTERACTIVE='Never',
               GIT_SSH_COMMAND='ssh -o BatchMode=yes -o ConnectTimeout=5')

    def git(*args, cwd=root):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError
        options = {'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == 'nt' else {'start_new_session': True}
        process = subprocess.Popen(['git', *args], cwd=cwd, env=env,
                                   stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, **options)
        try:
            out, err = process.communicate(timeout=remaining)
        except subprocess.TimeoutExpired:
            if os.name == 'nt':
                subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
            else:
                os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=2)
            raise TimeoutError
        if process.returncode:
            raise RuntimeError(err.decode('utf-8', errors='replace').strip() or 'Git operation failed.')
        return out

    try:
        print(f'Checking Git updates (timeout {timeout:g}s)...', flush=True)
        if (root / '.git').exists():
            if git('status', '--porcelain').strip():
                print('WARNING: Local changes found; skipping automatic update.', flush=True)
                return 0
            git('rev-parse', '--abbrev-ref', '@{upstream}')
            before = git('rev-parse', 'HEAD')
            output = git('pull', '--ff-only')
            print(output.decode('utf-8', errors='replace').strip(), flush=True)
            return 10 if before != git('rev-parse', 'HEAD') else 0

        print('No .git found; downloading project...', flush=True)
        with tempfile.TemporaryDirectory(prefix='pgr-gm-update-') as temp:
            source = Path(temp) / 'repo'
            git('clone', '--depth', '1', 'https://github.com/wacmkxiaoyi/pgr-gm-tool.git', str(source))
            files = git('ls-files', '-z', cwd=source).decode('utf-8').split('\0')
            backup = root / '.quick-start-backups' / time.strftime('%Y%m%d-%H%M%S')
            backup = backup.with_name(backup.name + '-' + str(time.time_ns()))

            def preserve(path):
                target = backup / path.relative_to(root)
                target.parent.mkdir(parents=True, exist_ok=True)
                if path.is_dir() and not path.is_symlink():
                    shutil.copytree(path, target, symlinks=True)
                    shutil.rmtree(path)
                else:
                    shutil.copy2(path, target, follow_symlinks=False)
                    path.unlink()

            for name in filter(None, files):
                src, dst = source / name, root / name
                for parent in reversed(dst.parents):
                    if parent == root or root not in parent.parents:
                        continue
                    if parent.is_symlink() or (parent.exists() and not parent.is_dir()):
                        preserve(parent)
                    parent.mkdir(exist_ok=True)
                if dst.exists() or dst.is_symlink():
                    if not dst.is_symlink() and dst.is_file() and filecmp.cmp(src, dst, shallow=False):
                        continue
                    preserve(dst)
                shutil.copy2(src, dst)
            shutil.copytree(source / '.git', root / '.git')
            with (root / '.git' / 'info' / 'exclude').open('a', encoding='utf-8') as handle:
                handle.write('\n.quick-start-backups/\n')
            if backup.exists():
                print(f'Overwritten local files backed up to {backup}', flush=True)
            print('Project downloaded. Restarting with the updated launcher...', flush=True)
            return 10
    except (TimeoutError, subprocess.TimeoutExpired):
        print('WARNING: Git update timed out; continuing with local files.', flush=True)
    except (OSError, RuntimeError, subprocess.SubprocessError) as exc:
        print(f'WARNING: Git update failed: {exc}\nContinuing with local files.', flush=True)
    return 0

sys.exit(update())
QUICK_START_UPDATE_PYTHON
    if [[ "$update_status" == 10 ]]; then
        export QUICK_START_UPDATED=1
        exec bash "$launcher_path" "$@"
    fi
fi
if [[ ! -f backend/requirements.txt ]]; then
    echo 'ERROR: Project files are missing. Check Git/network access and rerun with AUTO_UPDATE=true.' >&2
    exit 1
fi

if [[ ! -x .venv/bin/python ]]; then
    echo 'Creating virtual environment...'
    "$bootstrap_python" -m venv .venv
fi
echo 'Checking Python dependencies...'
.venv/bin/python -m pip install -r backend/requirements.txt
echo 'Starting PGR GM Tool...'
exec .venv/bin/python -m backend.app.main "$@"
}

main "$@"
