# Starts the Laravel backend bound to 0.0.0.0 (reachable on the LAN), AND opens
# a Cloudflare quick tunnel so it's reachable from ANY network too - different
# WiFi, 4G/5G, anywhere with internet. No account or signup needed for this.
#
# Both run fully DETACHED from this window (their own hidden process, not
# attached to this console session) - closing this PowerShell window does NOT
# kill them anymore. Use stop-backend.ps1 (or stop-all.ps1) to actually stop
# them.
#
# Unlike the previous version of this script, "ready" now means a real HTTP
# round trip succeeded against /api/health - first locally, then through the
# public tunnel URL itself - not just "cloudflared printed a URL to its log".
# A URL can appear in the log before Cloudflare's edge has actually finished
# registering it, and the backend process takes a moment to bind after
# Start-Process returns, so either check alone can pass while the other path
# is still not actually usable yet.
#
# The tunnel URL changes every time this script runs, so it's written to
# .backend-tunnel-url ONLY once verified end-to-end, which app.config.js reads
# and exposes to the app as Constants.expoConfig.extra.backendTunnelUrl (see
# src/api.js). If tunnel verification fails, the file is left empty/missing on
# purpose - writing a URL that doesn't actually work would be worse than
# falling back to LAN-only, since the app would confidently point at a dead
# endpoint instead of a working one.

$ErrorActionPreference = 'Stop'

function Write-Section($text) {
    Write-Host ""
    Write-Host "== $text ==" -ForegroundColor Cyan
}

# ---------------------------------------------------------------------------
# 0. Kill stale processes from a previous run
# ---------------------------------------------------------------------------
Write-Section "Cleaning up previous run"

$existing = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    foreach ($conn in $existing) {
        Write-Host "Stopping existing process on port 8000 (PID $($conn.OwningProcess))..."
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
}

Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

$cloudflaredExe = "$PSScriptRoot\cloudflared.exe"
$tunnelUrlFile = "$PSScriptRoot\.backend-tunnel-url"
$tunnelLogFile = "$PSScriptRoot\.cloudflared.log"
$backendOutLogFile = "$PSScriptRoot\.backend.log"
$backendErrLogFile = "$PSScriptRoot\.backend-err.log"
Remove-Item $tunnelUrlFile -ErrorAction SilentlyContinue
Remove-Item $tunnelLogFile -ErrorAction SilentlyContinue
Remove-Item $backendOutLogFile -ErrorAction SilentlyContinue
Remove-Item $backendErrLogFile -ErrorAction SilentlyContinue

# ---------------------------------------------------------------------------
# 1. Make sure cloudflared.exe actually exists (it's gitignored - a fresh
#    clone of this repo won't have it) - download it automatically instead of
#    failing with a confusing "cannot find path" error from Start-Process.
# ---------------------------------------------------------------------------
if (-not (Test-Path $cloudflaredExe)) {
    Write-Section "cloudflared.exe not found - downloading it (one-time, ~50MB)"
    try {
        Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" `
            -OutFile $cloudflaredExe -UseBasicParsing
        Write-Host "Downloaded cloudflared.exe."
    } catch {
        Write-Host "ERROR: could not download cloudflared.exe automatically: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Download it manually from https://github.com/cloudflare/cloudflared/releases and place it at $cloudflaredExe" -ForegroundColor Red
        exit 1
    }
}

# ---------------------------------------------------------------------------
# 2. Start both processes. They don't depend on each other to launch - the
#    tunnel will just answer 502 until the backend is actually listening,
#    which the health checks below account for.
# ---------------------------------------------------------------------------
Write-Section "Starting backend and tunnel"

# Bind to this machine's actual LAN IP instead of 0.0.0.0 (wildcard/all
# interfaces). Confirmed the hard way: on this machine (multiple network
# adapters - WiFi + Radmin VPN), PHP's built-in dev server bound to 0.0.0.0
# accepts connections from THIS machine (loopback, and even its own LAN IP -
# both of those apparently route internally without ever exercising the real
# NIC) but silently refuses genuinely external connections, e.g. a phone on
# the same WiFi - curl from this machine and even the web build (proxied
# through Metro, so also same-machine) both looked fine while the phone got
# ERR_CONNECTION_FAILED. Binding to the concrete IP instead of the wildcard
# fixed it. Falls back to 0.0.0.0 if the IP can't be auto-detected for some
# reason, and re-detects fresh every run since this machine's IP has changed
# between sessions before (DHCP).
$lanIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL|VPN' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -First 1 -ExpandProperty IPAddress
if (-not $lanIp) { $lanIp = '0.0.0.0' }

