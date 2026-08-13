# Starts the Expo dev server in plain LAN mode - no tunnel, no ngrok. Use
# this whenever the phone and this computer are on the SAME WiFi network,
# which is the common case during day-to-day development. It's faster and
# far more reliable than tunnel mode, since it doesn't depend on Expo's free
# ngrok-based tunnel service (which was observed to be flaky/slow on some
# networks - the phone's Expo Go client could reach it directly by IP,
# resolve it, and get HTTP 200 from this machine, yet still time out with
# "check your internet connectivity" when going through ngrok).
#
# For cross-network access (4G/5G, different WiFi than this PC), use
# start-app.ps1 or start-all.ps1 instead - those go through Cloudflare/ngrok
# tunnels on purpose because plain LAN mode cannot reach across networks.
#
# Backend note: this script does NOT start or touch the backend. If
# start-backend.ps1's Cloudflare tunnel is already up, the app keeps using
# it automatically (src/api.js prefers the tunnel URL when present). If it
# isn't, the app already falls back to this machine's LAN IP for API calls
# too (see src/api.js's LAN_BACKEND_HOST logic) - but the backend process
# itself still needs to be running locally either way. Run start-backend.ps1
# first if you haven't already this session.

$existing = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    foreach ($conn in $existing) {
        Write-Host "Stopping existing process on port 8081 (PID $($conn.OwningProcess))..."
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "== Checking local backend =="
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/health" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    if ($r.StatusCode -eq 200) {
        Write-Host "Backend is up locally on port 8000." -ForegroundColor Green
    } else {
        Write-Host "WARNING: backend responded but not with 200 - API calls may fail." -ForegroundColor Yellow
    }
} catch {
    Write-Host "WARNING: no backend answering on http://127.0.0.1:8000 - the app will load" -ForegroundColor Yellow
    Write-Host "but API calls (login, patients, etc) will fail. Run start-backend.ps1 first." -ForegroundColor Yellow
}

Set-Location "C:\my-app"

$metroLog = "$PSScriptRoot\.metro.log"
$metroErrLog = "$PSScriptRoot\.metro-err.log"
Remove-Item $metroLog, $metroErrLog -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "== Starting Expo dev server on port 8081 (LAN mode, detached) =="
Start-Process -FilePath "$PSScriptRoot\node_modules\.bin\expo.cmd" `
    -ArgumentList "start", "--port", "8081", "--lan" `
    -WorkingDirectory "C:\my-app" `
    -RedirectStandardOutput $metroLog -RedirectStandardError $metroErrLog -WindowStyle Hidden

Write-Host "Waiting for Metro bundler to actually accept connections..."
$metroReady = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:8081/status" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $metroReady = $true; break }
    } catch {
        # not up yet - keep polling silently until the deadline
    }
    Start-Sleep -Seconds 1
}

$lanIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL|VPN' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -First 1 -ExpandProperty IPAddress

Write-Host ""
if ($metroReady -and $lanIp) {
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host " METRO IS READY - phone must be on the SAME WiFi as this PC" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host " In Expo Go, tap 'Enter URL manually' and type:" -ForegroundColor Green
    Write-Host "   exp://${lanIp}:8081" -ForegroundColor Green
    Write-Host " (or scan the QR code that appears in the log below)" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green
} elseif ($metroReady) {
    Write-Host "READY, but could not detect this machine's LAN IP automatically." -ForegroundColor Yellow
    Write-Host "Run 'ipconfig' and use your WiFi adapter's IPv4 address instead." -ForegroundColor Yellow
} else {
    Write-Host "WARNING: Metro did not answer on port 8081 within 60s." -ForegroundColor Red
    Write-Host "Check $metroLog and $metroErrLog for errors (bundler crash, port conflict, etc)." -ForegroundColor Red
}

Write-Host ""
Write-Host "Metro runs detached - safe to close this window; app keeps running."
Write-Host "Errors (if any) go to: $metroErrLog"
Write-Host "Streaming its log below (Ctrl+C only stops watching, not the server):"
Write-Host ""
Get-Content -Path $metroLog -Wait -Tail 20
