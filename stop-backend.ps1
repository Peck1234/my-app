# Stops the backend and Cloudflare tunnel started by start-backend.ps1. Needed
# now that both run detached - closing the PowerShell window doesn't stop them
# anymore (that was the whole point: it also meant accidentally closing that
# window couldn't silently take the app offline).

$existing = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    foreach ($conn in $existing) {
        Write-Host "Stopping backend (PID $($conn.OwningProcess))..."
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "Backend wasn't running."
}

$cf = Get-Process cloudflared -ErrorAction SilentlyContinue
if ($cf) {
    $cf | ForEach-Object { Write-Host "Stopping cloudflared (PID $($_.Id))..." }
    $cf | Stop-Process -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "Cloudflare tunnel wasn't running."
}

Remove-Item "$PSScriptRoot\.backend-tunnel-url" -ErrorAction SilentlyContinue
Write-Host "Stopped."
