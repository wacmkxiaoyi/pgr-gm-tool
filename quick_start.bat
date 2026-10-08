@echo off
setlocal EnableExtensions
pushd "%~dp0"

rem Automatic Git updates (default true); timeout covers all Git operations in seconds.
set "AUTO_UPDATE=true"
set "AUTO_UPDATE_TIMEOUT=20"

rem Healthy check
rem set "HEALTHY_CHECK_INTERVAL=60"

rem Admin account: uncomment both lines to require login credentials.
rem set "ADMIN_USERNAME=admin"
rem set "ADMIN_PASSWORD=password"

rem Automatically use the local AscNet Launcher build when build-state.json exists.
rem set "ASCNET_LAUNCHER_PATH=%LOCALAPPDATA%\AscNetLauncher\local"

rem Set this to true to enable server management, including AscNet Launcher builds.
if not defined ENABLE_SERVER_MANAGEMENT set "ENABLE_SERVER_MANAGEMENT=false"

rem Optional GM web port (default 8000):
rem set "APP_PORT=8001"

rem To enable PGR server management, change the setting above to true and configure as needed:

rem From config.json
rem set "SERVER_PATH=C:\path\to\wacmk-pgr-server"
rem set "SERVER_BINARY_FILE=Wacmk.Pgr.Server.exe"

rem Alternative
rem set "SDK_SERVER_SCHEME=http"
rem set "SDK_SERVER_HOST=127.0.0.1"
rem set "SDK_SERVER_PORT=80"
rem set "GAME_SERVER_HOST=127.0.0.1"
rem set "GAME_SERVER_PORT=2335"

set "BOOTSTRAP_PY="
python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 1)" >nul 2>nul
if not errorlevel 1 set "BOOTSTRAP_PY=python"

if not defined BOOTSTRAP_PY (
    python3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 1)" >nul 2>nul
    if not errorlevel 1 set "BOOTSTRAP_PY=python3"
)

if not defined BOOTSTRAP_PY (
    echo ERROR: Python 3.12 or newer was not found as python or python3.
    echo Install Python and add it to PATH, then run this script again.
    goto :error
)

%BOOTSTRAP_PY% --version

if /i "%AUTO_UPDATE%"=="true" if not defined QUICK_START_UPDATED (
    set "QUICK_START_SCRIPT=%~f0"
    %BOOTSTRAP_PY% -c "import os; from pathlib import Path; exec(Path(os.environ['QUICK_START_SCRIPT']).read_text(encoding='utf-8').split('\n# QUICK_START_UPDATE_PYTHON\n', 1)[1])"
    if errorlevel 10 if not errorlevel 11 (
        set "QUICK_START_UPDATED=1"
        popd
        call "%~f0" %*
        call exit /b %%ERRORLEVEL%%
    )
)

if not exist "backend\requirements.txt" (
    echo ERROR: Project files are missing. Check Git/network access and rerun with AUTO_UPDATE=true.
    goto :error
)

if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment...
    %BOOTSTRAP_PY% -m venv ".venv"
    if errorlevel 1 (
        echo ERROR: Failed to create .venv.
        goto :error
    )
)

echo Checking Python dependencies...
".venv\Scripts\python.exe" -m pip install -r "backend\requirements.txt"
if errorlevel 1 (
    echo ERROR: Dependency installation failed.
    goto :error
)

echo.
echo Starting PGR GM Tool...
echo.
".venv\Scripts\python.exe" -m backend.app.main %*
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%

:error
pause
popd
exit /b 1

# QUICK_START_UPDATE_PYTHON
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
