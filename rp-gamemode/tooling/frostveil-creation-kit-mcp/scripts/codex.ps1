$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'resolve-codex.ps1')
$cli=Get-FrostveilCodex
& $cli @args
exit $LASTEXITCODE
