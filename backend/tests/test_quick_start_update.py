"""Exercise both embedded bootstrappers without contacting GitHub."""

import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

import pytest


ROOT = Path(__file__).resolve().parents[2]
REPOSITORY = "https://github.com/wacmkxiaoyi/pgr-gm-tool.git"


def embedded_python(script):
    text = (ROOT / script).read_text(encoding="utf-8")
    if script.endswith(".bat"):
        return text.split("\n# QUICK_START_UPDATE_PYTHON\n", 1)[1]
    return text.split("<<'QUICK_START_UPDATE_PYTHON' || update_status=$?\n", 1)[1].split(
        "\nQUICK_START_UPDATE_PYTHON\n", 1
    )[0]


@pytest.fixture(params=["quick_start.bat", "quick_start.sh"])
def updater(request):
    namespace = {}
    exec(embedded_python(request.param).rsplit("sys.exit(update())", 1)[0], namespace)
    return namespace["update"]


def git(cwd, *args):
    return subprocess.run(
        ["git", *args], cwd=cwd, check=True, capture_output=True
    ).stdout


@pytest.fixture
def remote(tmp_path):
    source = tmp_path / "source"
    source.mkdir()
    git(source, "init")
    (source / "backend").mkdir()
    (source / "backend" / "requirements.txt").write_text("", encoding="utf-8")
    (source / "quick_start.bat").write_text("updated launcher\n", encoding="utf-8")
    (source / ".gitignore").write_text(".env\n.venv/\n", encoding="utf-8")
    git(source, "add", ".")
    git(source, "-c", "user.name=Test", "-c", "user.email=test@example.invalid",
        "commit", "-m", "Fixture")
    return source


def test_first_download_backs_up_conflicts_and_preserves_extras(
    updater, remote, tmp_path, monkeypatch, capsys
):
    target = tmp_path / "download"
    target.mkdir()
    (target / "quick_start.bat").write_text("original launcher", encoding="utf-8")
    # A file conflicting with a directory is backed up too.
    (target / "backend").write_text("local backend file", encoding="utf-8")
    (target / ".env").write_text("local settings", encoding="utf-8")
    (target / ".venv").mkdir()
    (target / ".venv" / "keep").write_text("keep", encoding="utf-8")
    real_popen = subprocess.Popen

    def local_clone(args, **kwargs):
        if args[1] == "clone":
            assert args[4] == REPOSITORY
            args = [*args[:4], remote.as_uri(), *args[5:]]
        return real_popen(args, **kwargs)

    monkeypatch.setattr(subprocess, "Popen", local_clone)
    monkeypatch.chdir(target)
    assert updater() == 10
    assert (target / ".git").is_dir()
    assert (target / "backend" / "requirements.txt").is_file()
    assert (target / ".env").read_text() == "local settings"
    assert (target / ".venv" / "keep").read_text() == "keep"
    backup = next((target / ".quick-start-backups").iterdir())
    assert (backup / "quick_start.bat").read_text() == "original launcher"
    assert (backup / "backend").read_text() == "local backend file"
    assert not git(target, "status", "--porcelain").strip()
    assert "backed up" in capsys.readouterr().out
    assert updater() == 0


def test_existing_repository_pulls_then_skips_local_changes(
    updater, remote, tmp_path, monkeypatch, capsys
):
    target = tmp_path / "checkout"
    git(tmp_path, "clone", str(remote), str(target))
    (remote / "new.txt").write_text("remote change", encoding="utf-8")
    git(remote, "add", ".")
    git(remote, "-c", "user.name=Test", "-c", "user.email=test@example.invalid",
        "commit", "-m", "Update fixture")
    monkeypatch.chdir(target)
    assert updater() == 10
    assert (target / "new.txt").read_text() == "remote change"
    assert updater() == 0
    (target / "new.txt").write_text("local change", encoding="utf-8")
    assert updater() == 0
    assert "Local changes found" in capsys.readouterr().out
    assert (target / "new.txt").read_text() == "local change"


def test_missing_upstream_continues(updater, remote, monkeypatch, capsys):
    monkeypatch.chdir(remote)
    assert updater() == 0
    assert "Git update failed" in capsys.readouterr().out


def test_missing_git_continues(updater, tmp_path, monkeypatch, capsys):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(shutil, "which", lambda _: None)
    assert updater() == 0
    assert "Git is unavailable" in capsys.readouterr().out


