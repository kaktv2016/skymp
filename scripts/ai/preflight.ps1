#!/usr/bin/env pwsh
[CmdletBinding()]
param(
    [string]$LauncherRoot,
    [string]$EvidenceRoot = [IO.Path]::GetTempPath(),
    [switch]$RequireClean
)
. "$PSScriptRoot/common.ps1"
$run = New-GateReceipt 'A' 'Repository baseline' $EvidenceRoot
$code = 0
try {
    $run.receipt.repositories = @(Get-RepoState $SkyMp)
    if ($LauncherRoot) { $run.receipt.repositories += Get-RepoState $LauncherRoot }
    $run.receipt.commands = @(
        foreach ($tool in 'git', 'node', 'npm.cmd') {
            $application = (Get-Command $tool -CommandType Application | Select-Object -First 1).Source
            $output = & $application --version
            $toolCode = $LASTEXITCODE
            if ($toolCode -ne 0) { $code = 1 }
            [ordered]@{ executable = $application; arguments = @('--version'); exitCode = $toolCode; output = $output }
        }
    )
    foreach ($repository in $run.receipt.repositories) {
        Write-Host "$($repository.root) $($repository.commit) [$($repository.branch)] clean=$($repository.clean)"
        if ($RequireClean -and -not $repository.clean) { $code = 1 }
    }
} catch {
    $run.receipt.error = $_.ToString()
    Write-Warning $run.receipt.error
    $code = 1
}
Complete-Gate $run $code
exit $code
