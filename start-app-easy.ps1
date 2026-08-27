# ONE script to open the app - no manual steps, no flaky tunnel. Starts
# MySQL, the backend, and Metro (LAN mode) in the right order, actually
# verifies each one really works (not just "process exists"), and prints
# the single URL to paste into Expo Go at the end.
#
# Deliberately does NOT use the Cloudflare tunnel or watch-backend.ps1 - see
# 2026-08-27 postmortem: that combo caused hours of "works, then breaks again
# 60 seconds later" because free trycloudflare.com tunnels die on their own
# and the watcher kept replacing a working LAN setup with a fresh dead tunnel.
# This script always forces LAN-only mode, which only requires the phone and
# this PC to be on the same WiFi - true every time this has been tested.
#
# Run this every time after restarting the computer. Nothing here persists
# across a reboot (MySQL/backend/Metro are all plain processes).

$ErrorActionPreference = "Stop"
function Section($title) {
    Write-Host ""
    Write-Host "== $title ==" -ForegroundColor Cyan
}
function Ok($msg) { Write-Host "  OK: $msg" -ForegroundColor Green }
function Bad($msg) { Write-Host "  FAILED: $msg" -ForegroundColor Red }

# ---------------------------------------------------------------------------
# 1. MySQL (XAMPP, port 3307 - moved off 3306 because Docker Desktop/WSL
#    occupy 3306 on this machine)
# ---------------------------------------------------------------------------
Section "MySQL"
$mysqlUp = $false
try {
    $tcp = Test-NetConnection -ComputerName 127.0.0.1 -Port 3307 -WarningAction SilentlyContinue
    $mysqlUp = $tcp.TcpTestSucceeded
} catch { $mysqlUp = $false }

if ($mysqlUp) {
    Ok "already running on port 3307"
} else {
    Write-Host "  Starting XAMPP MySQL..."
    # .bat files can't be launched directly via Start-Process -FilePath here
    # (fails with "operation was canceled by the user") - route through cmd /c.
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "C:\xampp\mysql_start.bat" -WindowStyle Hidden
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline) {
        try {
            $tcp = Test-NetConnection -ComputerName 127.0.0.1 -Port 3307 -WarningAction SilentlyContinue
            if ($tcp.TcpTestSucceeded) { $mysqlUp = $true; break }
        } catch {}
        Start-Sleep -Seconds 1
    }
    if ($mysqlUp) { Ok "started" } else { Bad "did not come up within 30s - open C:\xampp\xampp-control.exe and start MySQL manually, then re-run this script" }
}

# ---------------------------------------------------------------------------
# 2. Backend (Laravel, bound to this machine's real LAN IP so phones can
#    reach it - not 0.0.0.0, matching the fix in start-backend.ps1)
# ---------------------------------------------------------------------------
Section "Backend"

$lanIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL|VPN' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -First 1 -ExpandProperty IPAddress
if (-not $lanIp) { $lanIp = '127.0.0.1' }

# Always start fresh - kills any stale/half-broken backend from a previous run.
$existing = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
foreach ($conn in $existing) { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue }
# Also make sure no stray Cloudflare tunnel or leftover tunnel-url file can
# poison the app into preferring a dead tunnel over this working LAN backend.
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Remove-Item "$PSScriptRoot\.backend-tunnel-url" -ErrorAction SilentlyContinue

$backendLog = "$PSScriptRoot\.backend-easy.log"
$backendErrLog = "$PSScriptRoot\.backend-easy-err.log"
Remove-Item $backendLog, $backendErrLog -ErrorAction SilentlyContinue
Start-Process -FilePath "php" -ArgumentList "artisan", "serve", "--host=$lanIp", "--port=8000" `
    -WorkingDirectory "C:\backend" -RedirectStandardOutput $backendLog -RedirectStandardError $backendErrLog -WindowStyle Hidden

$backendUp = $false
$deadline = (Get-Date).AddSeconds(30)
while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-WebRequest -Uri "http://${lanIp}:8000/api/health" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $backendUp = $true; break }
    } catch {}
    Start-Sleep -Seconds 1
}
if ($backendUp) { Ok "reachable at http://${lanIp}:8000" } else { Bad "did not answer within 20s - check $backendLog" }

# Real DB check, not just the DB-free /api/health - this is what actually
# broke silently before (health passed, login didn't, because the DB
# connection itself was pointed at the wrong MySQL).
$dbUp = $false
if ($backendUp) {
    try {
        $login = Invoke-WebRequest -Uri "http://${lanIp}:8000/api/login" -Method POST -TimeoutSec 5 -UseBasicParsing `
            -ContentType "application/json" -Headers @{ Accept = "application/json" } `
            -Body '{"username":"__healthcheck__","password":"__healthcheck__"}' -ErrorAction SilentlyContinue
    } catch {
        # A 401/422 response (wrong credentials) still proves the DB query itself
        # ran successfully - only a connection-level exception means the DB is down.
        if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -in 401, 422) { $dbUp = $true }
    }
    if ($login -and $login.StatusCode -in 200, 401, 422) { $dbUp = $true }
}
if ($dbUp) { Ok "database connection verified" } else { Bad "backend is up but database query failed - check MySQL is really on port 3307 and C:\backend\.env has DB_PORT=3307" }

# ---------------------------------------------------------------------------
# 3. Metro (Expo dev server, LAN mode)
# ---------------------------------------------------------------------------
Section "Metro (Expo)"

$existing = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
foreach ($conn in $existing) { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

$metroLog = "$PSScriptRoot\.metro-easy.log"
$metroErrLog = "$PSScriptRoot\.metro-easy-err.log"
Remove-Item $metroLog, $metroErrLog -ErrorAction SilentlyContinue
Start-Process -FilePath "$PSScriptRoot\node_modules\.bin\expo.cmd" `
    -ArgumentList "start", "--port", "8081", "--lan" `
    -WorkingDirectory "C:\my-app" `
    -RedirectStandardOutput $metroLog -RedirectStandardError $metroErrLog -WindowStyle Hidden

$metroUp = $false
$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:8081/status" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $metroUp = $true; break }
    } catch {}
    Start-Sleep -Seconds 1
}
if ($metroUp) { Ok "ready" } else { Bad "did not come up within 60s - check $metroLog" }

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
if ($mysqlUp -and $backendUp -and $dbUp -and $metroUp) {
    Write-Host " EVERYTHING IS READY" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host " Scan this in Expo Go (or tap 'Enter URL manually' and type the URL below):"
    Write-Host ""
    Push-Location $PSScriptRoot
    node -e "require('qrcode-terminal').generate('exp://${lanIp}:8081', {small: true}, (s) => console.log(s))"
    Pop-Location
    Write-Host ""
    Write-Host "   exp://${lanIp}:8081" -ForegroundColor Yellow
    Write-Host ""
    Write-Host " Test login: testnurse / password123"
} else {
    Write-Host " NOT FULLY READY - see FAILED lines above" -ForegroundColor Red
    Write-Host "================================================================" -ForegroundColor Red
}
Write-Host ""
Write-Host "All three processes run detached - closing this window is safe."
Write-Host "Logs: $backendLog , $metroLog"
