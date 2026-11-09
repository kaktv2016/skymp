#!/usr/bin/env pwsh
# Validate and persist the next milestone boundary before the handoff.
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$StateFile,
    [ValidateRange(0, 999999998)][int]$ExpectedRevision = 0,
    [string]$LauncherRoot
)
. "$PSScriptRoot/checkpoint-common.ps1"

$state = Read-CheckpointJson $StateFile
Assert-MilestoneState $state
$evidence = @(foreach ($path in $state.evidencePaths) { Get-EvidenceRecord $path })
$state.evidencePaths = @($evidence | ForEach-Object { $_.path })
Assert-MilestoneState $state

$directory = Get-CheckpointDirectory $state.milestone -Create
$lockPath = Join-Path $directory '.write.lock'
if ((Test-Path -LiteralPath $lockPath) -and
    ((Get-Item -Force -LiteralPath $lockPath).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'Checkpoint lock file must not be redirected.'
}
$lock = [IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None')
try {
    $latest = Get-LatestCheckpointFile $directory
    $previous = Get-CheckpointRevision $latest
    if ($previous -ne $ExpectedRevision) {
        throw "Stale checkpoint revision. Expected $ExpectedRevision, current is $previous. Resume and reconcile before saving."
    }
    $prior = $null
    if ($latest) {
        $prior = Read-MilestoneCheckpoint $latest.FullName $state.milestone $previous
        foreach ($task in $prior.state.completed) {
            if ($task -cnotin $state.completed) { throw "Checkpoint would discard a completed task: $task" }
        }
        $trackedTasks = $state.completed + $state.pending
        foreach ($task in $prior.state.pending) {
            if ($task -cnotin $trackedTasks) { throw "Checkpoint would discard a pending task: $task" }
        }
        if ($prior.repositories.launcher -and -not $LauncherRoot) {
            throw 'Provide -LauncherRoot for a milestone that already tracks Launcher.'
        }
    }
    $repositories = [ordered]@{ skyMp = Get-RepoState $SkyMp }
    if ($LauncherRoot) {
        $repositories.launcher = Get-RepoState (Resolve-Path -LiteralPath $LauncherRoot).Path
        if ($repositories.launcher.root -eq $repositories.skyMp.root) { throw 'Launcher must be a separate repository.' }
        if ($prior.repositories.launcher -and $prior.repositories.launcher.root -ne $repositories.launcher.root) {
            throw 'Launcher checkout differs from the prior checkpoint.'
        }
    }
    $revision = $previous + 1
    $record = [ordered]@{
        schema = 1
        revision = $revision
        createdUtc = [DateTime]::UtcNow.ToString('o')
        state = $state
        repositories = $repositories
        evidence = $evidence
    }
    $pending = Join-Path $directory ".$([guid]::NewGuid().ToString('N')).tmp"
    $destination = Join-Path $directory ('revision-{0:d10}.json' -f $revision)
    try {
        [IO.File]::WriteAllText($pending, ($record | ConvertTo-Json -Depth 10))
        $null = Read-MilestoneCheckpoint $pending $state.milestone $revision
        $sha256 = (Get-FileHash -LiteralPath $pending).Hash
        [IO.File]::Move($pending, $destination)
    } finally {
        if (Test-Path -LiteralPath $pending) { [IO.File]::Delete($pending) }
    }
    [ordered]@{
        milestone = $state.milestone
        stage = $state.stage
        status = $state.status
        revision = $revision
        path = $destination
        sha256 = $sha256
    } | ConvertTo-Json
} finally {
    $lock.Dispose()
}
