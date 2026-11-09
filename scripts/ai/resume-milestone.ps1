#!/usr/bin/env pwsh
# Read and verify a checkpoint without executing its stored text.
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Milestone,
    [string]$LauncherRoot = (Join-Path $PSScriptRoot '../../../skyrim-rp-launcher'),
    [switch]$ValidateOnly
)
. "$PSScriptRoot/checkpoint-common.ps1"

$directory = Get-CheckpointDirectory $Milestone
$file = Get-LatestCheckpointFile $directory
if (-not $file) { throw "No checkpoint for milestone $Milestone." }
$revision = Get-CheckpointRevision $file
$record = Read-MilestoneCheckpoint $file.FullName $Milestone $revision
$issues = [System.Collections.Generic.List[string]]::new()
$roots = @{ skyMp = $SkyMp; launcher = $LauncherRoot }
foreach ($name in $record.repositories.Keys) {
    $saved = $record.repositories[$name]
    try {
        $root = (Resolve-Path -LiteralPath $roots[$name]).Path
        if ([IO.Path]::GetFullPath($saved.root) -ne $root) {
            throw 'Repository path differs from the selected checkout.'
        }
        $current = Get-RepoState $root
        if ($current.commit -cne $saved.commit -or $current.branch -cne $saved.branch -or
            ($current.changes -join "`n") -cne ($saved.changes -join "`n")) {
            throw 'Commit, branch, or working status changed.'
        }
    } catch {
        $issues.Add("Git state for $name requires reconciliation. $($_.Exception.Message)")
    }
}
foreach ($item in $record.evidence) {
    try {
        if ((Get-EvidenceRecord $item.path).sha256 -ne $item.sha256) {
            $issues.Add("Changed evidence hash: $($item.path)")
        }
    } catch {
        $issues.Add("Evidence unavailable: $($item.path). $($_.Exception.Message)")
    }
}

$disposition = if ($issues.Count) { 'RECONCILE_CHECKPOINT' }
elseif ($false -in $record.repositories.Values.clean) { 'RECONCILE_DIRTY_WORKTREE' }
elseif ($record.state.status -eq 'OWNER_PENDING') { 'WAIT_FOR_OWNER' }
elseif ($record.state.status -eq 'BLOCKED') { 'WAIT_FOR_UNBLOCK' }
elseif ($record.state.status -eq 'DEFERRED') { 'WAIT_FOR_SCOPE' }
elseif ($record.state.status -eq 'ACCEPTED') { 'CLOSED' }
else { 'CONTINUE' }

$result = [ordered]@{
    milestone = $Milestone
    revision = $revision
    path = $file.FullName
    status = $record.state.status
    validation = [ordered]@{
        valid = $issues.Count -eq 0
        disposition = $disposition
        issues = $issues.ToArray()
    }
}
if (-not $ValidateOnly) { $result.checkpoint = $record }
$result | ConvertTo-Json -Depth 12
if ($issues.Count) { exit 1 }
