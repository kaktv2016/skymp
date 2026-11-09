#!/usr/bin/env pwsh
# Exercise the public checkpoint commands in a disposable Git checkout.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$fixture = Join-Path ([IO.Path]::GetTempPath()) "frostveil-context-contract-$([guid]::NewGuid())"
$repo = Join-Path $fixture repo
$shell = (Get-Process -Id $PID).Path
$statePath = Join-Path $fixture state.json
$evidence = Join-Path $fixture evidence.txt
$script:checks = 0

function Assert-Check([bool]$Condition, [string]$Description) {
    if (-not $Condition) { throw $Description }
    $script:checks++
}

function Run-Git([string[]]$GitArguments) {
    & git -C $repo @GitArguments | Out-Null
    if ($LASTEXITCODE) { throw "Fixture git failed: $($GitArguments -join ' ')" }
}

function Run-Context([string]$Name, [string[]]$ScriptArguments, [int]$Expected) {
    $diagnostic = Join-Path $fixture "$($script:checks)-$Name.stderr.log"
    $output = & $shell -NoProfile -File (Join-Path $repo "scripts/ai/$Name.ps1") @ScriptArguments 2> $diagnostic
    $code = $LASTEXITCODE
    if ($code -ne $Expected) { Get-Content -LiteralPath $diagnostic | Write-Host }
    Assert-Check ($code -eq $Expected) "$Name expected exit $Expected, got $code"
    if ($output) { ($output -join "`n") | ConvertFrom-Json }
}

function Save-State($State, [int]$ExpectedRevision = 0, [int]$ExpectedExit = 0, [string]$LauncherRoot) {
    $State | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $statePath
    $arguments = @('-StateFile', $statePath, '-ExpectedRevision', $ExpectedRevision)
    if ($LauncherRoot) { $arguments += @('-LauncherRoot', $LauncherRoot) }
    Run-Context 'complete-milestone-boundary' $arguments $ExpectedExit
}

Write-Host "Private fixture and diagnostics: $fixture"
New-Item -ItemType Directory -Path "$repo/scripts/ai" | Out-Null
foreach ($name in 'common', 'checkpoint-common', 'complete-milestone-boundary', 'resume-milestone') {
    $script = Join-Path $PSScriptRoot "$name.ps1"
    if (Test-Path -LiteralPath $script) { Copy-Item -LiteralPath $script -Destination "$repo/scripts/ai" }
}
Set-Content -LiteralPath "$repo/.gitignore" -Value '/.local/ai/checkpoints/'
Set-Content -LiteralPath $evidence -Value 'fixture evidence'
Run-Git @('init', '--quiet')
Run-Git @('add', '--all')
$identity = @('-c', 'user.name=Frostveil fixture', '-c', 'user.email=fixture@example.invalid')
Run-Git ($identity + @('commit', '--quiet', '-m', 'Fixture baseline'))

$state = [ordered]@{
    milestone = 'resume-fixture'
    goal = 'Resume a bounded fixture'
    scope = 'Workflow fixture only'
    stage = 'BASELINE_AUDIT'
    status = 'IN_PROGRESS'
    completed = @('baseline-audit')
    pending = @('verify-resume')
    evidencePaths = @($evidence)
    nextAction = 'Verify the saved checkpoint'
}
$target = @('-Milestone', $state.milestone)
$first = Save-State $state
Assert-Check ($first.revision -eq 1 -and (Test-Path -LiteralPath $first.path -PathType Leaf)) 'First boundary did not persist revision 1'
$loaded = Run-Context 'resume-milestone' $target 0
Assert-Check ($loaded.validation.disposition -eq 'CONTINUE' -and $loaded.checkpoint.state.completed[0] -eq 'baseline-audit') 'Resume lost the completed task'

$state.stage = 'OWNER_ACCEPTANCE'
$state.status = 'OWNER_PENDING'
$null = Save-State $state 1 1
$old = Run-Context 'resume-milestone' ($target + '-ValidateOnly') 0
Assert-Check ($old.revision -eq 1) 'Invalid owner boundary replaced the prior checkpoint'
$state.ownerAction = 'Confirm the fixture only'
$state.nextAction = 'Wait for the recorded owner response'
$owner = Save-State $state 1
$loaded = Run-Context 'resume-milestone' $target 0
Assert-Check ($owner.revision -eq 2 -and $loaded.validation.disposition -eq 'WAIT_FOR_OWNER') 'Owner boundary did not persist a wait state'

$state.stage = 'REPAIR_LOOP'
$state.status = 'BLOCKED'
$state.Remove('ownerAction')
$state.blocker = 'Fixture dependency is unavailable'
$state.nextAction = 'Wait for fixture dependency'
$null = Save-State $state 1 1
$state.completed = @()
$null = Save-State $state 2 1
$state.completed = @('baseline-audit')
$state.pending = @()
$null = Save-State $state 2 1
$state.pending = @('verify-resume')
$blocked = Save-State $state 2
$loaded = Run-Context 'resume-milestone' $target 0
Assert-Check ($blocked.revision -eq 3 -and $loaded.validation.disposition -eq 'WAIT_FOR_UNBLOCK') 'Blocked boundary did not persist'
Assert-Check ((Test-Path -LiteralPath $first.path) -and (Test-Path -LiteralPath $owner.path)) 'A later boundary discarded earlier revisions'

$lock = [IO.File]::Open((Join-Path (Split-Path -Parent $blocked.path) '.write.lock'), 'Open', 'ReadWrite', 'None')
try { $null = Save-State $state 3 1 } finally { $lock.Dispose() }
$state.milestone = '../unsafe'
$null = Save-State $state 0 1

Set-Content -LiteralPath $evidence -Value 'changed evidence'
$loaded = Run-Context 'resume-milestone' $target 1
Assert-Check (($loaded.validation.issues -join ' ') -like '*evidence hash*') 'Resume accepted changed evidence'
Set-Content -LiteralPath $evidence -Value 'fixture evidence'

$state.milestone = 'dirty-fixture'
Set-Content -LiteralPath "$repo/uncommitted.txt" -Value 'work in progress'
$null = Save-State $state
$dirty = Run-Context 'resume-milestone' @('-Milestone', 'dirty-fixture') 0
Assert-Check ($dirty.status -eq 'BLOCKED' -and $dirty.validation.disposition -eq 'RECONCILE_DIRTY_WORKTREE') 'Dirty wait state bypassed Git reconciliation'
Remove-Item -LiteralPath "$repo/uncommitted.txt"

$launcher = Join-Path $fixture launcher
Run-Git @('clone', '--quiet', '--local', $repo, $launcher)
$state.milestone = 'cross-repo-fixture'
$null = Save-State $state -LauncherRoot $launcher
$null = Save-State $state 1 1
$crossRepo = Run-Context 'resume-milestone' @('-Milestone', 'cross-repo-fixture', '-LauncherRoot', $launcher) 0
Assert-Check ($crossRepo.checkpoint.repositories.launcher.commit -eq $crossRepo.checkpoint.repositories.skyMp.commit) 'Launcher Git identity was lost'

Run-Git ($identity + @('commit', '--quiet', '--allow-empty', '-m', 'Advance fixture'))
$loaded = Run-Context 'resume-milestone' $target 1
Assert-Check (($loaded.validation.issues -join ' ') -like '*Git state*') 'Resume accepted a different Git revision'

Set-Content -LiteralPath $blocked.path -Value '{bad JSON'
$null = Run-Context 'resume-milestone' $target 1
Write-Output "Context Manager contract passed ($script:checks checks). Evidence: $fixture"
