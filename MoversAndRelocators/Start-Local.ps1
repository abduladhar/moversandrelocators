[CmdletBinding()]
param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$apiRoot = Join-Path $projectRoot 'backend\src\Movers.Api'
$frontendRoot = Join-Path $projectRoot 'frontend'
$runRoot = Join-Path $projectRoot '.run'
New-Item -ItemType Directory -Force -Path $runRoot | Out-Null
$dotnet = (Get-Command dotnet -ErrorAction Stop).Source
$node = (Get-Command node -ErrorAction Stop).Source
$nodeMajor = [int]((& $node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 24) {
    $bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path -LiteralPath $bundledNode) { $node = $bundledNode }
    else { throw 'Install Node.js 24 or newer before starting the React app.' }
}
$env:PATH = (Split-Path $node) + ';' + $env:PATH
$nodeMajor = [int]((& $node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 24 -or $nodeMajor -ge 27) { throw 'Use Node.js 24, 25, or 26.' }

foreach ($port in @(5121, 5174)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
        throw "Port $port is already in use. Run Stop-Local.ps1 for this project, or stop the process using that port."
    }
}
if (-not (Test-Path -LiteralPath (Join-Path $apiRoot 'appsettings.Development.json'))) {
    throw 'Create backend/src/Movers.Api/appsettings.Development.json from its example and configure a database.'
}
if (-not $SkipBuild) {
    Push-Location $projectRoot
    try {
        & $dotnet build Movers.slnx
        if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' }
    } finally { Pop-Location }
    Push-Location $frontendRoot
    try {
        & pnpm install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
        & pnpm build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    } finally { Pop-Location }
}
$apiDll = Join-Path $apiRoot 'bin\Debug\net8.0\Movers.Api.dll'
$viteScript = Join-Path $frontendRoot 'node_modules\vite\bin\vite.js'
if (-not (Test-Path -LiteralPath $apiDll) -or -not (Test-Path -LiteralPath $viteScript)) {
    throw 'Build output or dependencies are missing. Run this script without -SkipBuild.'
}
$previousEnvironment = $env:ASPNETCORE_ENVIRONMENT
try {
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $api = Start-Process -FilePath $dotnet -ArgumentList @('"' + $apiDll + '"', '--urls', 'http://127.0.0.1:5121') -WorkingDirectory $apiRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runRoot 'api.log') -RedirectStandardError (Join-Path $runRoot 'api-errors.log')
    $web = Start-Process -FilePath $node -ArgumentList @('"' + $viteScript + '"', '--host', '127.0.0.1') -WorkingDirectory $frontendRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runRoot 'frontend.log') -RedirectStandardError (Join-Path $runRoot 'frontend-errors.log')
    @{ ApiPid = $api.Id; WebPid = $web.Id; Root = $projectRoot } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runRoot 'processes.json')
} finally { $env:ASPNETCORE_ENVIRONMENT = $previousEnvironment }
$healthy = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        $health = Invoke-RestMethod 'http://127.0.0.1:5121/health' -TimeoutSec 2
        if ($health.status -eq 'healthy') { $healthy = $true; break }
    } catch { Start-Sleep -Seconds 1 }
}
if (-not $healthy) { throw "API did not become healthy. Read $runRoot\api-errors.log and api.log; stop processes with Stop-Local.ps1." }
Write-Host 'Application: http://localhost:5174'
Write-Host 'API / Swagger: http://localhost:5121/swagger'
Write-Host "Logs: $runRoot"
