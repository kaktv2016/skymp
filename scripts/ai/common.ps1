# Shared by the PowerShell 7 entry points in this directory.
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$script:SkyMp = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$script:Suites = @{
    Gamemode = 'rp-gamemode'
    Blueprint = 'blueprint-editor'
    CreationKit = 'rp-gamemode/tooling/frostveil-creation-kit-mcp'
    Launcher = '.'
}

function Get-GitOutput([string]$Repo, [string[]]$GitArguments) {
    $output = & git -C $Repo @GitArguments
    if ($LASTEXITCODE -ne 0) { throw "git $($GitArguments -join ' ') failed in $Repo ($LASTEXITCODE)" }
    $output
}

function Get-RepoState([string]$Repo) {
    $root = Get-GitOutput $Repo @('rev-parse', '--show-toplevel')
    if ((Resolve-Path -LiteralPath $Repo).Path -ne (Resolve-Path -LiteralPath $root).Path) {
        throw "Expected a repository root: $Repo"
    }
    $changes = @(Get-GitOutput $Repo @('status', '--porcelain=v1', '--untracked-files=all'))
    [ordered]@{
        root = $root
        commit = Get-GitOutput $Repo @('rev-parse', 'HEAD')
        branch = Get-GitOutput $Repo @('branch', '--show-current')
        clean = $changes.Count -eq 0
        changes = $changes
    }
}

function New-GateReceipt([string]$Gate, [string]$Scope, [string]$EvidenceRoot) {
    $directory = Join-Path $EvidenceRoot "frostveil-$Gate-$([guid]::NewGuid())"
    New-Item -ItemType Directory -Path $directory | Out-Null
    [ordered]@{
        directory = (Resolve-Path -LiteralPath $directory).Path
        receipt = [ordered]@{
            schema = 1
            gate = $Gate
            scope = $Scope
            utc = [DateTime]::UtcNow.ToString('o')
            commands = @()
            limitations = 'Local evidence only. No real Skyrim, review approval, signed distribution, or deployment is implied.'
        }
    }
}

function Complete-Gate($Run, [int]$ExitCode) {
    $Run.receipt.exitCode = $ExitCode
    $path = Join-Path $Run.directory 'receipt.json'
    $Run.receipt | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $path -Encoding utf8
    Write-Host "Gate $($Run.receipt.gate) exit $ExitCode. Receipt: $path"
}

function Get-SuiteRepo([string]$Suite, [string]$LauncherRoot) {
    if ($Suite -eq 'Launcher') { return (Resolve-Path -LiteralPath $LauncherRoot).Path }
    $script:SkyMp
}

function Get-SuitePlan([string]$Suite, [string]$Gate) {
    if ($Gate -eq 'B' -and $Suite -eq 'Gamemode') {
        [ordered]@{ arguments = @('run', 'test:profile'); tests = $true }
        return
    }
    if ($Gate -eq 'B' -and $Suite -eq 'Blueprint') {
        [ordered]@{ arguments = @('test', '--', 'src/npc-runtime.test.tsx'); tests = $true }
        return
    }
    if ($Suite -eq 'Launcher') {
        [ordered]@{ arguments = @('run', 'typecheck'); tests = $false }
    }
    if ($Gate -eq 'C' -and $Suite -in 'Blueprint', 'Launcher') {
        [ordered]@{ arguments = @('run', 'build'); tests = $false }
    }
    [ordered]@{ arguments = @('test'); tests = $true }
}

function Get-LogTestCount([string]$Log) {
    # Node TAP/spec footers and Vitest's aggregate summary.
    $ansi = "$([char]27)\[[0-9;]*m"
    $count = $null
    foreach ($line in Get-Content -LiteralPath $Log) {
        $plain = $line -replace $ansi, ''
        if ($plain -match '^(?:#|ℹ) tests (\d+)\s*$' -or
            $plain -match '^\s*Tests\s+.*?\((\d+)\)\s*$') {
            $count = [int]$Matches[1]
        }
    }
    $count
}

function Invoke-FrostveilSuite([string]$Suite, [string]$Gate, [string]$LauncherRoot, [string]$EvidenceRoot) {
    $run = New-GateReceipt $Gate $Suite $EvidenceRoot
    $code = 0
    try {
        $repo = Get-SuiteRepo $Suite $LauncherRoot
        $run.receipt.before = Get-RepoState $repo
        $directory = Join-Path $repo $script:Suites[$Suite]
        $npm = (Get-Command npm.cmd -CommandType Application | Select-Object -First 1).Source
        Push-Location -LiteralPath $directory
        try {
            foreach ($step in Get-SuitePlan $Suite $Gate) {
                $arguments = $step.arguments
                $logName = "command-$($run.receipt.commands.Count + 1).log"
                $log = Join-Path $run.directory $logName
                & $npm @arguments 2>&1 | ForEach-Object { "$_" } | Out-File -LiteralPath $log -Encoding utf8
                $commandCode = $LASTEXITCODE
                $count = if ($step.tests) { Get-LogTestCount $log }
                $run.receipt.commands += [ordered]@{
                    executable = $npm
                    arguments = $arguments
                    cwd = (Get-Location).Path
                    exitCode = $commandCode
                    testCount = $count
                    log = $logName
                    sha256 = (Get-FileHash -LiteralPath $log).Hash
                }
                Write-Host "npm $($arguments -join ' ') exit $commandCode, test count [$count]. Log: $log"
                if ($commandCode -ne 0) { $code = $commandCode; break }
                if ($step.tests -and $count -le 0) { throw "Successful command reported no tests: $log" }
            }
        } finally { Pop-Location }
        $run.receipt.after = Get-RepoState $repo
        if ($run.receipt.before.commit -ne $run.receipt.after.commit -or
            ($run.receipt.before.changes -join "`n") -cne ($run.receipt.after.changes -join "`n")) {
            throw 'Repository changed during validation. Capture a new baseline before using the receipt.'
        }
    } catch {
        $run.receipt.error = $_.ToString()
        Write-Warning $run.receipt.error
        if ($code -eq 0) { $code = 1 }
    }
    Complete-Gate $run $code
    $code
}
