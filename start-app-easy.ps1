# ONE script to open the app - no manual steps. Starts MySQL, the backend,
# and Metro, and brings up BOTH access paths every time: the direct LAN
# address (same WiFi, fastest) AND a public tunnel (works from any network,
# survives a router that blocks devices from talking to each other).
#
# Why both, always: whether the LAN path actually reaches a given phone can't
# be verified from this PC alone - every self-check here (curl, Test-NetConnection)
# succeeds even when a phone on the exact same WiFi genuinely can't connect,
# because this machine's own loopback/LAN-hairpin routing never actually
# exercises the real WiFi radio or the router's client-isolation setting the
# way a second physical device does. Confirmed the hard way on 2026-08-27:
# LAN mode reported fully healthy while an iPhone on the identical SSID
# ("Peck_5G 2") got nothing - the router was silently blocking device-to-
# device traffic. There is no reliable way to auto-detect that from here, so
# this script stopped pretending it could and now just hands over both URLs.
#
# 2026-08-27 postmortem (superseded): this script used to force LAN-only and
# deliberately avoid tunnels, because the free trycloudflare.com/ngrok tunnels
# used to die on their own mid-session. That's still true for Cloudflare's
# free quick tunnels (which is why the backend tunnel here is best-effort,
# not required for the script to report ready) - but the Expo/Metro tunnel
# failure that made tunneling look broken back then was actually a different,
# permanent bug: the ngrok binary Expo bundles (v2.3.41) has no working
# server-side backend anymore. That's fixed here by authenticating it with a
# free ngrok account's authtoken (`ngrok authtoken <token>`, already saved to
# this machine's ngrok config) - without that token, the tunnel step below
# will fail cleanly and the script still reports LAN as ready.
#
# Run this every time after restarting the computer. Nothing here persists
# across a reboot (MySQL/backend/Metro/tunnels are all plain processes).

$ErrorActionPreference = "Stop"
function Section($title) {
    Write-Host ""
    Write-Host "== $title ==" -ForegroundColor Cyan
}
function Ok($msg) { Write-Host "  OK: $msg" -ForegroundColor Green }
function Bad($msg) { Write-Host "  FAILED: $msg" -ForegroundColor Red }
function Info($msg) { Write-Host "  $msg" -ForegroundColor Yellow }

$lanIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL|VPN' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -First 1 -ExpandProperty IPAddress
if (-not $lanIp) { $lanIp = '127.0.0.1' }

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
#    reach it directly) + best-effort Cloudflare tunnel so it's ALSO reachable
#    from any network. Tunnel failing does not fail this step - LAN still works.
# ---------------------------------------------------------------------------
Section "Backend"

$existing = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
foreach ($conn in $existing) { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue }
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

$backendLog = "$PSScriptRoot\.backend-easy.log"
$backendErrLog = "$PSScriptRoot\.backend-easy-err.log"
$tunnelUrlFile = "$PSScriptRoot\.backend-tunnel-url"
Remove-Item $backendLog, $backendErrLog, $tunnelUrlFile -ErrorAction SilentlyContinue

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
if ($backendUp) { Ok "reachable on LAN at http://${lanIp}:8000" } else { Bad "did not answer within 30s - check $backendLog" }

$dbUp = $false
if ($backendUp) {
    try {
        $login = Invoke-WebRequest -Uri "http://${lanIp}:8000/api/login" -Method POST -TimeoutSec 5 -UseBasicParsing `
            -ContentType "application/json" -Headers @{ Accept = "application/json" } `
            -Body '{"username":"__healthcheck__","password":"__healthcheck__"}' -ErrorAction SilentlyContinue
    } catch {
        if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -in 401, 422) { $dbUp = $true }
    }
    if ($login -and $login.StatusCode -in 200, 401, 422) { $dbUp = $true }
}
if ($dbUp) { Ok "database connection verified" } else { Bad "backend is up but database query failed - check MySQL is really on port 3307 and C:\backend\.env has DB_PORT=3307" }

