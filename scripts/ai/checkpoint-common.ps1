. "$PSScriptRoot/common.ps1"

$script:MilestoneStages = @(
    'INTAKE', 'BASELINE_AUDIT', 'REQUIREMENTS', 'ACCEPTANCE_CRITERIA', 'TASK_DECOMPOSITION',
    'IMPLEMENTATION', 'AUTOMATED_VALIDATION', 'INDEPENDENT_REVIEW', 'REPAIR_LOOP', 'INTEGRATION',
    'SAFE_DEV_DEPLOYMENT', 'OWNER_ACCEPTANCE', 'CLOSEOUT'
)
$script:MilestoneStatuses = @(
    'NOT_STARTED', 'IN_PROGRESS', 'AUTO_VERIFIED', 'OWNER_PENDING', 'BLOCKED', 'DEFERRED', 'ACCEPTED'
)

function Get-CheckpointDirectory([string]$Milestone, [switch]$Create) {
    if ($Milestone -cnotmatch '^[a-z0-9][a-z0-9-]{0,63}\z') {
        throw 'Milestone ID must be 1 to 64 lowercase letters, digits, or hyphens and start with a letter or digit.'
    }
    $path = $SkyMp
    foreach ($segment in '.local', 'ai', 'checkpoints', "milestone-$Milestone") {
        $path = Join-Path $path $segment
        if (-not (Test-Path -LiteralPath $path)) {
            if (-not $Create) { throw "No checkpoint for milestone $Milestone." }
            [IO.Directory]::CreateDirectory($path) | Out-Null
        }
        $entry = Get-Item -Force -LiteralPath $path
        if (-not $entry.PSIsContainer -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Checkpoint directory must be a local directory without redirection: $path"
        }
    }
    $path
}

function Read-CheckpointJson([string]$Path) {
    $file = Get-Item -Force -LiteralPath $Path
    if ($file -isnot [IO.FileInfo] -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $file.Length -gt 1MB) {
        throw "Expected a local JSON file of at most 1 MiB: $Path"
    }
    $json = Get-Content -Raw -LiteralPath $file.FullName | ConvertFrom-Json -AsHashtable -NoEnumerate
    if ($json -isnot [System.Collections.IDictionary]) { throw "Expected a JSON object: $Path" }
    $json
}

function Assert-MilestoneState($State) {
    if ($State -isnot [System.Collections.IDictionary] -or
        $State.milestone -isnot [string] -or $State.milestone -cnotmatch '^[a-z0-9][a-z0-9-]{0,63}\z' -or
        $State.stage -isnot [string] -or $State.stage -cnotin $MilestoneStages -or
        $State.status -isnot [string] -or $State.status -cnotin $MilestoneStatuses) {
        throw 'Invalid milestone ID, stage, or status.'
    }
    $requiredText = @('goal', 'scope', 'nextAction')
    $optionalText = @('ownerAction', 'blocker', 'notes')
    $lists = @('completed', 'pending', 'evidencePaths')
    $allowed = $requiredText + $optionalText + $lists + @('milestone', 'stage', 'status')
    foreach ($name in $State.Keys) {
        if ($name -cnotin $allowed) { throw "Unknown milestone field: $name" }
    }
    foreach ($name in $requiredText + $optionalText) {
        if ($name -in $optionalText -and -not $State.Contains($name)) { continue }
        if ($State[$name] -isnot [string] -or [string]::IsNullOrWhiteSpace($State[$name]) -or $State[$name].Length -gt 4000) {
            throw "Expected nonempty text of at most 4000 characters for $name."
        }
    }
    foreach ($name in $lists) {
        $items = $State[$name]
        if ($items -isnot [array] -or $items.Count -gt 100) { throw "Expected an array of at most 100 items for $name." }
        foreach ($item in $items) {
            if ($item -isnot [string] -or [string]::IsNullOrWhiteSpace($item) -or $item.Length -gt 1024) {
                throw "Invalid item in $name."
            }
        }
        if (@($items | Sort-Object -Unique).Count -ne $items.Count) { throw "Duplicate item in $name." }
    }
    foreach ($task in $State.completed) {
        if ($task -in $State.pending) { throw "Task is both completed and pending: $task" }
    }
    if ($State.status -eq 'OWNER_PENDING' -and ($State.stage -ne 'OWNER_ACCEPTANCE' -or -not $State.ownerAction)) {
        throw 'OWNER_PENDING requires the OWNER_ACCEPTANCE stage and a specific ownerAction.'
    }
    if ($State.status -eq 'BLOCKED' -and -not $State.blocker) { throw 'BLOCKED requires a specific blocker.' }
    if ($State.status -eq 'ACCEPTED' -and ($State.stage -ne 'CLOSEOUT' -or $State.pending.Count)) {
        throw 'ACCEPTED requires CLOSEOUT and no pending in-scope tasks.'
    }
}

function Get-EvidenceRecord([string]$Path) {
    if (-not [IO.Path]::IsPathFullyQualified($Path) -or $Path -match '^[\\/]{2}') {
        throw "Evidence must use an absolute local file path: $Path"
    }
    $file = Get-Item -Force -LiteralPath $Path
    if ($file -isnot [IO.FileInfo] -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $file.Length -gt 16MB) {
        throw "Expected a regular evidence file of at most 16 MiB: $Path"
    }
    [ordered]@{ path = $file.FullName; sha256 = (Get-FileHash -LiteralPath $file.FullName).Hash }
}

function Get-LatestCheckpointFile([string]$Directory) {
    Get-ChildItem -LiteralPath $Directory -Force -File -Filter 'revision-*.json' |
        Where-Object Name -Match '^revision-\d{10}\.json$' |
        Sort-Object Name -Descending | Select-Object -First 1
}

function Read-MilestoneCheckpoint([string]$Path, [string]$Milestone, [int]$Revision) {
    $record = Read-CheckpointJson $Path
    if ($record.schema -cne 1 -or $record.revision -cne $Revision -or $Revision -lt 1 -or
        $record.state.milestone -cne $Milestone -or -not $record.createdUtc) {
        throw "Invalid checkpoint identity: $Path"
    }
    Assert-MilestoneState $record.state
    if ($record.repositories -isnot [System.Collections.IDictionary] -or -not $record.repositories.skyMp -or
        @($record.repositories.Keys | Where-Object { $_ -cnotin 'skyMp', 'launcher' }).Count) {
        throw "Invalid repository snapshot: $Path"
    }
    foreach ($repo in $record.repositories.Values) {
        if ($repo -isnot [System.Collections.IDictionary] -or $repo.root -isnot [string] -or
            $repo.commit -cnotmatch '^(?:[0-9a-f]{40}|[0-9a-f]{64})$' -or
            $repo.changes -isnot [array] -or $repo.clean -isnot [bool] -or
            $repo.clean -ne ($repo.changes.Count -eq 0)) {
            throw "Invalid repository state: $Path"
        }
    }
    if ($record.evidence -isnot [array] -or $record.evidence.Count -ne $record.state.evidencePaths.Count) {
        throw "Invalid evidence inventory: $Path"
    }
    for ($i = 0; $i -lt $record.evidence.Count; $i++) {
        $item = $record.evidence[$i]
        if ($item.path -cne $record.state.evidencePaths[$i] -or $item.sha256 -notmatch '^[0-9a-f]{64}$') {
            throw "Invalid evidence entry: $Path"
        }
    }
    $record
}

function Get-CheckpointRevision($File) {
    if ($null -eq $File) { return 0 }
    [int]::Parse($File.BaseName.Substring('revision-'.Length))
}
