#!/usr/bin/env pwsh
# Contract test for the wrappers. All synthetic projects and receipts stay in TEMP.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$fixture = Join-Path ([IO.Path]::GetTempPath()) "frostveil-ai-contract-$([guid]::NewGuid())"
$repo = Join-Path $fixture repo
$evidence = Join-Path $fixture evidence
$shell = (Get-Process -Id $PID).Path

function Assert-Equal($Actual, $Expected, [string]$Check) {
    if ($Actual -cne $Expected) { throw "$Check expected [$Expected], got [$Actual]" }
}

function Run-Git([string[]]$GitArguments) {
    & git -C $repo @GitArguments | Out-Null
    Assert-Equal $LASTEXITCODE 0 "git $($GitArguments -join ' ')"
}

function Run-Gate([string]$Name, [string[]]$GateArguments, [int]$Expected) {
    & $shell -NoProfile -File (Join-Path $repo "scripts/ai/$Name.ps1") @GateArguments
    Assert-Equal $LASTEXITCODE $Expected $Name
}

New-Item -ItemType Directory -Path "$repo/rp-gamemode", "$repo/scripts/ai" | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'test-workflow.ps1') -Destination "$repo/scripts/ai"
foreach ($name in 'common', 'preflight', 'test-focused', 'test-regression', 'verify-delivery') {
    $script = Join-Path $PSScriptRoot "$name.ps1"
    if (Test-Path -LiteralPath $script) { Copy-Item -LiteralPath $script -Destination "$repo/scripts/ai" }
}
Set-Content -LiteralPath "$repo/rp-gamemode/package.json" -Value '{"name":"workflow-fixture","private":true,"scripts":{"test":"node --test smoke.test.cjs","test:profile":"node --test smoke.test.cjs"}}'
Set-Content -LiteralPath "$repo/rp-gamemode/smoke.test.cjs" -Value "require('node:test')('workflow fixture', () => {});"
Set-Content -LiteralPath "$fixture/artifact.txt" -Value 'fixture'
Run-Git @('init', '--quiet')
Run-Git @('add', '--all')
Run-Git @('-c', 'user.name=Frostveil fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Fixture')

Run-Gate 'preflight' @('-EvidenceRoot', $evidence, '-RequireClean') 0
Run-Gate 'test-focused' @('-Suite', 'Gamemode', '-EvidenceRoot', $evidence) 0
Run-Gate 'test-regression' @('-Suite', 'Gamemode', '-EvidenceRoot', $evidence) 0
$receipts = Get-ChildItem -LiteralPath $evidence -Recurse -Filter receipt.json
$regression = $receipts | Where-Object { (Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json).gate -eq 'C' }
$receipt = Get-Content -Raw -LiteralPath $regression.FullName | ConvertFrom-Json
Assert-Equal $receipt.commands[0].testCount 1 'TAP test count'
$sha = (Get-FileHash -LiteralPath "$fixture/artifact.txt").Hash
$verify = @('-Suite', 'Gamemode', '-RegressionReceipt', $regression.FullName, '-Artifact', "$fixture/artifact.txt", '-Sha256', $sha, '-EvidenceRoot', $evidence)
Run-Gate 'verify-delivery' $verify 0

Set-Content -LiteralPath "$fixture/artifact.txt" -Value 'tampered'
Run-Gate 'verify-delivery' $verify 1
Set-Content -LiteralPath "$fixture/artifact.txt" -Value 'fixture'
Set-Content -LiteralPath "$repo/dirty.txt" -Value 'untracked'
Run-Gate 'verify-delivery' $verify 1
Run-Gate 'preflight' @('-EvidenceRoot', $evidence, '-RequireClean') 1
Remove-Item -LiteralPath "$repo/dirty.txt"
Add-Content -LiteralPath (Join-Path $regression.DirectoryName $receipt.commands[0].log) -Value 'tampered log'
Run-Gate 'verify-delivery' $verify 1
Run-Git @('-c', 'user.name=Frostveil fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '--allow-empty', '-m', 'New fixture revision')
Run-Gate 'verify-delivery' $verify 1

Set-Content -LiteralPath "$repo/rp-gamemode/smoke.test.cjs" -Value "require('node:test')('workflow fixture', () => { throw Error('fixture diagnostic'); });"
$failed = Join-Path $fixture failed
Run-Gate 'test-focused' @('-Suite', 'Gamemode', '-EvidenceRoot', $failed) 1
$failedReceipt = Get-ChildItem -LiteralPath $failed -Recurse -Filter receipt.json
$record = Get-Content -Raw -LiteralPath $failedReceipt.FullName | ConvertFrom-Json
Assert-Equal $record.exitCode 1 'failed suite exit code'
if (-not (Select-String -Quiet -LiteralPath (Join-Path $failedReceipt.DirectoryName $record.commands[0].log) -Pattern 'fixture diagnostic')) {
    throw 'Failed suite log lost the diagnostic'
}
Write-Output "Workflow contract passed. Evidence and fixtures: $fixture"
