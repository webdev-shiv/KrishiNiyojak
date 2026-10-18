<#
.SYNOPSIS
    One-command startup script for the entire NITI platform on Windows PowerShell.

.DESCRIPTION
    Launches both the FastAPI backend (port 8000) and the React frontend (port 5173)
    concurrently using the unified Python runner 'run.py'.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "       NITI (नीति) - Whole Project Launcher               " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

$venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"

if (Test-Path $venvPython) {
    & $venvPython (Join-Path $PSScriptRoot "run.py")
} elseif (Get-Command "python" -ErrorAction SilentlyContinue) {
    & python (Join-Path $PSScriptRoot "run.py")
} elseif (Get-Command "py" -ErrorAction SilentlyContinue) {
    & py (Join-Path $PSScriptRoot "run.py")
} elseif (Get-Command "uv" -ErrorAction SilentlyContinue) {
    & uv run (Join-Path $PSScriptRoot "run.py")
} else {
    Write-Error "Python was not found on your system. Please install Python 3.12+ or uv."
}