def test_clone_failure_does_not_overwrite(updater, tmp_path, monkeypatch, capsys):
    monkeypatch.chdir(tmp_path)
    original = tmp_path / "quick_start.bat"
    original.write_text("original", encoding="utf-8")
    real_popen = subprocess.Popen
    monkeypatch.setattr(
        subprocess, "Popen",
        lambda args, **kwargs: real_popen([sys.executable, "-c", "raise SystemExit(1)"], **kwargs),
    )
    assert updater() == 0
    assert original.read_text() == "original"
    assert not (tmp_path / ".git").exists()
    assert "Git update failed" in capsys.readouterr().out


def test_timeout_kills_git_and_child(updater, tmp_path, monkeypatch, capsys):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("AUTO_UPDATE_TIMEOUT", "0.5")
    real_popen = subprocess.Popen
    processes = []
    child_code = "import time; time.sleep(30)"
    code = (
        "import subprocess, sys, time; "
        f"p = subprocess.Popen([sys.executable, '-c', {child_code!r}]); "
        "print(p.pid, flush=True); time.sleep(30)"
    )

    def stalled_git(args, **kwargs):
        process = real_popen([sys.executable, "-c", code], **kwargs)
        processes.append(process)
        return process

    monkeypatch.setattr(subprocess, "Popen", stalled_git)
    # taskkill must still launch normally.
    def dispatch(args, **kwargs):
        return real_popen(args, **kwargs) if args[0] == "taskkill" else stalled_git(args, **kwargs)

    monkeypatch.setattr(subprocess, "Popen", dispatch)
    start = time.monotonic()
    assert updater() == 0
    assert time.monotonic() - start < 4
    assert processes[0].poll() is not None
    # A surviving child would keep this pipe open until its 30-second sleep ends.
    output, _ = processes[0].communicate(timeout=1)
    assert output.strip().isdigit()
    assert not (tmp_path / ".git").exists()
    assert "timed out" in capsys.readouterr().out


def launcher_command(script, target):
    if script.endswith(".bat"):
        if os.name != "nt":
            pytest.skip("Windows batch script")
        return [os.environ["COMSPEC"], "/d", "/c", str(target)]
    else:
        if os.name == "nt":
            bash = Path(shutil.which("git")).parents[1] / "bin" / "bash.exe"
        else:
            bash = shutil.which("bash")
        if not bash or not Path(bash).exists():
            pytest.skip("Bash not installed")
        return [str(bash), str(target)]


@pytest.mark.parametrize("script", ["quick_start.bat", "quick_start.sh"])
@pytest.mark.parametrize("enabled", [False, True])
def test_launcher_reports_missing_code_and_respects_switch(script, enabled, tmp_path):
    target = tmp_path / script
    shutil.copy2(ROOT / script, target)
    if enabled:
        git(tmp_path, "init")  # Untracked launcher causes an offline skip.
    result = subprocess.run(
        launcher_command(script, target),
        env=dict(os.environ, AUTO_UPDATE="true" if enabled else "false"), cwd=ROOT,
        stdin=subprocess.DEVNULL, capture_output=True, timeout=15,
    )
    assert result.returncode == 1, result.stderr.decode(errors="replace")
    assert b"Project files are missing" in result.stdout + result.stderr
    assert (b"Checking Git updates" in result.stdout + result.stderr) == enabled


@pytest.mark.parametrize("script", ["quick_start.bat", "quick_start.sh"])
def test_standalone_launcher_restarts_updated_script_and_forwards_arguments(
    script, remote, tmp_path
):
    target_dir = tmp_path / "standalone"
    target_dir.mkdir()
    target = target_dir / script
    shutil.copy2(ROOT / script, target)
    replacement = (
        '@echo off\necho UPDATED %QUICK_START_UPDATED% %*\nexit /b 23\n'
        if script.endswith(".bat") else
        '#!/bin/bash\nprintf "UPDATED %s %s\\n" "$QUICK_START_UPDATED" "$*"\nexit 23\n'
    )
    (remote / script).write_text(replacement, encoding="utf-8")
    git(remote, "add", ".")
    git(remote, "-c", "user.name=Test", "-c", "user.email=test@example.invalid",
        "commit", "-m", "Replace launcher")
    result = subprocess.run(
        [*launcher_command(script, target), "--APP_PORT", "8001"], cwd=ROOT,
        env=dict(os.environ, AUTO_UPDATE="true", AUTO_UPDATE_TIMEOUT="10",
                 GIT_CONFIG_COUNT="1", GIT_CONFIG_KEY_0=f"url.{remote.as_uri()}.insteadOf",
                 GIT_CONFIG_VALUE_0=REPOSITORY),
        stdin=subprocess.DEVNULL, capture_output=True, timeout=15,
    )
    assert result.returncode == 23, (result.stdout, result.stderr)
    assert b"UPDATED 1 --APP_PORT 8001" in result.stdout
    assert (target_dir / ".git").is_dir()
