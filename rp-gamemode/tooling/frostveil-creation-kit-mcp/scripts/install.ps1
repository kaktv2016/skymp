$ErrorActionPreference='Stop'
function StableJson($value){
 if($null -eq $value){return 'null'}
 if($value -is [System.Management.Automation.PSCustomObject]){
  $items=@($value.PSObject.Properties.Name | Sort-Object | ForEach-Object { (ConvertTo-Json -InputObject $_ -Compress)+':'+(StableJson $value.$_) })
  return '{'+($items -join ',')+'}'
 }
 if($value -is [System.Array]){return '['+(@($value | ForEach-Object {StableJson $_}) -join ',')+']'}
 return ConvertTo-Json -InputObject $value -Compress
}
$packageRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$entry=Join-Path $packageRoot 'dist/index.js'
if(!(Test-Path -LiteralPath $entry)){throw 'Build the package before registration'}
$node=(Get-Command node -CommandType Application | Select-Object -First 1).Source
$servers=@(codex mcp list --json | ConvertFrom-Json)
if($LASTEXITCODE -ne 0){throw 'Cannot read existing Codex MCP configurations'}
$existing=@($servers | Where-Object name -EQ 'frostveil_creation_kit')
if($existing.Count -gt 0){
 if($existing[0].transport.command -ne $node -or @($existing[0].transport.args).Count -ne 1 -or $existing[0].transport.args[0] -ne $entry){throw 'Existing same-name MCP differs; refusing overwrite'}
 Write-Output 'Existing matching frostveil_creation_kit registration preserved';exit 0
}
$codexDir=Join-Path $env:USERPROFILE '.codex'
$backupDir=Join-Path $codexDir ('backups/frostveil-creation-kit-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $backupDir | Out-Null
$config=Join-Path $codexDir 'config.toml'
if(Test-Path -LiteralPath $config){Copy-Item -LiteralPath $config -Destination (Join-Path $backupDir 'config.toml')}
codex mcp add frostveil_creation_kit -- $node $entry
if($LASTEXITCODE -ne 0){throw "Registration failed; original config backup: $backupDir"}
$after=@(codex mcp list --json | ConvertFrom-Json)
if($LASTEXITCODE -ne 0){throw 'Cannot verify MCP list'}
$servers | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath (Join-Path $backupDir 'before-list.json')
$after | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath (Join-Path $backupDir 'after-list.json')
foreach($before in $servers){
 $match=@($after | Where-Object name -EQ $before.name)
 # Codex's TOML serializer may normalize a missing/empty argv identically.
 if($null -eq $before.transport.args){$before.transport.args=@()}
 if($match.Count -eq 1 -and $null -eq $match[0].transport.args){$match[0].transport.args=@()}
 if($match.Count -ne 1 -or (StableJson $match[0]) -ne (StableJson $before)){throw "Unrelated MCP configuration changed ($($before.name)); preserve backup and inspect before further action"}
}
$new=@($after | Where-Object name -EQ 'frostveil_creation_kit')
if($new.Count -ne 1 -or !$new[0].enabled){throw 'New MCP not enabled'}
[pscustomobject]@{name=$new[0].name;enabled=$new[0].enabled;command=$node;entry=$entry;backup=$backupDir;unrelatedPreserved=$true;invocationProof='PENDING_REAL_CODEX_CALL'} | ConvertTo-Json
