$ErrorActionPreference = "Stop"

$ContainerName = "finally"

# Stop and remove container, keep volume (idempotent)
docker rm -f $ContainerName 2>$null | Out-Null

Write-Host "FinAlly stopped."
