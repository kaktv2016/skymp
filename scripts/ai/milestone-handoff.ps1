#!/usr/bin/env pwsh
# Validate a draft, record an approved pin, or load an execution handoff.
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('ValidateDraft','Approve','Load')][string]$Action,
    [string]$Milestone,
    [ValidateRange(1, 999999999)][int]$Revision,
    [string]$SpecificationCommit,
    [string]$LauncherRoot = (Join-Path $PSScriptRoot '../../../skyrim-rp-launcher')
)
. "$PSScriptRoot/checkpoint-common.ps1"

$pointerPath = 'docs/ai/ACTIVE_MILESTONE.md'
$milestonePattern = '^[a-z0-9][a-z0-9-]{0,63}\z'
$commitPattern = '^(?:[a-f0-9]{40}|[a-f0-9]{64})\z'
$sections = [ordered]@{
    'SPEC.md' = @('Goals','Requirements','Scope','Exclusions','Constraints','Dependencies')
    'EXECUTION_PLAN.md' = @('Strategy','Tasks','Skills','Subagent assignments','Quality gates')
    'ACCEPTANCE.md' = @('Machine criteria','Owner checks','Definition of Done','Rollback')
}

function Read-ProjectDocument([string]$Path) {
    $current = $SkyMp
    foreach ($segment in $Path.Split('/')) {
        $current = Join-Path $current $segment
        $item = Get-Item -Force -LiteralPath $current
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Redirected handoff path: $Path" }
    }
    if ($item -isnot [IO.FileInfo] -or $item.Length -gt 64KB) { throw "Expected a Markdown file of at most 64 KiB: $Path" }
    Get-Content -Raw -LiteralPath $current
}

function Read-PinnedDocument([string]$Commit, [string]$Path) {
    $null = Read-ProjectDocument $Path
    $tree = Get-GitOutput $SkyMp @('ls-tree', $Commit, '--', $Path)
    $index = Get-GitOutput $SkyMp @('ls-files', '--stage', '--', $Path)
    if ($tree -cnotmatch '^100644 blob [a-f0-9]+\s' -or $index -cnotmatch '^100644 [a-f0-9]+ 0\s') {
        throw "Expected a tracked regular Markdown file: $Path"
    }
    $blob = Get-GitOutput $SkyMp @('rev-parse', '--verify', "$($Commit):$Path")
    $current = Get-GitOutput $SkyMp @('rev-parse', '--verify', "HEAD:$Path")
    $staged = Get-GitOutput $SkyMp @('rev-parse', '--verify', ":$Path")
    $working = Get-GitOutput $SkyMp @('hash-object', "--path=$Path", '--', (Join-Path $SkyMp $Path))
    if ($current -cne $blob -or $staged -cne $blob -or $working -cne $blob) {
        throw "Uncommitted or unapproved document differs from $Commit : $Path"
    }
    (Get-GitOutput $SkyMp @('show', "$($Commit):$Path")) -join [char]10
}

function Read-ActivePointer([string]$Text) {
    $blocks = [regex]::Matches($Text, '(?ms)^```json[ \t]*\r?\n(.*?)^```[ \t]*\r?$')
    if ($blocks.Count -ne 1) { throw 'Expected exactly one JSON block in ACTIVE_MILESTONE.md.' }
    $p = $blocks[0].Groups[1].Value | ConvertFrom-Json -AsHashtable -NoEnumerate
    if ($p -isnot [System.Collections.IDictionary] -or $p.schema -isnot [long] -or $p.schema -ne 1 -or $p.status -isnot [string]) {
        throw 'Invalid active milestone schema.'
    }
    if ($p.status -ceq 'NONE' -and $p.Count -eq 2) { return $p }
    if ($p.Count -ne 5 -or $p.status -cnotin 'APPROVED','IN_PROGRESS','AUTO_VERIFIED','OWNER_PENDING','BLOCKED','DEFERRED','ACCEPTED' -or
        $p.milestone -isnot [string] -or $p.milestone -cnotmatch $milestonePattern -or
        $p.revision -isnot [long] -or $p.revision -lt 1 -or $p.revision -gt 999999999 -or
        $p.approvedCommit -isnot [string] -or $p.approvedCommit -cnotmatch $commitPattern) {
        throw 'Incomplete or unapproved active milestone pointer.'
    }
    $p
}

