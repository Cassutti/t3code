@echo off
REM ============================================================================
REM ZCode usage limits for T3 Code — full setup for a new PC.
REM Prerequisites: Git, Node.js >= 20, T3 Code (Beta) 0.1.9.x installed,
REM ZCode desktop installed and signed in with the promo account.
REM Run while T3 Code is CLOSED. Rollback: restore.cmd
REM ============================================================================
setlocal enabledelayedexpansion
set REPO=%~dp0..
set ADAPTER_DIR=%USERPROFILE%\zcode-acp-patched

echo [0/6] Checking prerequisites...
where git >nul 2>nul || (echo MISSING: git & exit /b 1)
node --version >nul 2>nul || (echo MISSING: Node.js & exit /b 1)
powershell -NoProfile -Command "exit (Test-Path '%LOCALAPPDATA%\Programs\t3code\T3 Code (Beta).exe') ? 0 : 1" || (
  echo T3 Code (Beta) not found in %LOCALAPPDATA%\Programs\t3code - set T3_RESOURCES manually & exit /b 1
)
powershell -NoProfile -Command "$v=(Get-Item '%LOCALAPPDATA%\Programs\t3code\T3 Code (Beta).exe').VersionInfo.ProductVersion; Write-Host ('T3 Code version: ' + $v); exit (($v -like '0.1.9*') ? 0 : 1)" || (
  echo This kit targets T3 0.1.9.x. Update the kit branch to match the installed release first. & exit /b 1
)
if not exist "%USERPROFILE%\.zcode\v2\credentials.json" (
  echo MISSING %USERPROFILE%\.zcode\v2\credentials.json - sign in to the ZCode desktop app first & exit /b 1
)
echo OK.

echo [1/6] ZCode ACP adapter (fork branch start-plan-quota)...
if exist "%ADAPTER_DIR%\package.json" (
  pushd "%ADAPTER_DIR%" && git pull --ff-only && popd
) else (
  git clone -b start-plan-quota https://github.com/Cassutti/zcode-acp.git "%ADAPTER_DIR%" || exit /b 1
)
pushd "%ADAPTER_DIR%"
call npm install --no-audit --no-fund >nul || (echo adapter npm install failed & popd & exit /b 1)
call npm run build || (echo adapter build failed & popd & exit /b 1)
popd
echo Adapter ready: %ADAPTER_DIR%\dist\cli.js

echo [2/6] T3 repo (fork branch zcode-usage-limits-rel)...
if not exist "%REPO%\.git" (
  echo this kit must live inside a clone of Cassutti/t3code on branch zcode-usage-limits-rel & exit /b 1
)
pushd "%REPO%"
git fetch origin 2>nul
git pull --ff-only 2>nul

echo [3/6] Installing workspace dependencies (pnpm, ~5 min)...
where pnpm >nul 2>nul || npm install -g pnpm@12.14.0 || exit /b 1
call pnpm install --config.engine-strict=false || exit /b 1

echo [4/6] Building the patched server bundle...
pushd apps\server
if exist dist rmdir /S /Q dist
call pnpm run build:bundle || (echo server build failed & popd & popd & exit /b 1)
popd

echo [5/6] Rebuilding server.asar (official base + patched dist overlay)...
node deploy\build-server-asar.cjs || exit /b 1

echo [6/6] Installing (backup + swap + provider rewiring)...
tasklist 2>nul | findstr /I "T3 Code (Beta).exe" >nul && (
  echo T3 Code is RUNNING. Close it completely, then run setup.cmd again.
  popd & exit /b 1
)
if not exist "%LOCALAPPDATA%\Programs\t3code\resources\server.asar.official.bak" (
  copy /Y "%LOCALAPPDATA%\Programs\t3code\resources\server.asar" "%LOCALAPPDATA%\Programs\t3code\resources\server.asar.official.bak" >nul || exit /b 1
  robocopy "%LOCALAPPDATA%\Programs\t3code\resources\server.asar.unpacked" "%LOCALAPPDATA%\Programs\t3code\resources\server.asar.unpacked.official.bak" /E /NFL /NDL /NJH /NJS >nul
)
copy /Y "%REPO%\.deploy-out\server.asar" "%LOCALAPPDATA%\Programs\t3code\resources\server.asar" >nul || exit /b 1
robocopy "%REPO%\.deploy-out\server.asar.unpacked" "%LOCALAPPDATA%\Programs\t3code\resources\server.asar.unpacked" /MIR /NFL /NDL /NJH /NJS >nul
node deploy\patch-t3-settings.cjs || exit /b 1
popd

echo.
echo DONE. Start T3 Code, then open Usage ^> Limits: the ZCode plan appears
echo after the first provider probe. Rollback anytime: deploy\restore.cmd
endlocal
