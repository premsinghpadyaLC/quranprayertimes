@echo off
setlocal
cd /d "%~dp0"
echo Quran for Everyone setup
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the current Node.js LTS version from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing project dependencies. This requires an internet connection...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)
echo Starting Quran for Everyone. Keep this window open.
call npm run dev -- --open
if errorlevel 1 pause
