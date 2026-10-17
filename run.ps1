<#
.SYNOPSIS
    One-command startup script for Machine-Day Composer backend on Windows PowerShell.

.DESCRIPTION
    1. Verifies Python 3.12+ availability.
    2. Automatically creates the '.venv' virtual environment if missing.
    3. Verifies and installs project dependencies without redundant reinstalls.
    4. Checks for '.env' configuration, creating from template if missing (never overwriting existing).
    5. Displays operational endpoints and starts the Uvicorn development server.
#>

[CmdletBinding()]
param(
    [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

Write-Host '==========================================================' -ForegroundColor Green
Write-Host '       Machine-Day Composer - Backend Startup             ' -ForegroundColor Green
Write-Host '==========================================================' -ForegroundColor Green

# 1. Locate System Python
$pythonCmd = $null
if (Get-Command "python" -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command "py" -ErrorAction SilentlyContinue) {
    $pythonCmd = "py"
}

if (-not $pythonCmd) {
    Write-Error "Python 3.12+ was not found on your system PATH.`nPlease install Python 3.12 or newer from https://www.python.org/ or via 'winget install Python.Python.3.12'."
    exit 1
}

# Verify Python version (requires >= 3.12)
$pyVersionRaw = (& $pythonCmd -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')").Trim()
$versionParts = $pyVersionRaw.Split('.')
$pyMajor = [int]$versionParts[0]
$pyMinor = [int]$versionParts[1]

if ($pyMajor -lt 3 -or ($pyMajor -eq 3 -and $pyMinor -lt 12)) {
    Write-Error "Detected Python $pyVersionRaw. Machine-Day Composer requires Python 3.12 or newer."
    exit 1
}
Write-Host "[OK] Found system Python ($pyVersionRaw)" -ForegroundColor Green

# 2. Virtual Environment Verification & Creation
$venvDir = Join-Path $PSScriptRoot '.venv'
$venvPython = Join-Path $venvDir 'Scripts\python.exe'
$venvUvicorn = Join-Path $venvDir 'Scripts\uvicorn.exe'

if (-not (Test-Path $venvPython)) {
    Write-Host "[INFO] Creating virtual environment at '.venv'..." -ForegroundColor Cyan
    & $pythonCmd -m venv $venvDir
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create virtual environment."
        exit 1
    }
    Write-Host '[OK] Virtual environment created successfully.' -ForegroundColor Green
} else {
    Write-Host "[OK] Virtual environment found at '.venv'." -ForegroundColor Green
}

# 3. Dependency Check
Write-Host '[INFO] Checking project dependencies...' -ForegroundColor Cyan
$null = & $venvPython -c "import fastapi, uvicorn, pydantic, sqlalchemy, alembic, argon2, jwt, psycopg"
if ($LASTEXITCODE -ne 0) {
    Write-Host '[INFO] Installing project and dev dependencies (pip install -e .[dev])...' -ForegroundColor Cyan
    & $venvPython -m pip install -e ".[dev]"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install dependencies."
        exit 1
    }
    Write-Host '[OK] Dependencies installed.' -ForegroundColor Green
} else {
    Write-Host '[OK] All required dependencies are present.' -ForegroundColor Green
}

# 4. Configuration Check (.env)
$envFile = Join-Path $PSScriptRoot '.env'
$envExample = Join-Path $PSScriptRoot '.env.example'

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Write-Host "[NOTICE] '.env' not found. Creating default '.env' from '.env.example'..." -ForegroundColor Yellow
        Copy-Item $envExample $envFile
        Write-Host "[NOTICE] '.env' created with development placeholders." -ForegroundColor Yellow
        Write-Host "[NOTICE] To enable database features and run migrations, configure your Supabase DATABASE_URL in '.env'." -ForegroundColor Yellow
    } else {
        Write-Warning "Neither '.env' nor '.env.example' was found. Application will use built-in defaults."
    }
} else {
    Write-Host "[OK] Configuration file '.env' detected (preserved without modification)." -ForegroundColor Green
}

# 5. Application Startup Summary
Write-Host ''
Write-Host '----------------------------------------------------------' -ForegroundColor DarkGray
Write-Host ' Ready to launch Machine-Day Composer' -ForegroundColor Cyan
Write-Host ' - Swagger API Docs: http://127.0.0.1:8000/docs' -ForegroundColor White
Write-Host ' - ReDoc API Docs:   http://127.0.0.1:8000/redoc' -ForegroundColor White
Write-Host ' - Health Check:     http://127.0.0.1:8000/health' -ForegroundColor White
Write-Host ' - Database Status:  Configured via DATABASE_URL in .env' -ForegroundColor White
Write-Host '                     (Health check and docs work independently of DB)' -ForegroundColor DarkGray
Write-Host '----------------------------------------------------------' -ForegroundColor DarkGray
Write-Host ''

# 6. Verify or start the server
if ($CheckOnly) {
    Write-Host '[OK] Verification complete. Application imports and configuration are ready.' -ForegroundColor Green
    exit 0
}

# Start the FastAPI development server
& $venvUvicorn app.main:app --reload --host 127.0.0.1 --port 8000
