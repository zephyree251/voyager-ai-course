@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 20.12 or newer.
  pause
  exit /b 1
)
powershell.exe -NoProfile -Command "$secret = Read-Host 'Enter your model API key' -AsSecureString; if ($secret.Length -eq 0) { Write-Host 'An API key is required.'; exit 1 }; try { $env:AI_API_KEY = [System.Net.NetworkCredential]::new('', $secret).Password; & node.exe .\itinerary-api.js; exit $LASTEXITCODE } finally { Remove-Item Env:AI_API_KEY -ErrorAction SilentlyContinue; $secret.Dispose() }"
set "code=%errorlevel%"
if not "%code%"=="0" pause
exit /b %code%
