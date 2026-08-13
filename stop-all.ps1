# Stops everything started by start-all.ps1: the Expo dev server (port 8081),
# the backend, and the Cloudflare tunnel. If you also have watch-backend.ps1
# running in its own window, close that window separately (or Ctrl+C it) -
# it isn't tracked by port/process here since it doesn't bind a port itself.

$existing = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    foreach ($conn in $existing) {
        Write-Host "Stopping Expo dev server (PID $($conn.OwningProcess))..."
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "Expo dev server wasn't running."
}

& "$PSScriptRoot\stop-backend.ps1"
