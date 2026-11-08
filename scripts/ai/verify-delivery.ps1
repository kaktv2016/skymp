#!/usr/bin/env pwsh
# Read-only artifact and regression-receipt integrity check. Use the release seal for provenance.
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('Gamemode', 'Blueprint', 'CreationKit', 'Launcher')][string]$Suite,
    [Parameter(Mandatory)][string]$RegressionReceipt,
    [Parameter(Mandatory)][string]$Artifact,
    [Parameter(Mandatory)][ValidatePattern('^[0-9a-fA-F]{64}$')][string]$Sha256,
    [string]$LauncherRoot = (Join-Path $PSScriptRoot '../../../skyrim-rp-launcher'),
    [string]$EvidenceRoot = [IO.Path]::GetTempPath()
)
. "$PSScriptRoot/common.ps1"
$run = New-GateReceipt 'F' $Suite $EvidenceRoot
$code = 0
try {
    $repo = Get-SuiteRepo $Suite $LauncherRoot
    $state = Get-RepoState $repo
    $run.receipt.repository = $state
    if (-not $state.clean) { throw 'Delivery requires a clean repository.' }

    $receiptFile = Get-Item -LiteralPath $RegressionReceipt
    $receipt = Get-Content -Raw -LiteralPath $receiptFile.FullName | ConvertFrom-Json
    if ($receipt.schema -cne 1 -or $receipt.gate -cne 'C' -or $receipt.scope -ne $Suite -or
        $null -eq $receipt.exitCode -or $receipt.exitCode -ne 0) {
        throw "Expected a successful Gate C receipt for $Suite."
    }
    foreach ($snapshot in $receipt.before, $receipt.after) {
        if ($snapshot.clean -ne $true -or $snapshot.commit -cne $state.commit -or $snapshot.root -ne $state.root) {
            throw 'Regression evidence must come from this clean repository at the current commit.'
        }
    }
    $plan = @(Get-SuitePlan $Suite 'C')
    if ($receipt.commands.Count -ne $plan.Count) { throw 'Regression commands are incomplete.' }
    for ($i = 0; $i -lt $plan.Count; $i++) {
        $command = $receipt.commands[$i]
        $step = $plan[$i]
        $logName = "command-$($i + 1).log"
        if ($command.log -cne $logName -or $null -eq $command.exitCode -or $command.exitCode -ne 0 -or
            ($command.arguments -join ' ') -cne ($step.arguments -join ' ')) {
            throw "Unexpected regression command record: $logName"
        }
        $log = Join-Path $receiptFile.DirectoryName $logName
        if ((Get-FileHash -LiteralPath $log).Hash -ne $command.sha256) { throw "Regression log hash mismatch: $log" }
        if ($step.tests -and ($command.testCount -le 0 -or $command.testCount -ne (Get-LogTestCount $log))) {
            throw "Missing or inconsistent test count: $log"
        }
    }
    $run.receipt.regression = [ordered]@{
        path = $receiptFile.FullName
        sha256 = (Get-FileHash -LiteralPath $receiptFile.FullName).Hash
    }
    $file = Get-Item -LiteralPath $Artifact
    if ($file.PSIsContainer -or $file.Length -le 0) { throw 'Expected a nonempty artifact file.' }
    $actual = (Get-FileHash -LiteralPath $file.FullName).Hash
    $run.receipt.artifact = [ordered]@{ path = $file.FullName; sha256 = $actual; expectedSha256 = $Sha256 }
    if ($actual -ne $Sha256) { throw "Artifact hash mismatch: $($file.FullName)" }
} catch {
    $run.receipt.error = $_.ToString()
    Write-Warning $run.receipt.error
    $code = 1
}
Complete-Gate $run $code
exit $code
