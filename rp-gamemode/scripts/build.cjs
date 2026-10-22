const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const modules = path.resolve(root, '../skymp5-server/node_modules');
// Existing inspected packages only. This script never installs dependencies.
for (const [name, version] of [['typescript', '5.4.5'], ['esbuild', '0.28.1'], ['@types/node', '22.10.2']]) {
  const actual = require(path.join(modules, name, 'package.json')).version;
  if (actual !== version) throw new Error(`${name}: expected ${version}, found ${actual}. Review toolchain before changing pins.`);
}
for (const config of ['tsconfig.json', 'tsconfig.type-tests.json']) {
  const run = spawnSync(process.execPath, [path.join(modules, 'typescript/bin/tsc'), '-p', path.join(root, config)], { cwd: root, stdio: 'inherit' });
  if (run.error) throw run.error;
  if (run.status !== 0) process.exit(run.status ?? 1);
}
const esbuild = require(path.join(modules, 'esbuild'));
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.mkdirSync(path.join(root, 'dist/client-ui'), { recursive:true });
fs.copyFileSync(path.join(root, 'client-ui/index.html'), path.join(root, 'dist/client-ui/index.html'));
const result = esbuild.buildSync({ entryPoints: [path.join(root, 'src/index.ts')], outfile: path.join(root, 'dist/rp-gamemode.cjs'), bundle: true, format: 'cjs', platform: 'node', target: 'node16', metafile: true, sourcemap: false });
const runtimeImports = [...new Set(Object.values(result.metafile.outputs).flatMap(output => output.imports.map(entry => entry.path)))];
if (runtimeImports.some(name => !['node:crypto','node:fs','node:path'].includes(name))) throw new Error('Runtime bundle has an unexpected external import');
fs.writeFileSync(path.join(root, 'dist/build-manifest.json'), JSON.stringify({ typescript: '5.4.5', esbuild: '0.28.1', runtimeImports, metafile: result.metafile }, null, 2));
console.log('Built CommonJS RP bundle; only Node built-in crypto/fs/path may remain external.');