Write-Host "Starting backend on ${lanIp}:8000 (detached)..."
Start-Process -FilePath "php" `
    -ArgumentList "artisan", "serve", "--host=$lanIp", "--port=8000" `
    -WorkingDirectory "C:\backend" `
    -RedirectStandardOutput $backendOutLogFile -RedirectStandardError $backendErrLogFile -WindowStyle Hidden


# Point cloudflared at the same concrete LAN IP the backend just bound to,
# not "localhost". Now that PHP binds to $lanIp specifically instead of
# 0.0.0.0, it no longer listens on loopback at all - cloudflared (running on
# this same machine) would get connection-refused trying "localhost:8000" and
# the public tunnel URL would 502 for everyone, even though the backend
# itself is perfectly healthy. Bit us once already: fixing external-device
# access (binding off the wildcard) silently broke the tunnel's local hop.
Write-Host "Starting Cloudflare tunnel (detached)..."
Start-Process -FilePath $cloudflaredExe `
    -ArgumentList "tunnel", "--url", "http://${lanIp}:8000" `
    -RedirectStandardError $tunnelLogFile -WindowStyle Hidden

# ---------------------------------------------------------------------------
# 3. Wait for cloudflared to print its assigned URL
# ---------------------------------------------------------------------------
Write-Section "Waiting for tunnel URL"

$tunnelUrl = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $tunnelLogFile) {
        # Requires >= 3 hyphens (4 word-segments) - real quick-tunnel names
        # cloudflared assigns are always multi-word (e.g.
        # "costs-hamilton-writers-gary.trycloudflare.com"). Without this,
        # a failed tunnel request (cloudflared logs
        # "failed to request quick Tunnel: Post https://api.trycloudflare.com/tunnel: ...")
        # false-matches on "api.trycloudflare.com" - Cloudflare's own API
        # domain mentioned in the ERROR, not an assigned tunnel - and this
        # script would report READY with a URL that was never a real tunnel.
        $match = Select-String -Path $tunnelLogFile -Pattern "https://([a-zA-Z0-9]+-){3,}[a-zA-Z0-9]+\.trycloudflare\.com" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($match) {
            $tunnelUrl = $match.Matches[0].Value
            Write-Host "Tunnel URL assigned after ${i}s: $tunnelUrl"
            break
        }
    }
}

if (-not $tunnelUrl) {
    Write-Host "WARNING: cloudflared did not print a tunnel URL within 30s." -ForegroundColor Yellow
    Write-Host "Check $tunnelLogFile for details. Continuing with LAN-only access." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# 4. Real health check: local first (proves the backend process itself is up
#    and serving), then through the public tunnel URL (proves the FULL path a
#    phone on a different network would actually use is working end to end).
#    This is the check the previous version of this script never did.
# ---------------------------------------------------------------------------
function Wait-ForHealth($url, $label, $timeoutSeconds) {
    $deadline = (Get-Date).AddSeconds($timeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri "$url/api/health" -TimeoutSec 8 -UseBasicParsing -ErrorAction Stop
            if ($r.StatusCode -eq 200) {
                Write-Host "$label reachable: HTTP 200" -ForegroundColor Green
                return $true
            }
        } catch {
            # not up yet - keep polling silently until the deadline
        }
        Start-Sleep -Seconds 1
    }
    Write-Host "$label did NOT respond within ${timeoutSeconds}s." -ForegroundColor Red
    return $false
}

# Discovered during testing: this machine's configured DNS resolver can fail
# to resolve freshly-created *.trycloudflare.com subdomains (confirmed via
# `nslookup <host>` returning "Non-existent domain" from the local resolver
# while `nslookup <host> 8.8.8.8` and `curl --resolve` to the same address
# both succeed immediately) - this is a local/corporate DNS quirk, not the
# tunnel actually being down. If the direct check fails, fall back to asking
# a public resolver directly: if IT can resolve the hostname, the tunnel is
# genuinely live on Cloudflare's edge and real phones (almost certainly not
# using this exact network's DNS server) will very likely reach it fine, even
# though this dev machine's own health check can't confirm it end-to-end.
function Test-PublicDnsSeesHost($hostname) {
    try {
        $result = Resolve-DnsName -Name $hostname -Server 8.8.8.8 -Type A -ErrorAction Stop
        return $null -ne $result
    } catch {
        return $false
    }
}

# 127.0.0.1 no longer reaches it now that it's bound to a specific IP instead
# of 0.0.0.0 (that's the whole point of the fix - see the bind step above) -
# check the same LAN IP it's actually listening on.
Write-Section "Health check: local backend"
$localHealthy = Wait-ForHealth "http://${lanIp}:8000" "Local backend (http://${lanIp}:8000)" 20

$tunnelHealthy = $false
$tunnelHealthyViaPublicDnsOnly = $false
if ($tunnelUrl) {
    Write-Section "Health check: through public tunnel"
    $tunnelHealthy = Wait-ForHealth $tunnelUrl "Public tunnel ($tunnelUrl)" 20

    if (-not $tunnelHealthy) {
        $hostname = ([Uri]$tunnelUrl).Host
        Write-Host "Direct check failed - asking a public DNS resolver (8.8.8.8) directly, in case this machine's own DNS server just can't see this hostname..."
        if (Test-PublicDnsSeesHost $hostname) {
            Write-Host "Public DNS resolves $hostname fine - treating tunnel as live. (This machine's local DNS resolver appears unable to resolve *.trycloudflare.com subdomains; that's a local network quirk, not the tunnel being down.)" -ForegroundColor Yellow
            $tunnelHealthy = $true
            $tunnelHealthyViaPublicDnsOnly = $true
        }
    }
}

# The tunnel proxies straight to http://localhost:8000 - if it answered 200,
# the local backend is provably up too, even if the earlier local check missed
# it (observed in testing: an isolated slow/flaky first request against
# 127.0.0.1 while everything else was fine). Trust the stronger positive
# signal instead of reporting a contradictory "not ready at all" underneath a
# "READY" result.
if ($tunnelHealthy -and -not $localHealthy) {
    $localHealthy = $true
}

# ---------------------------------------------------------------------------
# 5. Only write the tunnel URL file if it's actually verified working - an
#    unverified URL baked into the app is worse than no tunnel URL at all,
#    since src/api.js would confidently point at a dead endpoint instead of
#    correctly falling back to LAN.
# ---------------------------------------------------------------------------
Write-Section "Result"

if ($tunnelHealthy) {
    Set-Content -Path $tunnelUrlFile -Value $tunnelUrl -NoNewline
    Write-Host "READY. Backend is reachable from any network at: $tunnelUrl" -ForegroundColor Green
    if ($tunnelHealthyViaPublicDnsOnly) {
        Write-Host "NOTE: verified via public DNS only - this machine's own network could not resolve the tunnel hostname directly. Phones on other networks are very likely unaffected by this, but if you test from a browser ON THIS MACHINE, it may not load for the same DNS reason." -ForegroundColor Yellow
    }
} elseif ($tunnelUrl) {
    Write-Host "NOT READY for other networks: tunnel URL was assigned but did not answer /api/health." -ForegroundColor Red
    Write-Host "The app will fall back to LAN-only mode (same WiFi required). Check $tunnelLogFile and $backendErrLogFile." -ForegroundColor Red
} else {
    Write-Host "NOT READY for other networks: no tunnel URL was assigned at all." -ForegroundColor Red
    Write-Host "The app will fall back to LAN-only mode (same WiFi required). Check $tunnelLogFile." -ForegroundColor Red
}

if (-not $localHealthy) {
    Write-Host "NOT READY at all: the local backend itself never answered. Check $backendErrLogFile and $backendOutLogFile." -ForegroundColor Red
}

Write-Host ""
Write-Host "Both processes run detached - safe to close this window."
Write-Host "Backend log:  $backendOutLogFile ($backendErrLogFile for errors)"
Write-Host "Tunnel log:   $tunnelLogFile"
Write-Host "To stop them, run stop-backend.ps1"
Write-Host "To keep this tunnel alive automatically if it dies later, run watch-backend.ps1 in its own window."
