# Read-only by default. Apply requires the exact final owner-approved candidate hash.
[CmdletBinding()]
param([switch]$Apply,[string]$ApprovalPlanHash)
$ErrorActionPreference='Stop'
$project=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskRoot=[IO.Path]::GetFullPath((Join-Path $project '..'))
$serverRoot=Join-Path $taskRoot 'build\dist\server'
$delivery=[IO.Path]::GetFullPath((Join-Path $project '..\..\skyrim-rp-launcher\.local\navigation-polish\delivery'))
$planPath=Join-Path $delivery 'deployment-plan.json'
$planHash=(Get-FileHash -LiteralPath $planPath -Algorithm SHA256).Hash.ToLowerInvariant()
$plan=Get-Content -LiteralPath $planPath -Raw | ConvertFrom-Json
if($plan.status -ne 'SEALED_LOCAL_CANDIDATE_AWAITING_SINGLE_DEPLOYMENT_APPROVAL'){throw 'Unexpected candidate status'}
function Assert-File($Expected){
 if(!(Test-Path -LiteralPath $Expected.path -PathType Leaf)){throw "Missing file: $($Expected.path)"}
 if((Get-Item -LiteralPath $Expected.path).Length -ne $Expected.size -or (Get-FileHash -LiteralPath $Expected.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Expected.sha256){throw "File identity changed: $($Expected.path)"}
}
Assert-File $plan.bundle
Assert-File $plan.before.bundle
Assert-File $plan.before.esp
Assert-File $plan.before.wrapper
Assert-File $plan.correspondingSource
Assert-File $plan.modpack.correspondingSource
foreach($operation in @($plan.operations)){Assert-File $operation}
$settingsPath=Join-Path $serverRoot 'server-settings.json'
$config=Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
if($config.listenHost -ne '127.0.0.1' -or $config.uiListenHost -ne '127.0.0.1' -or $config.offlineMode -ne $true){throw 'Unexpected local server configuration'}
if([IO.Path]::GetFullPath($config.gamemodePath) -ne [IO.Path]::GetFullPath($plan.before.bundle.path)){throw 'Active gamemode changed'}
if((ConvertTo-Json -InputObject @($config.loadOrder) -Compress) -ne (ConvertTo-Json -InputObject @($plan.loadOrder) -Compress)){throw 'Load order changed'}
if(Get-Process -Name SkyrimSE -ErrorAction SilentlyContinue){throw 'Close Skyrim before the authorized server restart'}
$endpoints=@(Get-NetUDPEndpoint -LocalPort 7777 -ErrorAction SilentlyContinue)
if($endpoints.Count -gt 1){throw 'Ambiguous server listener'}
$serverProcess=$null
if($endpoints.Count){
 $serverProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$($endpoints[0].OwningProcess)"
 if($serverProcess.Name -ne 'node.exe' -or $serverProcess.CommandLine -notmatch 'dist_back[/\\]skymp5-server\.js'){throw 'Unrecognized server process'}
}
if(!$Apply){
 [pscustomobject]@{status='READ_ONLY_PREFLIGHT_PASS';planSHA256=$planHash;bundleSHA256=$plan.bundle.sha256;serverRunning=[bool]$serverProcess;gameWrites=0;serverWrites=0;worldBackup=$false} | ConvertTo-Json
 return
}
if($ApprovalPlanHash -ne $planHash){throw 'Apply requires the exact owner-approved plan SHA-256'}
$nodeExe='C:\Program Files\nodejs\node.exe'
if(!(Test-Path -LiteralPath $nodeExe -PathType Leaf)){throw 'Expected Node runtime not found'}
$deploy=Join-Path $taskRoot ('build\rp-audit\navigation-polish\deploy-'+[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
New-Item -ItemType Directory -Path $deploy | Out-Null
Copy-Item -LiteralPath $settingsPath -Destination (Join-Path $deploy 'server-settings-before.json')
Copy-Item -LiteralPath $config.gamemodePath -Destination (Join-Path $deploy 'gamemode-before.cjs')
$target=Join-Path $project ('deployed\'+$plan.bundle.sha256+'.cjs')
if(Test-Path -LiteralPath $target){Assert-File ([pscustomobject]@{path=$target;size=$plan.bundle.size;sha256=$plan.bundle.sha256})}
else{Copy-Item -LiteralPath $plan.bundle.path -Destination $target}
$script:candidateLaunch=$null
function Stop-OwnedServerTree($Launch){
 if(!$Launch){return}
 $shell=Get-Process -Id $Launch.pid -ErrorAction SilentlyContinue
 if($shell -and $shell.StartTime.ToUniversalTime().Ticks -ne $Launch.startedTicks){throw 'Candidate shell PID was reused; refusing rollback startup'}
 $children=@(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($Launch.pid)" | Where-Object {$_.Name -eq 'node.exe' -and $_.CommandLine -match 'dist_back[/\\]skymp5-server\.js'})
 if($shell){
  # The owned shell can be alive while Node has not bound a port. Kill the tree,
  # rather than relying on a UDP endpoint to identify the candidate process.
  & "$env:SystemRoot\System32\taskkill.exe" /PID $Launch.pid /T /F 2>&1 | Out-Null
  if($LASTEXITCODE -ne 0 -and (Get-Process -Id $Launch.pid -ErrorAction SilentlyContinue)){throw 'Candidate tree termination failed; refusing rollback startup'}
  Wait-Process -Id $Launch.pid -Timeout 10 -ErrorAction SilentlyContinue
 }
 foreach($child in $children){
  $remaining=Get-CimInstance Win32_Process -Filter "ProcessId=$($child.ProcessId)"
  if($remaining -and $remaining.CreationDate -eq $child.CreationDate){Stop-Process -Id $child.ProcessId;Wait-Process -Id $child.ProcessId -Timeout 10 -ErrorAction SilentlyContinue}
  $remaining=Get-CimInstance Win32_Process -Filter "ProcessId=$($child.ProcessId)"
  if($remaining -and $remaining.CreationDate -eq $child.CreationDate){throw 'Candidate child still running; refusing rollback startup'}
 }
 if(Get-Process -Id $Launch.pid -ErrorAction SilentlyContinue){throw 'Candidate process tree still running; refusing rollback startup'}
}
function Start-VisibleServer([string]$Label){
 $start=Join-Path $deploy ('start-'+$Label+'.ps1')
 $log=Join-Path $deploy ($Label+'-console.log')
 @"
`$Host.UI.RawUI.WindowTitle='Frostveil Courier Navigation Polish'
Set-Location -LiteralPath '$serverRoot'
`$env:FROSTVEIL_BEACON_PREVIEW='1'
`$env:FROSTVEIL_ADMIN_LOCAL='1'
Write-Host 'Frostveil - Ctrl+C to stop. World/economy data preserved.'
Write-Host 'Administrator rights require a fresh explicit owner-session grant.'
& '$nodeExe' 'dist_back/skymp5-server.js' 2>&1 | Tee-Object -FilePath '$log'
Write-Host 'Server stopped.'
"@ | Set-Content -LiteralPath $start -Encoding utf8
 $visible=Start-Process powershell.exe -ArgumentList @('-NoExit','-ExecutionPolicy','Bypass','-File',('"'+$start+'"')) -WindowStyle Normal -PassThru
 if($Label -eq 'candidate'){$script:candidateLaunch=[pscustomobject]@{pid=$visible.Id;startedTicks=$visible.StartTime.ToUniversalTime().Ticks}}
 $deadline=[DateTimeOffset]::UtcNow.AddSeconds(45)
 while([DateTimeOffset]::UtcNow -lt $deadline){
  $endpoint=Get-NetUDPEndpoint -LocalPort 7777 -ErrorAction SilentlyContinue
  if($endpoint){
   $process=Get-CimInstance Win32_Process -Filter "ProcessId=$($endpoint.OwningProcess)"
   if($process.Name -eq 'node.exe' -and $process.CommandLine -match 'dist_back[/\\]skymp5-server\.js' -and (Test-Path -LiteralPath $log)){
    $lines=Get-Content -LiteralPath $log -Raw
    if($lines -match '\[rp\] Phase 2\.1 foundation ready' -and $lines -match '\[rp-map\] native map discovery transport registered'){
     return [pscustomobject]@{powershellPid=$visible.Id;serverPid=$process.ProcessId;startScript=$start;log=$log}
    }
    if($Label -eq 'rollback' -and $lines -match '\[rp\] Phase 2\.1 foundation ready'){return [pscustomobject]@{powershellPid=$visible.Id;serverPid=$process.ProcessId;startScript=$start;log=$log}}
   }
  }
  Start-Sleep -Milliseconds 500
 }
 throw "Server readiness not verified; inspect $log"
}
if($serverProcess){Stop-Process -Id $serverProcess.ProcessId;Wait-Process -Id $serverProcess.ProcessId -ErrorAction SilentlyContinue}
if(Get-NetUDPEndpoint -LocalPort 7777 -ErrorAction SilentlyContinue){throw 'Server port remains busy'}
try{
 $config.gamemodePath=$target
 $temporary=Join-Path $deploy 'server-settings-after.json'
 $config | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $temporary -Encoding utf8
 Copy-Item -LiteralPath $temporary -Destination $settingsPath
 Assert-File $plan.before.esp
 Assert-File $plan.before.wrapper
 $started=Start-VisibleServer 'candidate'
}catch{
 $failure=$_.Exception.Message
 Stop-OwnedServerTree $script:candidateLaunch
 # Roll back code/config only. Never restore a world or financial journal.
 $endpoint=Get-NetUDPEndpoint -LocalPort 7777 -ErrorAction SilentlyContinue
 if($endpoint){
  $process=Get-CimInstance Win32_Process -Filter "ProcessId=$($endpoint.OwningProcess)"
  if($process.Name -ne 'node.exe' -or $process.CommandLine -notmatch 'dist_back[/\\]skymp5-server\.js'){throw 'Unrecognized rollback listener; inspect manually'}
  Stop-Process -Id $process.ProcessId;Wait-Process -Id $process.ProcessId -ErrorAction SilentlyContinue
 }
 Copy-Item -LiteralPath (Join-Path $deploy 'server-settings-before.json') -Destination $settingsPath
 $restored=Start-VisibleServer 'rollback'
 [pscustomobject]@{status='ROLLED_BACK_CODE_CONFIG';error=$failure;planSHA256=$planHash;backupDirectory=$deploy;process=$restored} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $delivery 'active-deployment.json') -Encoding utf8
 throw "Candidate failed; previous server code/config restarted. $failure"
}
$receipt=[pscustomobject]@{status='DEPLOYED_LOCALHOST';planSHA256=$planHash;at=[DateTimeOffset]::UtcNow.ToString('o');bundleSHA256=$plan.bundle.sha256;backupDirectory=$deploy;process=$started;installedGameWrites=0;worldBackup=$false;worldMigration=$false;nativeMapRendering='OWNER_TEST_PENDING'}
$receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $delivery 'active-deployment.json') -Encoding utf8
$receipt | ConvertTo-Json -Depth 8