# Best-effort backend tunnel via ngrok v3 - failure here just means no off-LAN
# API access this run, not a script failure. src/api.js automatically prefers
# this tunnel URL over the LAN one whenever it's present (see .backend-tunnel-url).
#
# 2026-08-28: switched from Cloudflare (trycloudflare.com) to ngrok
# (ngrok-free.dev) here - confirmed on this network specifically that
# trycloudflare.com is unreachable (DNS never resolves it, even though the
# tunnel itself was verified genuinely healthy via its raw IP) while
# ngrok-free.dev works fine. Uses its own ngrok binary + config file
# (ngrok-v3\ngrok.exe, .ngrok-v3-config.yml) separate from the older ngrok
# agent Expo's --tunnel mode uses for Metro below - sharing one config file
# between the two caused the older agent to lose its session entirely.
$backendTunnelUrl = $null
if ($backendUp) {
    $ngrokV3Exe = "$PSScriptRoot\ngrok-v3\ngrok.exe"
    $ngrokV3Config = "$PSScriptRoot\.ngrok-v3-config.yml"
    $backendNgrokLog = "$PSScriptRoot\.backend-ngrok.log"
    Remove-Item $backendNgrokLog -ErrorAction SilentlyContinue
    Get-Process ngrok -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $ngrokV3Exe } | Stop-Process -Force -ErrorAction SilentlyContinue

    if (-not (Test-Path $ngrokV3Exe)) {
        Info "ngrok-v3\ngrok.exe not found - off-LAN backend access unavailable this run (LAN still works)."
        Info "See the chat history for how this was set up (download + Windows Defender exclusion + authtoken)."
    } elseif (-not (Test-Path $ngrokV3Config)) {
        Info "$ngrokV3Config not found (no saved authtoken) - off-LAN backend access unavailable this run (LAN still works)."
    } else {
        # No --web-addr flag exists in this ngrok version to pin its local
        # inspection API to a fixed port - it always tries 4040 first, and
        # since Metro's own (older, separate) ngrok agent below already owns
        # 4040, this one prints a warning and falls back to 4041. Confirmed
        # via its own log output rather than assumed, in case a future ngrok
        # version picks something else.
        Start-Process -FilePath $ngrokV3Exe `
            -ArgumentList "http", "${lanIp}:8000", "--config", $ngrokV3Config, "--log=stdout" `
            -RedirectStandardOutput $backendNgrokLog -WindowStyle Hidden

        $webApiPort = $null
        $deadline = (Get-Date).AddSeconds(10)
        while ((Get-Date) -lt $deadline) {
            $match = Select-String -Path $backendNgrokLog -Pattern 'starting web service.*addr=127\.0\.0\.1:(\d+)' -ErrorAction SilentlyContinue | Select-Object -Last 1
            if ($match) { $webApiPort = $match.Matches[0].Groups[1].Value; break }
            Start-Sleep -Milliseconds 500
        }
        if (-not $webApiPort) { $webApiPort = 4041 }

        $rawTunnelUrl = $null
        $deadline = (Get-Date).AddSeconds(15)
        while ((Get-Date) -lt $deadline) {
            try {
                $tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:${webApiPort}/api/tunnels" -TimeoutSec 3 -ErrorAction Stop
                $httpsTunnel = $tunnels.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1
                if ($httpsTunnel) { $rawTunnelUrl = $httpsTunnel.public_url; break }
            } catch {}
            Start-Sleep -Seconds 1
        }

        if ($rawTunnelUrl) {
            # Free ngrok tunnels have been observed taking up to ~15s to
            # actually pass traffic even after being assigned a URL - give
            # this more room than the equivalent Cloudflare check needed.
            $tunnelHealthy = $false
            $deadline = (Get-Date).AddSeconds(30)
            while ((Get-Date) -lt $deadline) {
                try {
                    $r = Invoke-WebRequest -Uri "$rawTunnelUrl/api/health" -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
                    if ($r.StatusCode -eq 200) { $tunnelHealthy = $true; break }
                } catch {}
                Start-Sleep -Seconds 1
            }
            if ($tunnelHealthy) {
                Set-Content -Path $tunnelUrlFile -Value $rawTunnelUrl -NoNewline
                $backendTunnelUrl = $rawTunnelUrl
                Ok "also reachable from any network at $rawTunnelUrl"
            } else {
                Info "tunnel URL assigned but did not answer within 30s - off-LAN backend access unavailable this run (LAN still works)"
            }
        } else {
            Info "ngrok did not assign a tunnel URL within 20s - check $backendNgrokLog - off-LAN backend access unavailable this run (LAN still works)"
        }
    }
}

