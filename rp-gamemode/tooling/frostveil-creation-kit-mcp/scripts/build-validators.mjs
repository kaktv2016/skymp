import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const pkg=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repo=path.resolve(pkg,'../../..');
const require=createRequire(import.meta.url);
// Reuse the project's verified compiler and original validators. No independent
// ESP reader/identity mapper or runtime build/deployment is introduced.
const esbuild=require(path.join(repo,'skymp5-server/node_modules/esbuild'));
if(esbuild.version!=='0.28.1')throw Error('Expected project esbuild 0.28.1');
for(const name of ['catalog-loader','template-catalog'])esbuild.buildSync({entryPoints:[path.join(repo,'rp-gamemode/src/modules/npc',name+'.ts')],bundle:true,platform:'node',format:'cjs',target:'node24',outfile:path.join(pkg,'dist',name+'.cjs')});
