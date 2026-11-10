@echo off
setlocal
title GitHub Auto Upload

REM This BAT file should be placed in your project folder.
cd /d "%~dp0"

echo.
echo ==========================================
echo       GitHub Auto Upload
echo ==========================================
echo.

where git >nul 2>nul
if errorlevel 1 (
    echo ERROR: Git is not installed or not added to PATH.
    echo Install Git for Windows, then run this file again.
    pause
    exit /b 1
)

if not exist ".git" (
    echo Initializing Git repository...
    git init
    if errorlevel 1 goto :error
)

REM Keep the local branch named main.
git branch -M main
if errorlevel 1 goto :error

REM Set the GitHub remote, or add it if missing.
git remote get-url origin >nul 2>nul
if errorlevel 1 (
    git remote add origin "https://github.com/osthirfapor/og-x-o7-free-fire-scrims-management.git"
) else (
    git remote set-url origin "https://github.com/osthirfapor/og-x-o7-free-fire-scrims-management.git"
)
if errorlevel 1 goto :error

echo.
echo Checking files...
git add -A
if errorlevel 1 goto :error

git diff --cached --quiet
if not errorlevel 1 (
    echo No new changes to upload.
    echo.
    git push -u origin main
    if errorlevel 1 goto :error
    echo.
    echo GitHub is up to date.
    pause
    exit /b 0
)

for /f "tokens=1-3 delims=/- " %%a in ("%date%") do set TODAY=%%a-%%b-%%c
for /f "tokens=1-2 delims=:." %%a in ("%time%") do set NOW=%%a-%%b
set NOW=%NOW: =0%

echo Creating commit...
git commit -m "Auto upload %date% %time%"
if errorlevel 1 goto :error

echo.
echo Uploading to GitHub...
git push -u origin main
if errorlevel 1 goto :error

echo.
echo ==========================================
echo       Upload completed successfully!
echo ==========================================
pause
exit /b 0

:error
echo.
echo ERROR: Upload did not complete.
echo Check the message above. You may need to sign in to GitHub,
echo resolve a merge conflict, or check your internet connection.
echo.
pause
exit /b 1
