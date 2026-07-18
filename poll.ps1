for ($i = 0; $i -lt 40; $i++) {
  try {
    $r = Invoke-WebRequest -Uri http://localhost:5173 -UseBasicParsing -TimeoutSec 2
    Write-Host ("READY status=" + $r.StatusCode)
    break
  } catch {
    Write-Host "waiting..."
    Start-Sleep 1
  }
}