function Get-LatestApproval([string]$Id) {
    $latest = $null
    foreach ($commit in Get-GitOutput $SkyMp @('log', '--reverse', '--first-parent', '--format=%H', 'HEAD', '--', $pointerPath)) {
        $historical = (Get-GitOutput $SkyMp @('show', "$($commit):$pointerPath")) -join [char]10
        $p = Read-ActivePointer $historical
        if ($p.status -ceq 'APPROVED' -and $p.milestone -ceq $Id) {
            if ($latest -and $p.revision -eq $latest.pointer.revision -and $p.approvedCommit -ceq $latest.pointer.approvedCommit) {
                continue
            }
            $next = if ($latest) { $latest.pointer.revision + 1 } else { 1 }
            if ($p.revision -ne $next) { throw "Nonsequential approval history for $Id." }
            Assert-CommitAncestor $SkyMp $p.approvedCommit $commit
            $latest = [ordered]@{ pointer = $p; commit = $commit }
        }
    }
    $latest
}

function Assert-CommitAncestor([string]$Repo, [string]$Commit, [string]$Head) {
    $actual = Get-GitOutput $Repo @('rev-parse', '--verify', "$Commit^{commit}")
    if ($actual -cne $Commit) { throw "Expected a full commit ID: $Commit" }
    & git -C $Repo merge-base --is-ancestor $Commit $Head
    if ($LASTEXITCODE) { throw "Pinned commit $Commit is not in the ancestry of $Head in $Repo." }
}

function Get-Specification([string]$Id, [int]$Rev, [string]$Commit) {
    $docs = [ordered]@{}
    $dependencies = $null
    foreach ($name in $sections.Keys) {
        $path = "docs/ai/milestones/$Id/$name"
        $text = if ($Commit) { Read-PinnedDocument $Commit $path } else { Read-ProjectDocument $path }
        $markers = [regex]::Matches($text, '(?m)^(?:Milestone|Revision):[^\r\n]*') | ForEach-Object { $_.Value.TrimEnd() }
        if (($markers -join '|') -cne "Milestone: $Id|Revision: $Rev") { throw "Milestone ID or revision mismatch: $path" }
        $headings = [regex]::Matches($text, '(?m)^## ([^\r\n]+)\r?$')
        $bodies = @{}
        for ($i = 0; $i -lt $headings.Count; $i++) {
            $heading = $headings[$i]
            $title = $heading.Groups[1].Value.Trim()
            if ($bodies.ContainsKey($title)) { throw "Duplicate section $title in $path" }
            $start = $heading.Index + $heading.Length
            $end = if ($i + 1 -lt $headings.Count) { $headings[$i + 1].Index } else { $text.Length }
            $bodies[$title] = $text.Substring($start, $end - $start).Trim()
        }
        foreach ($section in $sections[$name]) {
            $body = $bodies[$section]
            if (-not $body -or $body -match '^(?:[-*]\s+)?(?:TBD|TODO|PLACEHOLDER)[.!]?$') {
                throw "Missing content for $section in $path"
            }
        }
        if ($name -eq 'SPEC.md') {
            $launcher = [regex]::Matches($bodies.Dependencies, '(?m)^- Launcher commit: (none|[a-f0-9]{40}|[a-f0-9]{64})\r?$')
            $tools = [regex]::Matches($bodies.Dependencies, '(?m)^- Required tools: ([A-Za-z0-9_.-]+(?:, [A-Za-z0-9_.-]+)*)\r?$')
            if ($launcher.Count -ne 1 -or $tools.Count -ne 1) { throw 'Dependencies require one Launcher commit and one Required tools entry.' }
            $dependencies = [ordered]@{
                launcherCommit = $launcher[0].Groups[1].Value
                requiredTools = @($tools[0].Groups[1].Value -split ', ' | Where-Object { $_ -cne 'none' })
            }
        }
        $docs[$name] = $text
    }
    [ordered]@{ documents = $docs; dependencies = $dependencies }
}

