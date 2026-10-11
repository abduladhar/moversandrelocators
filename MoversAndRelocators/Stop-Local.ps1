[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$recordPath = Join-Path $PSScriptRoot '.run\processes.json'
if (-not (Test-Path -LiteralPath $recordPath)) { Write-Host 'No processes recorded for this project.'; return }
$record = Get-Content -Raw -LiteralPath $recordPath | ConvertFrom-Json
$expectedRoot = [IO.Path]::GetFullPath($PSScriptRoot)
if ([IO.Path]::GetFullPath($record.Root) -ne $expectedRoot) { throw 'Process record belongs to another project.' }
foreach ($processId in @($record.ApiPid, $record.WebPid)) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
    if ($process) {
        if ($process.CommandLine -notlike ('*' + $expectedRoot + '*')) { throw "Refusing to stop process ${processId}: command does not belong to this project." }
        Stop-Process -Id $processId -ErrorAction Stop
    }
}
Remove-Item -LiteralPath $recordPath
Write-Host 'Stopped this project.'
