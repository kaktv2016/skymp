function Get-FrostveilCodex {
 $fromPath=Get-Command codex -CommandType Application,ExternalScript -ErrorAction SilentlyContinue | Select-Object -First 1
 if($fromPath){return $fromPath.Source}
 if($env:CODEX_CLI_PATH -and (Test-Path -LiteralPath $env:CODEX_CLI_PATH -PathType Leaf)){return $env:CODEX_CLI_PATH}
 $appBin=Join-Path $env:LOCALAPPDATA 'OpenAI/Codex/bin'
 if(Test-Path -LiteralPath $appBin -PathType Container){
  $candidates=@(Get-ChildItem -LiteralPath $appBin -Directory | ForEach-Object {
   $file=Join-Path $_.FullName 'codex.exe'
   if(Test-Path -LiteralPath $file -PathType Leaf){Get-Item -LiteralPath $file}
  } | Sort-Object LastWriteTimeUtc -Descending)
  foreach($candidate in ($candidates | Select-Object -First 32)){
   $version=& $candidate.FullName --version 2>$null
   if($LASTEXITCODE -eq 0 -and "$version" -match '^codex-cli '){return $candidate.FullName}
  }
 }
 throw 'Codex CLI not found on PATH or in the local Codex desktop installation. Install Codex CLI or set CODEX_CLI_PATH to its executable.'
}
