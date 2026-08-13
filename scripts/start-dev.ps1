$logDir = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

Start-Process -WindowStyle Hidden -FilePath 'powershell.exe' -ArgumentList @(
    '-NoProfile',
    '-Command',
    "Set-Location 'C:\backend'; php artisan serve *> '$logDir\backend.log' 2>&1"
)

Start-Process -WindowStyle Hidden -FilePath 'powershell.exe' -ArgumentList @(
    '-NoProfile',
    '-Command',
    "Set-Location 'c:\my-app'; npx expo start --web --port 19006 *> '$logDir\frontend.log' 2>&1"
)
