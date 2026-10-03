@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing The Rake web dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)
start "The Rake Server" cmd /k "node server.js"
timeout /t 2 >nul
start "The Rake" http://localhost:3000
