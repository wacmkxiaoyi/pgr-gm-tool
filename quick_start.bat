@echo off
setlocal EnableExtensions
pushd "%~dp0"

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

if not exist "backend\requirements.txt" (
    echo ERROR: backend\requirements.txt was not found.
    goto :error
)

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
