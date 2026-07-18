try { $a = Invoke-WebRequest -Uri http://localhost:5173 -UseBasicParsing -TimeoutSec 3; Write-Host ("5173=" + $a.StatusCode) } catch { Write-Host "5173 fail" }
try { $b = Invoke-WebRequest -Uri http://localhost:5174 -UseBasicParsing -TimeoutSec 3; Write-Host ("5174=" + $b.StatusCode) } catch { Write-Host "5174 fail" }
