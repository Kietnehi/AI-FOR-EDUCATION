param(
    [string]$ProjectRoot = "D:\DACN",
    [string]$ComposeFile = "docker-compose.prod.yml",
    [string]$EnvFile = ".env.prod",
    [ValidateSet("local-build", "dockerhub")]
    [string]$DeployMode = "local-build"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "[deploy] Project root: $ProjectRoot"
Set-Location $ProjectRoot

if (-not (Test-Path $ComposeFile)) {
    throw "Compose file not found: $ComposeFile"
}

if (-not (Test-Path $EnvFile)) {
    throw "Env file not found: $EnvFile"
}

if ($DeployMode -eq "dockerhub") {
    Write-Host "[deploy] Pulling latest images from registry..."
    docker compose --env-file $EnvFile -f $ComposeFile pull
} else {
    Write-Host "[deploy] Building local images on self-hosted runner..."
    docker compose --env-file $EnvFile -f $ComposeFile build backend frontend
}

Write-Host "[deploy] Starting/recreating services..."
docker compose --env-file $EnvFile -f $ComposeFile up -d --remove-orphans

Write-Host "[deploy] Service status:"
docker compose --env-file $EnvFile -f $ComposeFile ps

$maxAttempts = 20
$delaySeconds = 5
$healthy = $false

for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    try {
        $status = Invoke-WebRequest -UseBasicParsing http://localhost:8000/health -TimeoutSec 5
        if ($status.StatusCode -eq 200) {
            $healthy = $true
            break
        }
    } catch {
        Start-Sleep -Seconds $delaySeconds
    }
}

if (-not $healthy) {
    throw "Backend health check failed after deployment"
}

Write-Host "[deploy] Deployment finished successfully."
