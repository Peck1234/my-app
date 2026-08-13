# Keeps the backend + Cloudflare tunnel alive unattended. Run this in its own
# window alongside start-backend.ps1 (or instead of babysitting it yourself).
#
# Why this exists: during development of this exact setup, the Cloudflare
# quick tunnel died on its own - silently, with the backend process still
# running - three separate times in a single session, each time requiring a
# manual re-run of start-backend.ps1 to notice and fix. Quick tunnels
# (trycloudflare.com) are explicitly not meant to be a long-running stable
# service; this script is the mitigation for that, not a fix for it.
#
# Every CHECK_INTERVAL_SECONDS, this verifies the full path a phone on a
# different network would actually use (the public tunnel URL's /api/health)
# actually still works. If it doesn't - for any reason: cloudflared died, the
# tunnel silently dropped, the backend process itself died - it just re-runs
# start-backend.ps1, which kills whatever's left and starts fresh.
#
# IMPORTANT CAVEAT this script does NOT solve: the tunnel URL changes on every
# restart. An already-open Expo Go app has the OLD url baked into its already-
# loaded JS bundle and has no way to know a new one exists - it needs to be
# manually reloaded (close/reopen Expo Go, or shake -> Reload) to pick up the
# new URL after this script silently recovers the server side. This script
# keeps the SERVER healthy automatically; it does not push the new URL to a
# phone that's already using the old one.

param(
    [int]$CheckIntervalSeconds = 60
)

$tunnelUrlFile = "$PSScriptRoot\.backend-tunnel-url"
$watchLogFile = "$PSScriptRoot\.watch-backend.log"

function Write-Log($message, $color = "White") {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $message"
    Write-Host $line -ForegroundColor $color
    Add-Content -Path $watchLogFile -Value $line
}

function Test-BackendHealthy {
    if (-not (Test-Path $tunnelUrlFile)) { return $false }
    $url = (Get-Content $tunnelUrlFile -Raw).Trim()
    if (-not $url) { return $false }
    try {
        $r = Invoke-WebRequest -Uri "$url/api/health" -TimeoutSec 6 -UseBasicParsing -ErrorAction Stop
        return $r.StatusCode -eq 200
    } catch {
        return $false
    }
}

Write-Log "watch-backend.ps1 started. Checking every ${CheckIntervalSeconds}s. Log: $watchLogFile" "Cyan"

# Give the very first start-backend.ps1 run (started separately, e.g. by
# start-all.ps1) a chance to finish before the first check.
Start-Sleep -Seconds 15

while ($true) {
    if (Test-BackendHealthy) {
        Write-Log "OK - tunnel healthy."
    } else {
        Write-Log "UNHEALTHY - tunnel/backend not responding. Restarting via start-backend.ps1..." "Yellow"
        try {
            & "$PSScriptRoot\start-backend.ps1" *>> $watchLogFile
        } catch {
            Write-Log "start-backend.ps1 threw an error: $($_.Exception.Message)" "Red"
        }

        if (Test-BackendHealthy) {
            $newUrl = (Get-Content $tunnelUrlFile -Raw).Trim()
            Write-Log "RECOVERED - new tunnel URL: $newUrl" "Green"
            Write-Log "Reminder: any phone with the app already open needs to reload it to pick up the new URL." "Yellow"
        } else {
            Write-Log "RESTART FAILED - still unhealthy after re-running start-backend.ps1. Check .backend-err.log and .cloudflared.log." "Red"
        }
    }

    Start-Sleep -Seconds $CheckIntervalSeconds
}