function Test-HandoffDependencies($Dependencies, [switch]$RequireLauncherBaseline) {
    foreach ($tool in $Dependencies.requiredTools) {
        if (-not (Get-Command -Name $tool -CommandType Application -ErrorAction SilentlyContinue)) {
            throw "Required tool is unavailable: $tool"
        }
    }
    if ($Dependencies.launcherCommit -ceq 'none') { return }
    $launcher = Get-RepoState (Resolve-Path -LiteralPath $LauncherRoot).Path
    if ($launcher.root -eq $SkyMp.Replace('\','/')) { throw 'Launcher dependency must use a separate checkout.' }
    Assert-CommitAncestor $launcher.root $Dependencies.launcherCommit $launcher.commit
    if ($RequireLauncherBaseline -and (-not $launcher.clean -or $launcher.commit -cne $Dependencies.launcherCommit)) {
        throw 'Initialization requires the clean Launcher checkout at its pinned baseline.'
    }
    $launcher
}

if ($Action -ne 'Load' -and ($Milestone -cnotmatch $milestonePattern -or $Revision -lt 1)) {
    throw 'Specify a lowercase milestone ID and a positive revision.'
}
if ($Action -eq 'Load' -and ($Milestone -or $Revision -or $SpecificationCommit)) {
    throw 'Load selects the milestone and revision from ACTIVE_MILESTONE.md.'
}
if ($Action -eq 'ValidateDraft') {
    $draft = Get-Specification $Milestone $Revision
    [ordered]@{ milestone = $Milestone; revision = $Revision; disposition = 'DRAFT_VALID'; dependencies = $draft.dependencies } | ConvertTo-Json -Depth 5
    exit 0
}

$head = Get-GitOutput $SkyMp @('rev-parse', 'HEAD')
$pointer = Read-ActivePointer (Read-PinnedDocument $head $pointerPath)
if ($Action -eq 'Approve') {
    if ($SpecificationCommit -cnotmatch $commitPattern) { throw 'Approve requires the full owner-approved specification commit.' }
    $lockDir = Get-CheckpointDirectory 'handoff-control' -Create
    $lockPath = Join-Path $lockDir '.approval.lock'
    if ((Test-Path -LiteralPath $lockPath) -and
        ((Get-Item -Force -LiteralPath $lockPath).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Approval lock must not be redirected.'
    }
    $lock = [IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None')
    try {
        $null = Read-PinnedDocument $head $pointerPath
        if ($pointer.status -cnotin 'NONE','ACCEPTED','DEFERRED' -and $pointer.milestone -cne $Milestone) {
            throw 'Close or defer the active milestone before approving a different one.'
        }
        $previous = Get-LatestApproval $Milestone
        $next = if ($previous) { $previous.pointer.revision + 1 } else { 1 }
        if ($Revision -ne $next) { throw "Expected specification revision $next for $Milestone." }
        Assert-CommitAncestor $SkyMp $SpecificationCommit $head
        if ($previous) { Assert-CommitAncestor $SkyMp $previous.pointer.approvedCommit $SpecificationCommit }
        $spec = Get-Specification $Milestone $Revision $SpecificationCommit
        $null = Test-HandoffDependencies $spec.dependencies -RequireLauncherBaseline
        if ((Get-GitOutput $SkyMp @('rev-parse', 'HEAD')) -cne $head) { throw 'HEAD changed during approval.' }
        $approved = [ordered]@{ schema = 1; milestone = $Milestone; revision = $Revision; approvedCommit = $SpecificationCommit; status = 'APPROVED' }
        $fence = [string][char]96 * 3
        $target = Join-Path $SkyMp $pointerPath
        $temp = "$target.$([guid]::NewGuid().ToString('N')).tmp"
        try {
            $content = @('# Active Frostveil milestone', '', ($fence + 'json'), ($approved | ConvertTo-Json), $fence, '') -join [char]10
            [IO.File]::WriteAllText($temp, $content)
            [IO.File]::Move($temp, $target, $true)
        } finally {
            if (Test-Path -LiteralPath $temp) { [IO.File]::Delete($temp) }
        }
        $approved | ConvertTo-Json
    } finally { $lock.Dispose() }
    exit 0
}

if ($pointer.status -ceq 'NONE') {
    @{ disposition = 'NO_ACTIVE_MILESTONE'; head = $head } | ConvertTo-Json
    exit 0
}
$approval = Get-LatestApproval $pointer.milestone
if (-not $approval -or $approval.pointer.revision -ne $pointer.revision -or
    $approval.pointer.approvedCommit -cne $pointer.approvedCommit) {
    throw 'No matching committed approval for the active milestone revision.'
}
$spec = Get-Specification $pointer.milestone $pointer.revision $pointer.approvedCommit
$key = "$($pointer.milestone)|$($pointer.revision)|$($pointer.approvedCommit)"
$digest = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($key))).ToLowerInvariant()
$checkpointId = "handoff-$($digest.Substring(0,40))"
$checkpointPath = Join-Path $SkyMp ".local/ai/checkpoints/milestone-$checkpointId"
$latest = if (Test-Path -LiteralPath $checkpointPath) {
    Get-LatestCheckpointFile (Get-CheckpointDirectory $checkpointId)
}
$result = [ordered]@{
    milestone = $pointer.milestone
    revision = $pointer.revision
    approvedCommit = $pointer.approvedCommit
    approvalRecordCommit = $approval.commit
    head = $head
    status = $pointer.status
    dependencies = $spec.dependencies
    launcher = Test-HandoffDependencies $spec.dependencies -RequireLauncherBaseline:($pointer.status -ceq 'APPROVED' -and -not $latest)
    checkpointId = $checkpointId
    documents = $spec.documents
}
$wait = @{ OWNER_PENDING = 'WAIT_FOR_OWNER'; BLOCKED = 'WAIT_FOR_UNBLOCK'; DEFERRED = 'WAIT_FOR_SCOPE'; ACCEPTED = 'CLOSED' }
if ($latest) {
    $shell = (Get-Process -Id $PID).Path
    $raw = & $shell -NoProfile -File "$PSScriptRoot/resume-milestone.ps1" -Milestone $checkpointId -LauncherRoot $LauncherRoot
    if ($LASTEXITCODE) {
        throw ("Matching checkpoint $checkpointId needs reconciliation." + [char]10 + ($raw -join [char]10))
    }
    $resume = ($raw -join [char]10) | ConvertFrom-Json -AsHashtable
    if ($spec.dependencies.launcherCommit -cne 'none' -and -not $resume.checkpoint.repositories.launcher) {
        throw 'Matching checkpoint is missing its Launcher repository snapshot.'
    }
    if ($pointer.status -cne 'APPROVED' -and $resume.checkpoint.state.status -cne $pointer.status) {
        throw 'Checkpoint and active milestone status disagree.'
    }
    $result.checkpoint = $resume.checkpoint
    $result.disposition = $resume.validation.disposition
} elseif ($pointer.status -ceq 'APPROVED') {
    if (-not (Get-RepoState $SkyMp).clean) { throw 'Reconcile the dirty SkyMP checkout before initialization.' }
    $result.disposition = 'INITIALIZE'
} elseif ($pointer.status -cin 'ACCEPTED','DEFERRED') {
    $result.disposition = $wait[$pointer.status]
} else {
    throw "Existing milestone requires its matching checkpoint: $checkpointId"
}
if ((Get-GitOutput $SkyMp @('rev-parse', 'HEAD')) -cne $head) { throw 'HEAD changed during handoff validation.' }
$result | ConvertTo-Json -Depth 14
