const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
for(const operation of ['deploy-navigation-discovery.ps1','deploy-navigation-containers.ps1'])test('deployment readiness failure terminates its unbound candidate before rollback: '+operation,{skip:process.platform!=='win32',timeout:30000},()=>{
 const project=path.resolve(__dirname,'..'),root=path.join(project,'.local/navigation-admin');fs.mkdirSync(root,{recursive:true});const fixture=fs.mkdtempSync(path.join(root,'process-cleanup-'));
 const quote=s=>"'"+s.replaceAll("'","''")+"'",childScript=path.join(fixture,'child.ps1'),state=path.join(fixture,'child.json'),runner=path.join(fixture,'verify.ps1');
 fs.writeFileSync(childScript,`$child=Start-Process -FilePath ${quote(process.execPath)} -ArgumentList @('-e','setInterval(()=>{},1000)','dist_back/skymp5-server.js') -WindowStyle Hidden -PassThru\n@{pid=$child.Id} | ConvertTo-Json | Set-Content -LiteralPath ${quote(state)}\nWait-Process -Id $child.Id\n`);
 fs.writeFileSync(runner,`$ErrorActionPreference='Stop'
$tokens=$null;$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile(${quote(path.join(project,'scripts',operation))},[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Deployment script parser failure'}
$fn=$ast.Find({param($item) $item -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -eq 'Stop-OwnedServerTree'},$true)
if(!$fn){throw 'Cleanup function missing'}
. ([scriptblock]::Create($fn.Extent.Text))
$parent=Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',${quote('"'+childScript+'"')}) -WindowStyle Hidden -PassThru
$launch=[pscustomobject]@{pid=$parent.Id;startedTicks=$parent.StartTime.ToUniversalTime().Ticks}
try {
 $deadline=[DateTime]::UtcNow.AddSeconds(10)
 while(!(Test-Path -LiteralPath ${quote(state)}) -and [DateTime]::UtcNow -lt $deadline){Start-Sleep -Milliseconds 100}
 $child=Get-Content -LiteralPath ${quote(state)} -Raw | ConvertFrom-Json
 if(!(Get-Process -Id $child.pid -ErrorAction SilentlyContinue)){throw 'Synthetic child not started'}
 Stop-OwnedServerTree $launch
 if(Get-Process -Id $child.pid -ErrorAction SilentlyContinue){throw 'Unbound synthetic Node survived cleanup'}
 'PASS: owned unbound candidate tree terminated'
} finally {
 Stop-OwnedServerTree $launch
}
`);
 const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',runner],{timeout:25000,encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,(result.stderr??'')+(result.stdout??''));assert.match(result.stdout,/PASS: owned unbound candidate tree terminated/);
});

test('shared ESP deployment writes Node-readable config without BOM under Windows PowerShell 5',{skip:process.platform!=='win32'},()=>{
 const project=path.resolve(__dirname,'..'),fixture=fs.mkdtempSync(path.join(project,'.local/navigation-admin/config-encoding-')),target=path.join(fixture,'config.json');
 const quote=s=>"'"+s.replaceAll("'","''")+"'";
 const script=`$ErrorActionPreference='Stop';$tokens=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile(${quote(path.join(project,'scripts/deploy-navigation-containers.ps1'))},[ref]$tokens,[ref]$errors);if($errors.Count){throw 'Parser failure'};$fn=$ast.Find({param($item) $item -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -eq 'Write-ServerConfiguration'},$true);if(!$fn){throw 'Encoding helper missing'};. ([scriptblock]::Create($fn.Extent.Text));Write-ServerConfiguration ${quote(target)} @{fixture=$true};`;
 const run=spawnSync('powershell.exe',['-NoProfile','-Command',script],{encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(run.status,0,run.stderr);
 const bytes=fs.readFileSync(target);assert.notDeepEqual([...bytes.subarray(0,3)],[0xef,0xbb,0xbf]);assert.deepEqual(JSON.parse(bytes.toString('utf8')),{fixture:true});
});
