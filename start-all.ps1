# One-shot: starts both the backend (with its Cloudflare tunnel) and the Expo
# dev server (also tunneled), each in its own window, so the app works on a
# phone from ANY network - not just the same WiFi as this computer. Use this
# after a reboot or whenever both servers need restarting.
#
# start-app.ps1 waits for start-backend.ps1's tunnel URL on its own, but give
# it a head start here too since cloudflared can take up to ~20s to connect.

Start-Process powershell -ArgumentList '-NoExit', '-File', "$PSScriptRoot\start-backend.ps1"
Start-Sleep -Seconds 5
Start-Process powershell -ArgumentList '-NoExit', '-File', "$PSScriptRoot\start-app.ps1"

Write-Host "Backend and Expo dev server are starting in separate windows."
Write-Host "Backend:  see the backend window for its Cloudflare tunnel URL (https://*.trycloudflare.com)"
Write-Host "Expo:     see the Expo window for the tunnel QR code (scan it with Expo Go - works on any network)"
