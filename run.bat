@echo off
title NITI - Voice-First Agricultural Platform
echo Starting NITI Whole Project (Backend + Frontend)...
python run.py
if errorlevel 1 (
    echo Python failed, trying uv run...
    uv run run.py
)
pause
