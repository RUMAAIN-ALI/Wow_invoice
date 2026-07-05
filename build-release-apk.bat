@echo off
setlocal

set SCRIPT_DIR=%~dp0
set APK_PATH=%SCRIPT_DIR%android\app\build\outputs\apk\release\app-release.apk

echo ============================================
echo Building arm64 release APK...
echo ============================================

cd /d "%SCRIPT_DIR%android"
call .\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a

if errorlevel 1 (
    echo.
    echo ============================================
    echo BUILD FAILED. See errors above.
    echo ============================================
    pause
    exit /b 1
)

echo.
echo ============================================
echo BUILD SUCCESSFUL
echo ============================================
echo APK: %APK_PATH%
echo.
echo To install on a connected device/emulator, run:
echo   adb install -r "%APK_PATH%"
echo ============================================
pause
