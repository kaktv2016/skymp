#!/usr/bin/env pwsh
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('Gamemode', 'Blueprint', 'CreationKit', 'Launcher')][string]$Suite,
    [string]$LauncherRoot = (Join-Path $PSScriptRoot '../../../skyrim-rp-launcher'),
    [string]$EvidenceRoot = [IO.Path]::GetTempPath()
)
. "$PSScriptRoot/common.ps1"
exit (Invoke-FrostveilSuite $Suite 'B' $LauncherRoot $EvidenceRoot)