# ---------------------------------------------------------------------------
# 3. Metro (Expo dev server) in --tunnel mode. This still serves the LAN IP
#    directly too (confirmed: a single Metro process answers both its LAN IP
#    and its ngrok tunnel URL at once) - so this one process covers both
#    access paths, no need to run it twice.
# ---------------------------------------------------------------------------
Section "Metro (Expo)"

$existing = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
foreach ($conn in $existing) { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

$metroLog = "$PSScriptRoot\.metro-easy.log"
$metroErrLog = "$PSScriptRoot\.metro-easy-err.log"
Remove-Item $metroLog, $metroErrLog -ErrorAction SilentlyContinue
Start-Process -FilePath "$PSScriptRoot\node_modules\.bin\expo.cmd" `
    -ArgumentList "start", "--port", "8081", "--tunnel" `
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
if ($metroUp) { Ok "ready on LAN at http://${lanIp}:8081" } else { Bad "did not come up within 90s - check $metroLog" }

# Ask ngrok's own local API for the public URL it assigned (more reliable
# than grepping Metro's log - the log doesn't always contain the printed URL
# text when output is redirected instead of an interactive terminal).
$expoTunnelUrl = $null
if ($metroUp) {
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline) {
        try {
            $tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 3 -ErrorAction Stop
            $httpsTunnel = $tunnels.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1
            if ($httpsTunnel) {
                $expoTunnelUrl = $httpsTunnel.public_url -replace '^https://', 'exp://'
                break
            }
        } catch {}
        Start-Sleep -Seconds 1
    }
    if ($expoTunnelUrl) {
        Ok "also reachable from any network at $expoTunnelUrl"
    } else {
        Info "Expo tunnel did not come up - off-LAN app access unavailable this run (LAN still works)."
        Info "If this keeps happening, run: $PSScriptRoot\node_modules\@expo\ngrok-bin-win32-x64\ngrok.exe authtoken <your-free-ngrok-authtoken>"
    }
}

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
if ($mysqlUp -and $backendUp -and $dbUp -and $metroUp) {
    Write-Host " EVERYTHING IS READY" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green

    Write-Host ""
    Write-Host " 1) TRY THIS FIRST (phone must be on the same WiFi as this PC):" -ForegroundColor Green
    Push-Location $PSScriptRoot
    node -e "require('qrcode-terminal').generate('exp://${lanIp}:8081', {small: true}, (s) => console.log(s))"
    Pop-Location
    Write-Host "   exp://${lanIp}:8081" -ForegroundColor Yellow

    if ($expoTunnelUrl) {
        Write-Host ""
        Write-Host " 2) IF #1 DOESN'T LOAD (e.g. router blocks devices from reaching each other), use this instead - works on any network:" -ForegroundColor Green
        Push-Location $PSScriptRoot
        node -e "require('qrcode-terminal').generate('$expoTunnelUrl', {small: true}, (s) => console.log(s))"
        Pop-Location
        Write-Host "   $expoTunnelUrl" -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Host " (no internet fallback available this run - see FAILED/warning lines above)" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host " Test login: testnurse / password123"
} else {
    Write-Host " NOT FULLY READY - see FAILED lines above" -ForegroundColor Red
    Write-Host "================================================================" -ForegroundColor Red
}
Write-Host ""
Write-Host "All processes run detached - closing this window is safe."
Write-Host "Logs: $backendLog , $metroLog , $PSScriptRoot\.backend-ngrok.log"
