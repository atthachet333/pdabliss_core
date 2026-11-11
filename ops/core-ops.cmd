@echo off
rem PDA BLISS CORE operations (EP43). Usage: ops\core-ops.cmd ^<command^> [options]  (see ops\core-ops.mjs)
rem Runs from the repository root so relative env-file paths resolve. Starts or stops no service.
setlocal
cd /d "%~dp0.."
node "ops\core-ops.mjs" %*
exit /b %ERRORLEVEL%
