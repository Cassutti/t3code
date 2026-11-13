@echo off
REM Restore the official T3 Code server and provider settings. T3 must be closed.
setlocal
set RES=%LOCALAPPDATA%\Programs\t3code\resources
if not exist "%RES%\server.asar.official.bak" (echo No backup found.& exit /b 1)
tasklist 2>nul | findstr /I "T3 Code (Beta).exe" >nul && (
  echo T3 Code is RUNNING. Close it completely, then run restore.cmd again.& exit /b 1
)
copy /Y "%RES%\server.asar.official.bak" "%RES%\server.asar" >nul
robocopy "%RES%\server.asar.unpacked.official.bak" "%RES%\server.asar.unpacked" /MIR /NFL /NDL /NJH /NJS >nul
if exist "%USERPROFILE%\.t3\userdata\settings.json.pre-zcode-patch.bak" (
  copy /Y "%USERPROFILE%\.t3\userdata\settings.json.pre-zcode-patch.bak" "%USERPROFILE%\.t3\userdata\settings.json" >nul
  echo ZCode provider settings restored from backup.
)
echo Official server restored.
endlocal
