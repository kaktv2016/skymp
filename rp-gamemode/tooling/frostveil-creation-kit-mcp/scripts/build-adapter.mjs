import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const pkg=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repo=path.resolve(pkg,'../../..');
const run=spawnSync(path.join(repo,'.local/tools/dotnet-sdk-10/dotnet.exe'),['build',path.join(pkg,'adapter/Adapter.csproj'),'-c','Release','--nologo','-p:RestoreLockedMode=true'],{stdio:'inherit',windowsHide:true,env:{...process.env,DOTNET_CLI_HOME:path.join(repo,'.local/dotnet-home'),NUGET_PACKAGES:path.join(repo,'.local/nuget'),DOTNET_CLI_TELEMETRY_OPTOUT:'1'}});
process.exitCode=run.status??1;
