#!/usr/bin/env python3
"""
NITI (नीति) — All-in-One Application Runner
Runs both the FastAPI backend and React frontend concurrently with a single command.

Usage:
    python run.py
    or
    uv run run.py
    or
    .\\run.ps1
    or
    .\\run.bat
    or
    npm start (from root)
"""

import os
import sys
import subprocess
import threading
import signal
import time
import socket
from pathlib import Path

# Safe UTF-8 reconfiguration for Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT_DIR / "frontend"
VENV_DIR = ROOT_DIR / ".venv"

# Detect Python interpreter
if os.name == "nt":
    VENV_PYTHON = VENV_DIR / "Scripts" / "python.exe"
    VENV_UVICORN = VENV_DIR / "Scripts" / "uvicorn.exe"
    NPM_CMD = "npm.cmd"
else:
    VENV_PYTHON = VENV_DIR / "bin" / "python"
    VENV_UVICORN = VENV_DIR / "bin" / "uvicorn"
    NPM_CMD = "npm"

PYTHON_EXE = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable
UVICORN_EXE = str(VENV_UVICORN) if VENV_UVICORN.exists() else "uvicorn"

processes = []


def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def log_stream(proc, prefix, color_code):
    """Reads stdout/stderr from process and prefixes output."""
    reset = "\033[0m"
    try:
        for line in iter(proc.stdout.readline, ''):
            if not line:
                break
            print(f"{color_code}[{prefix}]{reset} {line.rstrip()}", flush=True)
    except Exception:
        pass


def kill_all_processes():
    print("\n\033[1;33m[NITI] Shutting down all services gracefully...\033[0m")
    for p in processes:
        try:
            if os.name == "nt":
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(p.pid)],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                p.terminate()
                p.kill()
        except Exception:
            pass
    print("\033[1;32m[NITI] All services stopped. Goodbye!\033[0m")


def signal_handler(sig, frame):
    kill_all_processes()
    sys.exit(0)


def check_prerequisites():
    print("\033[1;32m" + "=" * 62 + "\033[0m")
    print("\033[1;32m       NITI - Voice-First Agri Machinery Platform             \033[0m")
    print("\033[1;32m" + "=" * 62 + "\033[0m")

    # 1. Check frontend dependencies
    node_modules = FRONTEND_DIR / "node_modules"
    if not node_modules.exists():
        print("\033[1;36m[SETUP] Installing frontend node dependencies (npm install)...\033[0m")
        subprocess.run([NPM_CMD, "install"], cwd=str(FRONTEND_DIR), check=True, shell=(os.name == "nt"))

    # 2. Check ports
    if is_port_in_use(8000):
        print("\033[1;33m[WARNING] Port 8000 is currently in use. Existing backend may be running.\033[0m")
    if is_port_in_use(5173):
        print("\033[1;33m[WARNING] Port 5173 is currently in use. Vite will use another port.\033[0m")


def main():
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    check_prerequisites()

    print("\n\033[1;35m[NITI] Starting Backend & Frontend concurrently...\033[0m\n")

    # 1. Start Backend FastAPI via Uvicorn
    backend_cmd = [
        PYTHON_EXE, "-m", "uvicorn", "app.main:app",
        "--host", "127.0.0.1",
        "--port", "8000",
        "--reload"
    ]

    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=str(ROOT_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        encoding="utf-8",
        errors="replace"
    )
    processes.append(backend_proc)

    backend_thread = threading.Thread(
        target=log_stream,
        args=(backend_proc, "NITI Backend", "\033[1;32m"),
        daemon=True
    )
    backend_thread.start()

    # 2. Start Frontend Vite Dev Server
    frontend_cmd = [NPM_CMD, "run", "dev"]
    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=str(FRONTEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        encoding="utf-8",
        errors="replace",
        shell=(os.name == "nt")
    )
    processes.append(frontend_proc)

    frontend_thread = threading.Thread(
        target=log_stream,
        args=(frontend_proc, "NITI Frontend", "\033[1;36m"),
        daemon=True
    )
    frontend_thread.start()

    time.sleep(2)

    # Print summary dashboard banner
    print("\n\033[1;32m" + "-" * 62 + "\033[0m")
    print("\033[1;32m  NITI IS LIVE & RUNNING!\033[0m")
    print("  \033[1m* Web Application (UI):\033[0m    http://localhost:5173")
    print("  \033[1m* FastAPI Backend API:\033[0m     http://127.0.0.1:8000")
    print("  \033[1m* Swagger API Docs:\033[0m         http://127.0.0.1:8000/docs")
    print("  \033[1m* Health Check:\033[0m             http://127.0.0.1:8000/health")
    print("\033[1;32m" + "-" * 62 + "\033[0m")
    print("\033[1;37m  Demo Accounts (1-Click or OTP: 123456):\033[0m")
    print("   * Farmer:    +919876543210 (farmer@niti.org / Farmer@123)")
    print("   * CHC Hub:   +919876543211 (chc@niti.org / Manager@123)")
    print("   * Operator:  +919876543212 (operator@niti.org / Operator@123)")
    print("\033[1;32m" + "-" * 62 + "\033[0m")
    print("  Press Ctrl+C anytime to stop both servers.\n")

    try:
        while True:
            for p in processes:
                ret = p.poll()
                if ret is not None:
                    print(f"\n\033[1;31m[NITI] Service exited with code {ret}.\033[0m")
                    kill_all_processes()
                    sys.exit(ret)
            time.sleep(1)
    except KeyboardInterrupt:
        kill_all_processes()


if __name__ == "__main__":
    main()
