# Starts the Expo dev server via a Cloudflare/Expo tunnel (not plain LAN) so
# the app loads on the phone from ANY network - different WiFi, 4G/5G, not
# just the same WiFi as this computer. Requires internet on both ends.
#
# Waits for start-backend.ps1's tunnel URL to be both PRESENT and VERIFIED
# healthy (not just "the file exists") before starting Metro, so the very
# first bundle Metro serves already has a working backend URL baked in
# (Constants.expoConfig.extra.backendTunnelUrl - see app.config.js / src/api.js).
#
# Uses the expo binary directly (node_modules\.bin\expo.cmd) instead of
# `npx expo start` - npx's own resolution step was observed to hang
# indefinitely with zero output in this environment during earlier testing,
# while calling the installed binary directly started normally every time.
#
# Kills whatever is already on port 8081 first - duplicate/stale Expo dev
# servers stepping on the same port is a recurring cause of "won't load".
# Confirmed the hard way: an invisible/background Expo process left running
# from an earlier session silently held port 8081, so a later run picked
# the next free port (8082) instead - the phone then had no way to guess
# which port to use, and every symptom (stuck "Opening project...", wrong
# manual URL, inconsistent QR) traced back to that one conflict.
#
# Runs Metro detached (Start-Process, same pattern as start-backend.ps1)
# instead of attached in the foreground, specifically so this script can
# poll Metro's own /status endpoint afterwards and print an explicit
# READY banner with the exact URL to use - "expo start printed some text"
# is not the same as "a phone can actually connect to it right now."

$existing = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    foreach ($conn in $existing) {
        Write-Host "Stopping existing process on port 8081 (PID $($conn.OwningProcess))..."
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
}

$tunnelUrlFile = "$PSScriptRoot\.backend-tunnel-url"

Write-Host "Waiting for a verified backend tunnel URL from start-backend.ps1 (run it first if this hangs)..."
$tunnelUrl = $null
for ($i = 0; $i -lt 40; $i++) {
    if (Test-Path $tunnelUrlFile) {
        $candidate = (Get-Content $tunnelUrlFile -Raw).Trim()
        if ($candidate) { $tunnelUrl = $candidate; break }
    }
    Start-Sleep -Seconds 1
}

if ($tunnelUrl) {
    # start-backend.ps1 only ever writes this file after confirming the URL
    # answers /api/health, but re-check here too in case time has passed
    # (this script may be run well after start-backend.ps1 finished) and the
    # tunnel has since died - this is exactly the failure mode that bit us
    # repeatedly before watch-backend.ps1 existed.
    try {
        $r = Invoke-WebRequest -Uri "$tunnelUrl/api/health" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq 200) {
            Write-Host "Backend confirmed reachable at: $tunnelUrl" -ForegroundColor Green
        } else {
            Write-Host "WARNING: $tunnelUrl responded but not with 200 - app may not work from other networks." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "WARNING: $tunnelUrl no longer responds (tunnel likely died since start-backend.ps1 ran)." -ForegroundColor Yellow
        Write-Host "Re-run start-backend.ps1 to get a fresh tunnel before relying on this from another network." -ForegroundColor Yellow
    }
} else {
    Write-Host "No backend tunnel URL found - app will only work on the same WiFi as this computer." -ForegroundColor Yellow
    Write-Host "Run start-backend.ps1 in another window if you need cross-network access." -ForegroundColor Yellow
}

Set-Location "C:\my-app"

$metroLog = "$PSScriptRoot\.metro.log"
$metroErrLog = "$PSScriptRoot\.metro-err.log"
Remove-Item $metroLog, $metroErrLog -ErrorAction SilentlyContinue

Write-Host "Starting Expo dev server on port 8081 (tunnel mode, detached) ..."
Start-Process -FilePath "$PSScriptRoot\node_modules\.bin\expo.cmd" `
    -ArgumentList "start", "--port", "8081", "--tunnel" `
    -WorkingDirectory "C:\my-app" `
    -RedirectStandardOutput $metroLog -RedirectStandardError $metroErrLog -WindowStyle Hidden

# ---------------------------------------------------------------------------
# Real readiness check: poll Metro's own /status endpoint (what Expo Go
# itself hits first) instead of just trusting that the process launched.
# ---------------------------------------------------------------------------
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

# The tunnel URL Expo assigns itself (via @expo/ngrok) shows up in its own
# startup log - pull it out and print it explicitly instead of making
# whoever's reading this window guess it from the (non-interactive, so no
# QR box) redirected log output.
$expoTunnelUrl = $null
$match = Select-String -Path $metroLog, $metroErrLog -Pattern "exp(s)?://[a-zA-Z0-9\-\.]+\.exp\.direct(:\d+)?" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($match) { $expoTunnelUrl = $match.Matches[0].Value }

Write-Host ""
if ($metroReady) {
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host " METRO IS READY" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green
    if ($lanIp) {
        Write-Host " Same WiFi as this PC -> in Expo Go, 'Enter URL manually':" -ForegroundColor Green
        Write-Host "   exp://${lanIp}:8081" -ForegroundColor Green
    }
    if ($expoTunnelUrl) {
        Write-Host " Different network (4G/other WiFi) -> use the tunnel URL:" -ForegroundColor Green
        Write-Host "   $expoTunnelUrl" -ForegroundColor Green
    } else {
        Write-Host " Tunnel URL not detected yet in the log - check $metroLog / $metroErrLog" -ForegroundColor Yellow
        Write-Host " if you need cross-network access and don't see it appear below." -ForegroundColor Yellow
    }
    Write-Host "================================================================" -ForegroundColor Green
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
