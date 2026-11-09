#!/usr/bin/env pwsh
# The approval fixture uses its own Git repo and the real Context Manager scripts.
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$fixture = Join-Path ([IO.Path]::GetTempPath()) "frostveil-handoff-contract-$([guid]::NewGuid())"
$repo = Join-Path $fixture 'repo'
$baseDir = 'docs/ai/milestones/example'
$shell = (Get-Process -Id $PID).Path
$script:checks = 0

function Assert-Check([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
    $script:checks++
}

function Run-Git([string[]]$Arguments) {
    $output = & git -C $repo @Arguments
    if ($LASTEXITCODE) { throw "Fixture git failed: $($Arguments -join ' ')" }
    $output
}

function Commit-Fixture([string]$Message) {
    Run-Git @('add', '--all') | Out-Null
    Run-Git @('-c', 'user.name=Frostveil fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', $Message) | Out-Null
    Run-Git @('rev-parse', 'HEAD')
}

function Invoke-Handoff([string[]]$Arguments, [int]$Expected = 0) {
    $diagnostic = Join-Path $fixture "$script:checks.stderr.log"
    $output = & $shell -NoProfile -File "$repo/scripts/ai/milestone-handoff.ps1" @Arguments 2> $diagnostic
    $code = $LASTEXITCODE
    if ($code -ne $Expected) { Get-Content -LiteralPath $diagnostic | Write-Host }
    Assert-Check ($code -eq $Expected) "Handoff expected exit $Expected, got $code ($($Arguments -join ' '))"
    if ($output) { ($output -join "`n") | ConvertFrom-Json }
}

function Write-Specification([int]$Revision) {
    $sections = @{
        'SPEC.md' = @('Goals','Requirements','Scope','Exclusions','Constraints','Dependencies')
        'EXECUTION_PLAN.md' = @('Strategy','Tasks','Skills','Subagent assignments','Quality gates')
        'ACCEPTANCE.md' = @('Machine criteria','Owner checks','Definition of Done','Rollback')
    }
    foreach ($name in $sections.Keys) {
        $lines = @('# Fixture', '', 'Milestone: example', "Revision: $Revision")
        foreach ($section in $sections[$name]) {
            $lines += @('', "## $section", '')
            if ($section -eq 'Dependencies') {
                $lines += @('- Launcher commit: none', '- Required tools: git, pwsh')
            } else {
                $lines += "- Verify $section in an isolated fixture."
            }
        }
        Set-Content -LiteralPath "$repo/$baseDir/$name" -Value $lines
    }
}

Write-Host "Handoff fixture and diagnostics: $fixture"
New-Item -ItemType Directory -Path "$repo/$baseDir", "$repo/scripts/ai" | Out-Null
foreach ($name in 'common','checkpoint-common','complete-milestone-boundary','resume-milestone','milestone-handoff') {
    $file = Join-Path $PSScriptRoot "$name.ps1"
    if (Test-Path -LiteralPath $file) { Copy-Item -LiteralPath $file -Destination "$repo/scripts/ai" }
}
Set-Content -LiteralPath "$repo/.gitignore" -Value '/.local/ai/checkpoints/'
$pointer = "$repo/docs/ai/ACTIVE_MILESTONE.md"
Set-Content -LiteralPath $pointer -Value @('# Active milestone','','```json','{"schema":1,"status":"NONE"}','```')
Run-Git @('init', '--quiet') | Out-Null
$null = Commit-Fixture 'No active handoff'
$none = Invoke-Handoff @('-Action','Load')
Assert-Check ($none.disposition -eq 'NO_ACTIVE_MILESTONE') 'Unexpected active handoff'

Write-Specification 1
$draft = @('-Action','ValidateDraft','-Milestone','example','-Revision','1')
$null = Invoke-Handoff $draft
$accept = "$repo/$baseDir/ACCEPTANCE.md"
(Get-Content -Raw -LiteralPath $accept).Replace('## Rollback','## Recovery') | Set-Content -LiteralPath $accept
$null = Invoke-Handoff $draft 1
Write-Specification 1
$spec = "$repo/$baseDir/SPEC.md"
(Get-Content -Raw -LiteralPath $spec).Replace('Revision: 1','Revision: 2') | Set-Content -LiteralPath $spec
$null = Invoke-Handoff $draft 1
Write-Specification 1
(Get-Content -Raw -LiteralPath $spec).Replace('- Required tools: git, pwsh','- Required tools: git, frostveil-missing-fixture-tool') | Set-Content -LiteralPath $spec
$missingTool = Commit-Fixture 'Unmet tool dependency'
$approval = @('-Action','Approve','-Milestone','example','-Revision','1','-SpecificationCommit')
$null = Invoke-Handoff ($approval + $missingTool) 1
Write-Specification 1
$pin = Commit-Fixture 'Specification revision 1'
$null = Invoke-Handoff ($approval + $pin)
$null = Invoke-Handoff @('-Action','Load') 1
$approved = Commit-Fixture 'Approve revision 1'
$received = Invoke-Handoff @('-Action','Load')
Assert-Check ($received.approvedCommit -eq $pin -and $received.approvalRecordCommit -eq $approved -and $received.disposition -eq 'INITIALIZE') 'First execution did not load the approved spec'
Assert-Check ($received.documents.'SPEC.md' -match 'Verify Goals') 'Receiver did not get spec content'

$state = [ordered]@{
    milestone = $received.checkpointId
    goal = 'Verify the handoff'
    scope = 'Documentation fixture'
    stage = 'INTAKE'
    status = 'IN_PROGRESS'
    completed = @('read-spec')
    pending = @('verify-handoff')
    evidencePaths = @()
    nextAction = 'Verify the pending handoff'
}
$statePath = Join-Path $fixture 'state.json'
$state | ConvertTo-Json | Set-Content -LiteralPath $statePath
& $shell -NoProfile -File "$repo/scripts/ai/complete-milestone-boundary.ps1" -StateFile $statePath | Out-Null
Assert-Check ($LASTEXITCODE -eq 0) 'Fixture could not persist a matching checkpoint'
$resumed = Invoke-Handoff @('-Action','Load')
Assert-Check ($resumed.disposition -eq 'CONTINUE' -and $resumed.checkpoint.state.completed[0] -eq 'read-spec') 'Matching Context Manager checkpoint did not resume'

Add-Content -LiteralPath $spec -Value 'Unapproved edit'
$null = Invoke-Handoff @('-Action','Load') 1
Run-Git @('add','--',"$baseDir/SPEC.md") | Out-Null
Run-Git @('restore','--source=HEAD','--worktree','--',"$baseDir/SPEC.md") | Out-Null
$null = Invoke-Handoff @('-Action','Load') 1
Run-Git @('restore','--staged','--',"$baseDir/SPEC.md") | Out-Null

Run-Git @('-c', 'user.name=Frostveil fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '--quiet', '-m', 'Checkpoint Git drift') | Out-Null
$null = Invoke-Handoff @('-Action','Load') 1

$approvedPointer = Get-Content -Raw -LiteralPath $pointer
$approvedPointer.Replace('"status": "APPROVED"','"status": "AUTO_VERIFIED"') | Set-Content -LiteralPath $pointer
$null = Commit-Fixture 'Pointer status inconsistent with checkpoint'
& $shell -NoProfile -File "$repo/scripts/ai/complete-milestone-boundary.ps1" -StateFile $statePath -ExpectedRevision 1 | Out-Null
Assert-Check ($LASTEXITCODE -eq 0) 'Fixture could not persist the status mismatch checkpoint'
$null = Invoke-Handoff @('-Action','Load') 1
Set-Content -LiteralPath $pointer -Value $approvedPointer
$null = Commit-Fixture 'Restore original pointer status'

Write-Specification 2
$secondPin = Commit-Fixture 'Specification revision 2'
$null = Invoke-Handoff @('-Action','Load') 1
$null = Invoke-Handoff ($approval + $pin) 1
$oldPointer = Get-Content -Raw -LiteralPath $pointer
$oldPointer.Replace($pin,$secondPin).Replace('"revision": 1','"revision": 2').Replace('"status": "APPROVED"','"status": "IN_PROGRESS"') | Set-Content -LiteralPath $pointer
$null = Commit-Fixture 'Unapproved execution status'
$null = Invoke-Handoff @('-Action','Load') 1
Set-Content -LiteralPath $pointer -Value $oldPointer
$null = Commit-Fixture 'Restore approved routing'
$null = Invoke-Handoff @('-Action','Approve','-Milestone','example','-Revision','2','-SpecificationCommit',$secondPin)
$null = Commit-Fixture 'Approve revision 2'
$second = Invoke-Handoff @('-Action','Load')
Assert-Check ($second.revision -eq 2 -and $second.disposition -eq 'INITIALIZE' -and $second.checkpointId -ne $received.checkpointId) 'A changed revision reused the old checkpoint'
Assert-Check (((Run-Git @('show',"${pin}:$baseDir/SPEC.md")) -join [char]10) -match 'Revision: 1') 'Previous specification revision was not retained'

Set-Content -LiteralPath $pointer -Value $oldPointer
$null = Commit-Fixture 'Attempt to reactivate old approval'
$null = Invoke-Handoff @('-Action','Load') 1

Write-Output "Milestone handoff contract passed ($script:checks checks). Evidence: $fixture"
